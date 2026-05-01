import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { ChatGateway } from './gateways/chat.gateway';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { MessageType } from '@prisma/client';

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private chatGateway: ChatGateway,
    private cloudinaryService: CloudinaryService,
  ) {}

  async uploadFile(file: Express.Multer.File) {
    const upload = await this.cloudinaryService.uploadFile(file, 'messages');
    return {
      fileUrl: upload.secure_url,
      fileName: file.originalname,
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`
    };
  }

  async sendMessage(
    senderId: number, 
    receiverId: number, 
    content: string, 
    type: MessageType, 
    file?: Express.Multer.File, 
    isEncrypted: boolean = false, 
    clientMsgId?: string,
    providedFileUrl?: string,
    providedFileName?: string,
    providedFileSize?: string,
    isForwarded: boolean = false,
    sourceMessageId?: number,
    replyToId?: number
  ) {
    console.log('DEBUG: sendMessage incoming:', { isEncrypted, isForwarded, sourceMessageId, replyToId });
    
    let fileUrl: string | null = providedFileUrl || null;
    let fileName: string | null = providedFileName || null;
    let fileSize: string | null = providedFileSize || null;

    if (file && !fileUrl) {
      const upload = await this.cloudinaryService.uploadFile(file, 'messages');
      fileUrl = upload.secure_url;
      fileName = file.originalname;
      fileSize = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
    }

    const chatRoom = await this.getOrCreateChatRoom(senderId, receiverId, senderId);
    
    const message = await this.prisma.message.create({
      data: {
        senderId,
        receiverId,
        message: content,
        fileUrl,
        fileName,
        fileSize,
        messageType: type,
        chatRoomId: chatRoom.id,
        isEncrypted,
        isForwarded,
        sourceMessageId,
        replyToId
      },
      include: {
        sender: true,
        receiver: true,
        replyTo: true
      }
    });

    // Notify receiver and sender via socket
    const socketPayload = {
      id: message.id.toString(),
      senderId: message.senderId.toString(),
      receiverId: message.receiverId.toString(),
      text: message.message,
      fileUrl: message.fileUrl,
      fileName: message.fileName,
      fileSize: message.fileSize,
      sidebarText: this.formatLastMessage(message),
      timestamp: this.formatTime(message.createdAt),
      status: message.status.toLowerCase(),
      messageType: message.messageType,
      isEncrypted: message.isEncrypted,
      isForwarded: message.isForwarded,
      createdAt: message.createdAt.toISOString(),
      clientMsgId,
      replyTo: message.replyTo ? {
        id: message.replyTo.id.toString(),
        senderId: message.replyTo.senderId.toString(),
        text: message.replyTo.deletedAt ? "🚫 deleted a message" : message.replyTo.message,
        messageType: message.replyTo.messageType,
        isEncrypted: message.replyTo.deletedAt ? false : message.replyTo.isEncrypted
      } : null,

      sender: {
        id: message.sender.id.toString(),
        name: message.sender.name || message.sender.username,
        username: message.sender.username,
        avatar: message.sender.avatar,
        online: message.sender.isOnline
      },
      receiver: {
        id: message.receiver.id.toString(),
        name: message.receiver.name || message.receiver.username,
        username: message.receiver.username,
        avatar: message.receiver.avatar,
        online: message.receiver.isOnline
      },
      reactions: []
    };

    const isBlocked = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: senderId, blockedId: receiverId, deletedAt: null },
          { blockerId: receiverId, blockedId: senderId, deletedAt: null }
        ]
      }
    });

    if (isBlocked) {
      throw new Error('You cannot send messages to this user.');
    }

    this.chatGateway.sendMessageToUser(receiverId, 'newMessage', socketPayload);
    this.chatGateway.sendMessageToUser(senderId, 'newMessage', socketPayload);

    return message;
  }

  async blockUser(blockerId: number, blockedId: number) {
    const existing = await this.prisma.block.findUnique({
      where: {
        blockerId_blockedId: { blockerId, blockedId }
      }
    });

    if (existing) {
      await this.prisma.block.update({
        where: { id: existing.id },
        data: { deletedAt: null }
      });
    } else {
      await this.prisma.block.create({
        data: { blockerId, blockedId }
      });
    }
    
    // Notify the other user
    this.chatGateway.sendMessageToUser(blockedId, 'userBlockStatus', {
      blockerId,
      isBlocked: true
    });
    
    return { success: true };
  }

  async unblockUser(blockerId: number, blockedId: number) {
    await this.prisma.block.updateMany({
      where: { blockerId, blockedId },
      data: { deletedAt: new Date() }
    });

    // Notify the other user
    this.chatGateway.sendMessageToUser(blockedId, 'userBlockStatus', {
      blockerId,
      isBlocked: false
    });

    return { success: true };
  }

  async acceptChatRequest(userId: number, otherId: number) {
    const chatRoomIdStr = [userId, otherId].sort((a, b) => a - b).join('_');
    
    const chatRoom = await this.prisma.chatRoom.findUnique({
      where: { chatRoomId: chatRoomIdStr }
    });

    if (!chatRoom) throw new Error('Chat room not found');

    await this.prisma.chatRoom.update({
      where: { id: chatRoom.id },
      data: { status: 'ACCEPTED' }
    });

    // Notify both the requester and the accepter
    const payload = {
      acceptedBy: userId.toString(),
      chatRoomId: chatRoomIdStr,
      status: 'ACCEPTED'
    };
    this.chatGateway.sendMessageToUser(otherId, 'chatRequestAccepted', payload);
    this.chatGateway.sendMessageToUser(userId, 'chatRequestAccepted', payload);

    return { success: true };
  }

  async getBlockStatus(user1Id: number, user2Id: number) {
    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: user1Id, blockedId: user2Id, deletedAt: null },
          { blockerId: user2Id, blockedId: user1Id, deletedAt: null }
        ]
      }
    });

    if (!block) return { isBlocked: false, blockedByMe: false };
    return {
      isBlocked: true,
      blockedByMe: block.blockerId === user1Id
    };
  }

  async getMessages(userId: number, otherUsername: string, cursor?: string, limit: number = 20) {
    const otherUser = await this.prisma.user.findUnique({
      where: { username: otherUsername }
    });

    if (!otherUser) return { messages: [], hasMore: false };

    const chatRoom = await this.getOrCreateChatRoom(userId, otherUser.id);

    const messages = await this.prisma.message.findMany({
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: Number(cursor) } : undefined,
      where: {
        chatRoomId: chatRoom.id,
      },
      orderBy: {
        id: 'desc'
      },
      include: {
        replyTo: true,
        reactions: true
      }
    });

    // Determine if there are more messages
    const nextCursor = messages.length === limit ? messages[messages.length - 1].id.toString() : null;

    // Reverse to maintain chronological order for the frontend
    const chronologicalMessages = [...messages].reverse();

    const blockStatus = await this.getBlockStatus(userId, otherUser.id);

    return {
      messages: chronologicalMessages.map(msg => {
        const isDeleted = !!msg.deletedAt;
        return {
          id: msg.id.toString(),
          senderId: msg.senderId.toString(),
          text: isDeleted ? "" : msg.message,
          fileUrl: isDeleted ? "" : msg.fileUrl,
          fileName: isDeleted ? "" : msg.fileName,
          fileSize: isDeleted ? "" : msg.fileSize,
          timestamp: this.formatTime(msg.createdAt),
          status: msg.status.toLowerCase(),
          messageType: isDeleted ? 'TEXT' : msg.messageType,
          isEncrypted: isDeleted ? false : msg.isEncrypted,
          isEdited: msg.isEdited,
          isForwarded: msg.isForwarded,
          isDeleted,
          createdAt: msg.createdAt.toISOString(),
          replyTo: msg.replyTo ? {
            id: msg.replyTo.id.toString(),
            senderId: msg.replyTo.senderId.toString(),
            text: msg.replyTo.deletedAt ? "🚫 deleted a message" : msg.replyTo.message,
            messageType: msg.replyTo.messageType,
            isEncrypted: msg.replyTo.deletedAt ? false : msg.replyTo.isEncrypted
          } : null,
          reactions: msg.reactions.map(r => ({
            userId: r.userId.toString(),
            emoji: r.emoji
          }))
        };
      }),

      chatStatus: chatRoom.status,
      requesterId: chatRoom.requesterId ? chatRoom.requesterId.toString() : null,
      nextCursor,
      hasMore: !!nextCursor,
      ...blockStatus
    };
  }

  private async getOrCreateChatRoom(user1Id: number, user2Id: number, requesterId?: number) {
    const chatRoomIdStr = [user1Id, user2Id].sort((a, b) => a - b).join('_');
    
    let chatRoom = await this.prisma.chatRoom.findUnique({
      where: { chatRoomId: chatRoomIdStr }
    });

    if (!chatRoom) {
      chatRoom = await this.prisma.chatRoom.create({
        data: { 
          chatRoomId: chatRoomIdStr,
          requesterId: requesterId || null,
          status: 'PENDING'
        }
      });
    } else if (!chatRoom.requesterId && requesterId) {
      // If room exists but no requester set (from old data), set it now
      chatRoom = await this.prisma.chatRoom.update({
        where: { id: chatRoom.id },
        data: { requesterId }
      });
    }

    return chatRoom;
  }

  private formatLastMessage(msg: any): string {
    if (msg.deletedAt) {
      return msg.isForwarded ? '🚫 Content unavailable' : '🚫 deleted a message';
    }
    const isForwarded = msg.isForwarded === true || msg.isForwarded === 'true';
    const prefix = isForwarded ? '↗️ Forwarded: ' : '';
    console.log(`DEBUG: formatLastMessage msgId=${msg.id}, isForwarded=${msg.isForwarded}, prefix='${prefix}'`);
    
    if (msg.isEncrypted && msg.message) {
      try {
        const parsed = JSON.parse(msg.message);
        if (parsed.c || parsed.text || parsed.iv) {
          // Return the raw encrypted string so the frontend can decrypt it
          return msg.message;
        }
      } catch (e) {
        // Not JSON, return as is
      }
    }

    if (msg.messageType === 'IMAGE') return prefix + '📷 Photo';
    if (msg.messageType === 'VIDEO') return prefix + '🎥 Video';
    if (msg.messageType === 'AUDIO') return prefix + '🎵 Audio';
    // Remove hardcoded "Call Log" to allow actual status (Missed call/No answer) to show
    if (msg.messageType === 'FILE') {
      const fileName = msg.fileName || '';
      if (fileName.toLowerCase().endsWith('.pdf')) return prefix + '📄 PDF Document';
      return prefix + '📄 File';
    }
    return prefix + (msg.message || '');
  }

  async getChatList(userId: number) {
    try {
      // Find all unique users this user has messaged with
      const messages = await this.prisma.message.findMany({
        where: {
          OR: [
            { senderId: userId },
            { receiverId: userId }
          ]
        },
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          sender: true,
          receiver: true
        }
      });

      const chatList: any[] = [];
      const seenUserIds = new Set();

      for (const msg of messages) {
        const otherUser = msg.senderId === userId ? msg.receiver : msg.sender;
        
        if (!seenUserIds.has(otherUser.id)) {
          seenUserIds.add(otherUser.id);
          
          const unreadCount = await this.prisma.message.count({
            where: {
              senderId: otherUser.id,
              receiverId: userId,
              status: 'UNSEEN',
              deletedAt: null
            }
          });

          const isMine = msg.senderId === userId;
          const displayMessage = this.formatLastMessage(msg);

          chatList.push({
            id: otherUser.id.toString(),
            name: otherUser.name || otherUser.username,
            username: otherUser.username,
            avatar: otherUser.avatar,
            lastMessage: displayMessage,
            lastMessageId: msg.id.toString(),
            lastMessageSenderId: msg.senderId.toString(),
            lastMessageTime: this.formatTime(msg.createdAt),
            lastMessageType: msg.messageType,
            online: otherUser.isOnline,
            unreadCount: unreadCount,
            isEncrypted: msg.deletedAt ? false : msg.isEncrypted,
            lastSeen: otherUser.lastSeen ? this.formatTime(otherUser.lastSeen) : null,
            ...(await this.getBlockStatus(userId, otherUser.id))
          });
        }
      }

      return chatList;
    } catch (error) {
      console.error('Error fetching chat list:', error.message);
      return [];
    }
  }

  async searchUsers(userId: number, query: string) {
    if (!query) return [];

    try {
      return await this.prisma.user.findMany({
        where: {
          id: { not: userId },
          OR: [
            { username: { contains: query } },
            { name: { contains: query } },
            { email: { contains: query } },
            { phone: { contains: query } },
          ],
          deletedAt: null
        },
        take: 20,
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
          isOnline: true,
          lastSeen: true,
        }
      });
    } catch (error) {
      console.error('Error searching users:', error.message);
      return [];
    }
  }

  async getUserByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        name: true,
        username: true,
        avatar: true,
        isOnline: true,
        lastSeen: true,
      }
    });
  }

  private formatTime(date: Date) {
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    return date.toLocaleDateString();
  }

  async markAsSeen(userId: number, otherUserId: number) {
    try {
      await this.prisma.message.updateMany({
        where: {
          senderId: otherUserId,
          receiverId: userId,
          status: 'UNSEEN',
        },
        data: {
          status: 'SEEN',
        },
      });

      // Notify the sender that their messages have been seen
      this.chatGateway.sendMessageToUser(otherUserId, 'messagesSeen', {
        seenBy: userId.toString(),
        chatId: userId.toString()
      });

      return { success: true };
    } catch (error) {
      console.error('Error marking messages as seen:', error.message);
      return { success: false };
    }
  }

  async searchMessages(userId: number, otherUsername: string, query: string) {
    if (!query || query.trim().length < 2) return [];

    const otherUser = await this.prisma.user.findUnique({
      where: { username: otherUsername }
    });

    if (!otherUser) return [];

    const chatRoom = await this.getOrCreateChatRoom(userId, otherUser.id);

    const messages = await this.prisma.message.findMany({
      where: {
        chatRoomId: chatRoom.id,
        message: {
          contains: query,
        },
        isEncrypted: false,
        deletedAt: null
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50
    });

    return messages.map(msg => ({
      id: msg.id.toString(),
      senderId: msg.senderId.toString(),
      text: msg.message,
      timestamp: this.formatTime(msg.createdAt),
      messageType: msg.messageType,
    }));
  }

  async getPublicKey(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { publicKey: true }
    });
    return user?.publicKey || null;
  }

  async updateMessage(userId: number, messageId: number, newContent: string) {
    try {
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
      });

      if (!message) throw new Error('Message not found');
      if (message.senderId !== userId) throw new Error('Unauthorized');

      // Check time constraint (15 seconds)
      const now = new Date();
      const diff = (now.getTime() - message.createdAt.getTime()) / 1000;
      if (diff > 15) {
        throw new Error('Messages can only be edited within 15 seconds.');
      }

      const updatedMessage = await this.prisma.message.update({
        where: { id: messageId },
        data: { 
          message: newContent,
          isEdited: true
        },
        include: {
          sender: true,
          receiver: true
        }
      });

      const socketPayload = {
        id: updatedMessage.id.toString(),
        senderId: updatedMessage.senderId.toString(),
        receiverId: updatedMessage.receiverId.toString(),
        text: updatedMessage.message,
        isEdited: true,
        createdAt: updatedMessage.createdAt.toISOString(),
        timestamp: this.formatTime(updatedMessage.createdAt),
        lastMessageId: updatedMessage.id.toString(),
        isEncrypted: updatedMessage.isEncrypted,
        sidebarText: this.formatLastMessage(updatedMessage)
      };

      this.chatGateway.sendMessageToUser(updatedMessage.receiverId, 'messageUpdated', socketPayload);
      this.chatGateway.sendMessageToUser(updatedMessage.senderId, 'messageUpdated', socketPayload);

      return { success: true, message: updatedMessage };
    } catch (error) {
      console.error('Error updating message:', error.message);
      throw error;
    }
  }

  async deleteMessage(userId: number, messageId: number) {
    try {
      const message = await this.prisma.message.findUnique({
        where: { id: messageId }
      });

      if (!message) throw new Error('Message not found');
      if (message.senderId !== userId) throw new Error('Unauthorized');

      await this.prisma.message.update({
        where: { id: messageId },
        data: { deletedAt: new Date() }
      });
      
      // Recursive function to delete message and all its forwards
      const deleteRecursive = async (msgId: number) => {
        // Find all immediate forwards
        const forwards = await this.prisma.message.findMany({
          where: { sourceMessageId: msgId },
          select: { id: true, senderId: true, receiverId: true }
        });

        // Delete them and notify
        for (const forward of forwards) {
          await this.prisma.message.update({
            where: { id: forward.id },
            data: { deletedAt: new Date() }
          });

          const forwardPayload = {
            id: forward.id.toString(),
            senderId: forward.senderId.toString(),
            receiverId: forward.receiverId.toString(),
            isDeleted: true,
            isEncrypted: false,
            sidebarText: '🚫 Content unavailable'
          };
          this.chatGateway.sendMessageToUser(forward.receiverId, 'messageDeleted', forwardPayload);
          this.chatGateway.sendMessageToUser(forward.senderId, 'messageDeleted', forwardPayload);

          // Recurse for the children of this forward
          await deleteRecursive(forward.id);
        }
      };

      // Start recursion from the current message
      await deleteRecursive(messageId);

      const socketPayload = {
        id: messageId.toString(),
        senderId: message.senderId.toString(),
        receiverId: message.receiverId.toString(),
        isDeleted: true,
        isEncrypted: false,
        sidebarText: message.isForwarded ? '🚫 Content unavailable' : '🚫 deleted a message'
      };

      this.chatGateway.sendMessageToUser(message.receiverId, 'messageDeleted', socketPayload);
      this.chatGateway.sendMessageToUser(message.senderId, 'messageDeleted', socketPayload);

      return { success: true };
    } catch (error) {
      console.error('Error deleting message:', error.message);
      throw error;
    }
  }

  async addReaction(userId: number, messageId: number, emoji: string) {
    try {
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
        select: { id: true, senderId: true, receiverId: true, chatRoomId: true }
      });

      if (!message) throw new Error('Message not found');

      // Find if reaction already exists
      const existing = await this.prisma.messageReaction.findFirst({
        where: { userId, messageId }
      });

      let result;
      if (existing) {
        if (existing.emoji === emoji) {
          // Remove if same emoji clicked again
          await this.prisma.messageReaction.delete({
            where: { id: existing.id }
          });
          result = { type: 'removed', emoji };
        } else {
          // Update to new emoji
          await this.prisma.messageReaction.update({
            where: { id: existing.id },
            data: { emoji }
          });
          result = { type: 'updated', emoji };
        }
      } else {
        // Create new
        await this.prisma.messageReaction.create({
          data: { userId, messageId, emoji }
        });
        result = { type: 'added', emoji };
      }

      // Notify users
      const socketPayload = {
        messageId: messageId.toString(),
        userId: userId.toString(),
        emoji: result.emoji,
        reactionType: result.type
      };

      this.chatGateway.sendMessageToUser(message.receiverId, 'messageReaction', socketPayload);
      this.chatGateway.sendMessageToUser(message.senderId, 'messageReaction', socketPayload);

      return result;
    } catch (error) {
      console.error('Error adding reaction:', error.message);
      throw error;
    }
  }
}



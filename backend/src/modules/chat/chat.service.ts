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

  async sendMessage(senderId: number, receiverId: number, content: string, type: MessageType, file?: Express.Multer.File, isEncrypted: boolean = false, clientMsgId?: string) {
    let fileUrl: string | null = null;
    let fileName: string | null = null;
    let fileSize: string | null = null;

    if (file) {
      const upload = await this.cloudinaryService.uploadFile(file, 'messages');
      fileUrl = upload.secure_url;
      fileName = file.originalname;
      fileSize = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
    }

    const chatRoom = await this.getOrCreateChatRoom(senderId, receiverId, senderId);
    
    // Check if the chat is accepted or if it's the very first message
    // Messenger allows the first message to be sent even if pending
    // But we should mark it as ACCEPTED if it was already accepted

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
      },
      include: {
        sender: true,
        receiver: true,
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
      clientMsgId,
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
      }
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

    // Notify the requester
    this.chatGateway.sendMessageToUser(otherId, 'chatRequestAccepted', {
      acceptedBy: userId,
      chatRoomId: chatRoomIdStr
    });

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
        deletedAt: null
      },
      orderBy: {
        id: 'desc'
      }
    });

    // Determine if there are more messages
    const nextCursor = messages.length === limit ? messages[messages.length - 1].id.toString() : null;

    // Reverse to maintain chronological order for the frontend
    const chronologicalMessages = [...messages].reverse();

    const blockStatus = await this.getBlockStatus(userId, otherUser.id);

    return {
      messages: chronologicalMessages.map(msg => ({
        id: msg.id.toString(),
        senderId: msg.senderId.toString(),
        text: msg.message,
        fileUrl: msg.fileUrl,
        fileName: msg.fileName,
        fileSize: msg.fileSize,
        timestamp: this.formatTime(msg.createdAt),
        status: msg.status.toLowerCase(),
        messageType: msg.messageType,
        isEncrypted: msg.isEncrypted,
      })),
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
    if (msg.messageType === 'IMAGE') return '📷 Photo';
    if (msg.messageType === 'VIDEO') return '🎥 Video';
    if (msg.messageType === 'AUDIO') return '🎵 Audio';
    if (msg.messageType === 'FILE') {
      const fileName = msg.fileName || '';
      if (fileName.toLowerCase().endsWith('.pdf')) return '📄 PDF Document';
      return '📄 File';
    }
    return msg.message || '';
  }

  async getChatList(userId: number) {
    try {
      // Find all unique users this user has messaged with
      const messages = await this.prisma.message.findMany({
        where: {
          OR: [
            { senderId: userId },
            { receiverId: userId }
          ],
          deletedAt: null
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

          chatList.push({
            id: otherUser.id.toString(),
            name: otherUser.name || otherUser.username,
            username: otherUser.username,
            avatar: otherUser.avatar,
            lastMessage: msg.isEncrypted ? msg.message : ((msg.senderId === userId ? "You: " : "") + this.formatLastMessage(msg)),
            lastMessageSenderId: msg.senderId.toString(),
            lastMessageTime: this.formatTime(msg.createdAt),
            online: otherUser.isOnline,
            unreadCount: unreadCount,
            isEncrypted: msg.isEncrypted,
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
}

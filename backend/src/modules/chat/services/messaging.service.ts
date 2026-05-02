import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ChatGateway } from '../gateways/chat.gateway';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { MessageType, Message } from '@prisma/client';
import { IMessagingService } from '../interfaces/chat-service.interface';
import { RoomService } from './room.service';
import { BlockService } from './block.service';

/**
 * Service responsible for handling all message-related operations.
 * Implements the IMessagingService interface.
 */
@Injectable()
export class MessagingService implements IMessagingService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
    private cloudinaryService: CloudinaryService,
    private roomService: RoomService,
    private blockService: BlockService,
  ) {}

  /**
   * Sends a new message between users.
   * Handles file uploads, room retrieval, persistence, and real-time socket notifications.
   * @throws Error if the sender is blocked by the receiver or vice-versa.
   */
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
    const isBlocked = await this.blockService.checkBlockStatus(senderId, receiverId);
    if (isBlocked) {
      throw new Error('You cannot send messages to this user.');
    }

    let fileUrl: string | null = providedFileUrl || null;
    let fileName: string | null = providedFileName || null;
    let fileSize: string | null = providedFileSize || null;

    if (file && !fileUrl) {
      const upload = await this.cloudinaryService.uploadFile(file, 'messages');
      fileUrl = upload.secure_url;
      fileName = file.originalname;
      fileSize = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
    }

    const chatRoom = await this.roomService.getOrCreateChatRoom(senderId, receiverId, senderId);
    
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

    this.chatGateway.sendMessageToUser(receiverId, 'newMessage', socketPayload);
    this.chatGateway.sendMessageToUser(senderId, 'newMessage', socketPayload);

    return message;
  }

  /**
   * Retrieves message history for a specific conversation with pagination support.
   * Reverses the order to maintain chronological sequence for the client.
   */
  async getMessages(userId: number, otherUsername: string, cursor?: string, limit: number = 20) {
    const otherUser = await this.prisma.user.findUnique({
      where: { username: otherUsername }
    });

    if (!otherUser) return { messages: [], hasMore: false };

    const chatRoom = await this.roomService.getOrCreateChatRoom(userId, otherUser.id);

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

    const nextCursor = messages.length === limit ? messages[messages.length - 1].id.toString() : null;
    const chronologicalMessages = [...messages].reverse();
    const blockStatus = await this.blockService.getBlockDetails(userId, otherUser.id);

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

  /**
   * Updates an existing message's content.
   * Enforcement: Messages can only be edited within a 15-second window by the original sender.
   */
  async updateMessage(userId: number, messageId: number, newContent: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) throw new Error('Message not found');
    if (message.senderId !== userId) throw new Error('Unauthorized');

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
  }

  /**
   * Marks a message as deleted (soft delete).
   * Automatically triggers recursive deletion for any forwarded instances of this message.
   */
  async deleteMessage(userId: number, messageId: number) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId }
    });

    if (!message) throw new Error('Message not found');
    if (message.senderId !== userId) throw new Error('Unauthorized');

    await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() }
    });
    
    const deleteRecursive = async (msgId: number) => {
      const forwards = await this.prisma.message.findMany({
        where: { sourceMessageId: msgId },
        select: { id: true, senderId: true, receiverId: true }
      });

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
        await deleteRecursive(forward.id);
      }
    };

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
  }

  /**
   * Marks all unseen messages in a conversation as seen.
   * Notifies the original sender via real-time socket events.
   */
  async markSeen(userId: number, otherUserId: number) {
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

    this.chatGateway.sendMessageToUser(otherUserId, 'messagesSeen', {
      seenBy: userId.toString(),
      chatId: userId.toString()
    });

    return { success: true };
  }

  async searchMessages(userId: number, otherUsername: string, query: string) {
    if (!query || query.trim().length < 2) return [];

    const otherUser = await this.prisma.user.findUnique({
      where: { username: otherUsername }
    });

    if (!otherUser) return [];

    const chatRoom = await this.roomService.getOrCreateChatRoom(userId, otherUser.id);

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

  /**
   * Adds or toggles a reaction emoji on a specific message.
   * Removes the reaction if the same emoji is clicked again.
   */
  async addReaction(userId: number, messageId: number, emoji: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, senderId: true, receiverId: true, chatRoomId: true }
    });

    if (!message) throw new Error('Message not found');

    const existing = await this.prisma.messageReaction.findFirst({
      where: { userId, messageId }
    });

    let result;
    if (existing) {
      if (existing.emoji === emoji) {
        await this.prisma.messageReaction.delete({
          where: { id: existing.id }
        });
        result = { type: 'removed', emoji };
      } else {
        await this.prisma.messageReaction.update({
          where: { id: existing.id },
          data: { emoji }
        });
        result = { type: 'updated', emoji };
      }
    } else {
      await this.prisma.messageReaction.create({
        data: { userId, messageId, emoji }
      });
      result = { type: 'added', emoji };
    }

    const socketPayload = {
      messageId: messageId.toString(),
      userId: userId.toString(),
      emoji: result.emoji,
      reactionType: result.type
    };

    this.chatGateway.sendMessageToUser(message.receiverId, 'messageReaction', socketPayload);
    this.chatGateway.sendMessageToUser(message.senderId, 'messageReaction', socketPayload);

    return result;
  }

  /**
   * Formats the last message text for the sidebar preview based on message type and state.
   */
  public formatLastMessage(msg: any): string {
    if (msg.deletedAt) {
      return msg.isForwarded ? '🚫 Content unavailable' : '🚫 deleted a message';
    }
    const isForwarded = msg.isForwarded === true || msg.isForwarded === 'true';
    const prefix = isForwarded ? '↗️ Forwarded: ' : '';
    
    if (msg.isEncrypted && msg.message) {
      try {
        const parsed = JSON.parse(msg.message);
        if (parsed.c || parsed.text || parsed.iv) {
          return msg.message;
        }
      } catch (e) {}
    }

    if (msg.messageType === 'IMAGE') return prefix + '📷 Photo';
    if (msg.messageType === 'VIDEO') return prefix + '🎥 Video';
    if (msg.messageType === 'AUDIO') return prefix + '🎵 Audio';
    if (msg.messageType === 'FILE') {
      const fileName = msg.fileName || '';
      if (fileName.toLowerCase().endsWith('.pdf')) return prefix + '📄 PDF Document';
      return prefix + '📄 File';
    }
    return prefix + (msg.message || '');
  }

  /**
   * Formats date/time for display (e.g., "10:30 AM", "Yesterday", or date).
   */
  public formatTime(date: Date) {
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
}

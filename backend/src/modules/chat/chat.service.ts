import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { MessageType } from '@prisma/client';
import { MessagingService } from './services/messaging.service';
import { BlockService } from './services/block.service';
import { RoomService } from './services/room.service';

/**
 * Facade service for chat operations.
 * Coordinates between Messaging, Block, and Room services to provide a unified API for the controller.
 */
@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
    private messagingService: MessagingService,
    private blockService: BlockService,
    private roomService: RoomService,
  ) {}

  /**
   * Uploads a file to Cloudinary and returns metadata.
   */
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
    return this.messagingService.sendMessage(
      senderId, receiverId, content, type, file, isEncrypted, clientMsgId, 
      providedFileUrl, providedFileName, providedFileSize, isForwarded, sourceMessageId, replyToId
    );
  }

  async blockUser(blockerId: number, blockedId: number) {
    return this.blockService.blockUser(blockerId, blockedId);
  }

  async unblockUser(blockerId: number, blockedId: number) {
    return this.blockService.unblockUser(blockerId, blockedId);
  }

  async acceptChatRequest(userId: number, otherId: number) {
    return this.roomService.acceptChatRequest(userId, otherId);
  }

  async getMessages(userId: number, otherUsername: string, cursor?: string, limit: number = 20) {
    return this.messagingService.getMessages(userId, otherUsername, cursor, limit);
  }

  /**
   * Retrieves the chat list (conversations) for a user.
   * Optimized to fetch only the latest message per room.
   */
  async getChatList(userId: number) {
    try {
      const chatRooms = await this.prisma.chatRoom.findMany({
        where: {
          OR: [
            { chatRoomId: { startsWith: `${userId}_` } },
            { chatRoomId: { endsWith: `_${userId}` } }
          ],
          deletedAt: null
        },
        include: {
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: { sender: true, receiver: true }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });

      const chatList: any[] = [];

      for (const room of chatRooms) {
        const lastMsg = room.messages[0];
        if (!lastMsg) continue;

        const otherUser = lastMsg.senderId === userId ? lastMsg.receiver : lastMsg.sender;
        
        const unreadCount = await this.prisma.message.count({
          where: {
            senderId: otherUser.id,
            receiverId: userId,
            status: 'UNSEEN',
            deletedAt: null
          }
        });

        const displayMessage = this.messagingService.formatLastMessage(lastMsg);

        chatList.push({
          id: otherUser.id.toString(),
          name: otherUser.name || otherUser.username,
          username: otherUser.username,
          avatar: otherUser.avatar,
          lastMessage: displayMessage,
          lastMessageId: lastMsg.id.toString(),
          lastMessageSenderId: lastMsg.senderId.toString(),
          lastMessageTime: this.messagingService.formatTime(lastMsg.createdAt),
          lastMessageType: lastMsg.messageType,
          online: otherUser.isOnline,
          unreadCount: unreadCount,
          isEncrypted: lastMsg.deletedAt ? false : lastMsg.isEncrypted,
          lastSeen: otherUser.lastSeen ? this.messagingService.formatTime(otherUser.lastSeen) : null,
          ...(await this.blockService.getBlockDetails(userId, otherUser.id))
        });
      }

      return chatList;
    } catch (error) {
      console.error('Error fetching chat list:', error.message);
      return [];
    }
  }

  /**
   * Searches for users by username, name, email, or phone.
   */
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
          id: true, name: true, username: true, avatar: true, isOnline: true, lastSeen: true,
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
        id: true, name: true, username: true, avatar: true, isOnline: true, lastSeen: true,
      }
    });
  }

  async markAsSeen(userId: number, otherUserId: number) {
    return this.messagingService.markSeen(userId, otherUserId);
  }

  async searchMessages(userId: number, otherUsername: string, query: string) {
    return this.messagingService.searchMessages(userId, otherUsername, query);
  }

  /**
   * Retrieves a user's public key for E2EE messaging.
   */
  async getPublicKey(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { publicKey: true }
    });
    return user?.publicKey || null;
  }

  async updateMessage(userId: number, messageId: number, newContent: string) {
    return this.messagingService.updateMessage(userId, messageId, newContent);
  }

  async deleteMessage(userId: number, messageId: number) {
    return this.messagingService.deleteMessage(userId, messageId);
  }

  async addReaction(userId: number, messageId: number, emoji: string) {
    return this.messagingService.addReaction(userId, messageId, emoji);
  }
}

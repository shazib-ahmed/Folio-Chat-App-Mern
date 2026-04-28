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

  async sendMessage(senderId: number, receiverId: number, content: string, type: MessageType, file?: Express.Multer.File) {
    let fileUrl: string | null = null;
    let fileName: string | null = null;
    let fileSize: string | null = null;

    if (file) {
      const upload = await this.cloudinaryService.uploadFile(file, 'messages');
      fileUrl = upload.secure_url;
      fileName = file.originalname;
      fileSize = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
    }

    const chatRoom = await this.getOrCreateChatRoom(senderId, receiverId);

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
      status: message.status,
      messageType: message.messageType,
    };

    this.chatGateway.sendMessageToUser(receiverId, 'newMessage', socketPayload);
    this.chatGateway.sendMessageToUser(senderId, 'newMessage', socketPayload);

    return message;
  }

  async getMessages(userId: number, otherUsername: string) {
    const otherUser = await this.prisma.user.findUnique({
      where: { username: otherUsername }
    });

    if (!otherUser) return [];

    const chatRoom = await this.getOrCreateChatRoom(userId, otherUser.id);

    const messages = await this.prisma.message.findMany({
      where: {
        chatRoomId: chatRoom.id,
        deletedAt: null
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    return messages.map(msg => ({
      id: msg.id.toString(),
      senderId: msg.senderId.toString(),
      text: msg.message,
      timestamp: this.formatTime(msg.createdAt),
      status: msg.status.toLowerCase(),
      messageType: msg.messageType,
    }));
  }

  private async getOrCreateChatRoom(user1Id: number, user2Id: number) {
    const chatRoomIdStr = [user1Id, user2Id].sort((a, b) => a - b).join('_');
    
    let chatRoom = await this.prisma.chatRoom.findUnique({
      where: { chatRoomId: chatRoomIdStr }
    });

    if (!chatRoom) {
      chatRoom = await this.prisma.chatRoom.create({
        data: { chatRoomId: chatRoomIdStr }
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
            lastMessage: (msg.senderId === userId ? "You: " : "") + this.formatLastMessage(msg),
            lastMessageTime: this.formatTime(msg.createdAt),
            online: otherUser.isOnline,
            unreadCount: unreadCount,
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
}

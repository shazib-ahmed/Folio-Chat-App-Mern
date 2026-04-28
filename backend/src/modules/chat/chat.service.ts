import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

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
            id: otherUser.username,
            name: otherUser.name || otherUser.username,
            username: otherUser.username,
            avatar: otherUser.avatar,
            lastMessage: msg.message,
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
}

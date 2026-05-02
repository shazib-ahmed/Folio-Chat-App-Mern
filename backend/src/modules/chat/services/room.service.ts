import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ChatGateway } from '../gateways/chat.gateway';
import { IRoomService } from '../interfaces/chat-service.interface';

/**
 * Service for managing chat room lifecycles and metadata.
 */
@Injectable()
export class RoomService implements IRoomService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
  ) {}

  /**
   * Retrieves an existing chat room or creates a new one for two users.
   * Room IDs are deterministic (sorted user IDs joined by underscore).
   */
  async getOrCreateChatRoom(user1Id: number, user2Id: number, requesterId?: number) {
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
      chatRoom = await this.prisma.chatRoom.update({
        where: { id: chatRoom.id },
        data: { requesterId }
      });
    }

    return chatRoom;
  }

  /**
   * Accepts a pending chat request and transitions the room status to 'ACCEPTED'.
   * Notifies both participants via real-time socket events.
   */
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

    const payload = {
      acceptedBy: userId.toString(),
      chatRoomId: chatRoomIdStr,
      status: 'ACCEPTED'
    };
    this.chatGateway.sendMessageToUser(otherId, 'chatRequestAccepted', payload);
    this.chatGateway.sendMessageToUser(userId, 'chatRequestAccepted', payload);

    return { success: true };
  }
}

import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ChatGateway } from '../gateways/chat.gateway';
import { IBlockService } from '../interfaces/chat-service.interface';

/**
 * Service for managing user block relationships.
 */
@Injectable()
export class BlockService implements IBlockService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
  ) {}

  /**
   * Blocks a user and notifies them via socket.
   */
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
    
    this.chatGateway.sendMessageToUser(blockedId, 'userBlockStatus', {
      blockerId,
      isBlocked: true
    });
    
    return { success: true };
  }

  /**
   * Unblocks a user and notifies them via socket.
   */
  async unblockUser(blockerId: number, blockedId: number) {
    await this.prisma.block.updateMany({
      where: { blockerId, blockedId },
      data: { deletedAt: new Date() }
    });

    this.chatGateway.sendMessageToUser(blockedId, 'userBlockStatus', {
      blockerId,
      isBlocked: false
    });

    return { success: true };
  }

  /**
   * Checks if a block relationship exists between two users in either direction.
   */
  async checkBlockStatus(user1Id: number, user2Id: number): Promise<boolean> {
    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: user1Id, blockedId: user2Id, deletedAt: null },
          { blockerId: user2Id, blockedId: user1Id, deletedAt: null }
        ]
      }
    });
    return !!block;
  }

  /**
   * Gets detailed block information, including whether the block was initiated by the requester.
   */
  async getBlockDetails(user1Id: number, user2Id: number) {
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
}

import { Test, TestingModule } from '@nestjs/testing';
import { BlockService } from './block.service';
import { PrismaService } from '../../../database/prisma.service';
import { ChatGateway } from '../gateways/chat.gateway';

describe('BlockService', () => {
  let service: BlockService;
  let prisma: PrismaService;
  let chatGateway: ChatGateway;

  const mockPrisma = {
    block: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockChatGateway = {
    sendMessageToUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ChatGateway, useValue: mockChatGateway },
      ],
    }).compile();

    service = module.get<BlockService>(BlockService);
    prisma = module.get<PrismaService>(PrismaService);
    chatGateway = module.get<ChatGateway>(ChatGateway);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('blockUser', () => {
    it('should create a new block if none exists', async () => {
      mockPrisma.block.findUnique.mockResolvedValue(null);
      
      const result = await service.blockUser(1, 2);

      expect(result.success).toBe(true);
      expect(prisma.block.create).toHaveBeenCalledWith({
        data: { blockerId: 1, blockedId: 2 }
      });
      expect(chatGateway.sendMessageToUser).toHaveBeenCalledWith(2, 'userBlockStatus', {
        blockerId: 1,
        isBlocked: true
      });
    });

    it('should restore an existing soft-deleted block', async () => {
      mockPrisma.block.findUnique.mockResolvedValue({ id: 10, deletedAt: new Date() });
      
      await service.blockUser(1, 2);

      expect(prisma.block.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { deletedAt: null }
      });
    });
  });

  describe('unblockUser', () => {
    it('should soft delete the block relationship', async () => {
      const result = await service.unblockUser(1, 2);

      expect(result.success).toBe(true);
      expect(prisma.block.updateMany).toHaveBeenCalledWith({
        where: { blockerId: 1, blockedId: 2 },
        data: { deletedAt: expect.any(Date) }
      });
      expect(chatGateway.sendMessageToUser).toHaveBeenCalledWith(2, 'userBlockStatus', {
        blockerId: 1,
        isBlocked: false
      });
    });
  });

  describe('checkBlockStatus', () => {
    it('should return true if either user blocked the other', async () => {
      mockPrisma.block.findFirst.mockResolvedValue({ id: 1 });
      const result = await service.checkBlockStatus(1, 2);
      expect(result).toBe(true);
    });

    it('should return false if no active block exists', async () => {
      mockPrisma.block.findFirst.mockResolvedValue(null);
      const result = await service.checkBlockStatus(1, 2);
      expect(result).toBe(false);
    });
  });
});

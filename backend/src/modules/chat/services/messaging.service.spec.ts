import { Test, TestingModule } from '@nestjs/testing';
import { MessagingService } from './messaging.service';
import { PrismaService } from '../../../database/prisma.service';
import { ChatGateway } from '../gateways/chat.gateway';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { RoomService } from './room.service';
import { BlockService } from './block.service';
import { MessageType } from '@prisma/client';

describe('MessagingService', () => {
  let service: MessagingService;
  let prisma: PrismaService;
  let chatGateway: ChatGateway;
  let roomService: RoomService;
  let blockService: BlockService;

  const mockPrisma = {
    message: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    messageReaction: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    }
  };

  const mockChatGateway = {
    sendMessageToUser: jest.fn(),
  };

  const mockCloudinaryService = {
    uploadFile: jest.fn(),
  };

  const mockRoomService = {
    getOrCreateChatRoom: jest.fn(),
  };

  const mockBlockService = {
    checkBlockStatus: jest.fn(),
    getBlockDetails: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ChatGateway, useValue: mockChatGateway },
        { provide: CloudinaryService, useValue: mockCloudinaryService },
        { provide: RoomService, useValue: mockRoomService },
        { provide: BlockService, useValue: mockBlockService },
      ],
    }).compile();

    service = module.get<MessagingService>(MessagingService);
    prisma = module.get<PrismaService>(PrismaService);
    chatGateway = module.get<ChatGateway>(ChatGateway);
    roomService = module.get<RoomService>(RoomService);
    blockService = module.get<BlockService>(BlockService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendMessage', () => {
    it('should throw error if user is blocked', async () => {
      mockBlockService.checkBlockStatus.mockResolvedValue(true);
      mockRoomService.getOrCreateChatRoom.mockResolvedValue({ id: 1 });

      await expect(service.sendMessage(1, 2, 'hello', MessageType.TEXT))
        .rejects.toThrow('You cannot send messages to this user.');
    });

    it('should create and send a new message if not blocked', async () => {
      mockBlockService.checkBlockStatus.mockResolvedValue(false);
      mockRoomService.getOrCreateChatRoom.mockResolvedValue({ id: 1 });
      
      const mockMessage = {
        id: 101,
        senderId: 1,
        receiverId: 2,
        message: 'hello',
        createdAt: new Date(),
        status: 'UNSEEN',
        messageType: 'TEXT',
        sender: { id: 1, username: 'user1', isOnline: true },
        receiver: { id: 2, username: 'user2', isOnline: true },
      };
      
      mockPrisma.message.create.mockResolvedValue(mockMessage);

      const result = await service.sendMessage(1, 2, 'hello', MessageType.TEXT);

      expect(result).toEqual(mockMessage);
      expect(prisma.message.create).toHaveBeenCalled();
      expect(chatGateway.sendMessageToUser).toHaveBeenCalledWith(2, 'newMessage', expect.any(Object));
    });
  });

  describe('updateMessage', () => {
    it('should update message content if within 15 seconds', async () => {
      const now = new Date();
      const mockMessage = {
        id: 101,
        senderId: 1,
        receiverId: 2,
        message: 'old content',
        createdAt: now,
      };

      mockPrisma.message.findUnique.mockResolvedValue(mockMessage);
      mockPrisma.message.update.mockResolvedValue({
        ...mockMessage,
        message: 'new content',
        isEdited: true,
        sender: { id: 1, name: 'user1' },
        receiver: { id: 2, name: 'user2' }
      });

      const result = await service.updateMessage(1, 101, 'new content');

      expect(result.success).toBe(true);
      expect(prisma.message.update).toHaveBeenCalledWith({
        where: { id: 101 },
        data: { message: 'new content', isEdited: true },
        include: { sender: true, receiver: true }
      });
    });

    it('should throw error if more than 15 seconds passed', async () => {
      const longAgo = new Date(Date.now() - 20000);
      mockPrisma.message.findUnique.mockResolvedValue({
        id: 101,
        senderId: 1,
        createdAt: longAgo,
      });

      await expect(service.updateMessage(1, 101, 'new content'))
        .rejects.toThrow('Messages can only be edited within 15 seconds.');
    });
  });

  describe('deleteMessage', () => {
    it('should soft delete a message and its forwards', async () => {
      const mockMessage = { id: 101, senderId: 1, receiverId: 2 };
      mockPrisma.message.findUnique.mockResolvedValue(mockMessage);
      mockPrisma.message.findMany.mockResolvedValue([]); // No forwards

      const result = await service.deleteMessage(1, 101);

      expect(result.success).toBe(true);
      expect(prisma.message.update).toHaveBeenCalledWith({
        where: { id: 101 },
        data: { deletedAt: expect.any(Date) }
      });
    });
  });

  describe('markSeen', () => {
    it('should mark messages as seen and notify sender', async () => {
      mockPrisma.message.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markSeen(1, 2);

      expect(result.success).toBe(true);
      expect(prisma.message.updateMany).toHaveBeenCalledWith({
        where: { senderId: 2, receiverId: 1, status: 'UNSEEN' },
        data: { status: 'SEEN' }
      });
      expect(chatGateway.sendMessageToUser).toHaveBeenCalledWith(2, 'messagesSeen', expect.any(Object));
    });
  });
});

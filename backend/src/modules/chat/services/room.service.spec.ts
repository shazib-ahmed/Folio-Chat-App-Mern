import { Test, TestingModule } from '@nestjs/testing';
import { RoomService } from './room.service';
import { PrismaService } from '../../../database/prisma.service';
import { ChatGateway } from '../gateways/chat.gateway';

describe('RoomService', () => {
  let service: RoomService;
  let prisma: PrismaService;
  let chatGateway: ChatGateway;

  const mockPrisma = {
    chatRoom: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockChatGateway = {
    sendMessageToUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ChatGateway, useValue: mockChatGateway },
      ],
    }).compile();

    service = module.get<RoomService>(RoomService);
    prisma = module.get<PrismaService>(PrismaService);
    chatGateway = module.get<ChatGateway>(ChatGateway);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrCreateChatRoom', () => {
    it('should return existing room if it exists', async () => {
      const mockRoom = { id: 1, chatRoomId: '1_2' };
      mockPrisma.chatRoom.findUnique.mockResolvedValue(mockRoom);

      const result = await service.getOrCreateChatRoom(1, 2);

      expect(result).toEqual(mockRoom);
      expect(prisma.chatRoom.create).not.toHaveBeenCalled();
    });

    it('should create a new room if it does not exist', async () => {
      mockPrisma.chatRoom.findUnique.mockResolvedValue(null);
      const mockRoom = { id: 1, chatRoomId: '1_2' };
      mockPrisma.chatRoom.create.mockResolvedValue(mockRoom);

      const result = await service.getOrCreateChatRoom(1, 2, 1);

      expect(result).toEqual(mockRoom);
      expect(prisma.chatRoom.create).toHaveBeenCalledWith({
        data: {
          chatRoomId: '1_2',
          requesterId: 1,
          status: 'PENDING'
        }
      });
    });
  });

  describe('acceptChatRequest', () => {
    it('should update status and notify participants', async () => {
      const mockRoom = { id: 1, chatRoomId: '1_2' };
      mockPrisma.chatRoom.findUnique.mockResolvedValue(mockRoom);

      const result = await service.acceptChatRequest(1, 2);

      expect(result.success).toBe(true);
      expect(prisma.chatRoom.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'ACCEPTED' }
      });
      expect(chatGateway.sendMessageToUser).toHaveBeenCalledWith(2, 'chatRequestAccepted', expect.any(Object));
    });
  });
});

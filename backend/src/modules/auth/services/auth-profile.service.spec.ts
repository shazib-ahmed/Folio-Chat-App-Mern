import { Test, TestingModule } from '@nestjs/testing';
import { AuthProfileService } from './auth-profile.service';
import { PrismaService } from '../../../database/prisma.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import * as bcrypt from 'bcrypt';

describe('AuthProfileService', () => {
  let service: AuthProfileService;
  let prisma: PrismaService;
  let cloudinary: CloudinaryService;

  const mockPrisma = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockCloudinaryService = {
    uploadFile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthProfileService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CloudinaryService, useValue: mockCloudinaryService },
      ],
    }).compile();

    service = module.get<AuthProfileService>(AuthProfileService);
    prisma = module.get<PrismaService>(PrismaService);
    cloudinary = module.get<CloudinaryService>(CloudinaryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateProfile', () => {
    it('should update profile data and upload avatar if provided', async () => {
      const mockFile = { originalname: 'avatar.png' } as any;
      mockCloudinaryService.uploadFile.mockResolvedValue({ secure_url: 'http://new-avatar.com' });
      mockPrisma.user.findFirst.mockResolvedValue(null); // No conflicts
      mockPrisma.user.update.mockResolvedValue({ id: 1, username: 'test' });

      const result = await service.updateProfile(1, { name: 'New Name' }, mockFile);

      expect(result).toBeDefined();
      expect(cloudinary.uploadFile).toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: 'New Name', avatar: 'http://new-avatar.com' }
      });
    });

    it('should throw ConflictException if email is already taken', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 2 }); // Other user has this email
      
      await expect(service.updateProfile(1, { email: 'taken@test.com' }))
        .rejects.toThrow('Email already exists');
    });
  });

  describe('updatePassword', () => {
    it('should hash and save new password if old one is correct', async () => {
      const oldPassword = 'old';
      const hashedPassword = await bcrypt.hash(oldPassword, 10);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, password: hashedPassword });

      const result = await service.updatePassword(1, { oldPassword: 'old', newPassword: 'new' });

      expect(result.message).toBe('Password updated successfully');
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('should throw error if old password is wrong', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, password: 'wrong_hash' });

      await expect(service.updatePassword(1, { oldPassword: 'old', newPassword: 'new' }))
        .rejects.toThrow('Invalid old password');
    });
  });
});

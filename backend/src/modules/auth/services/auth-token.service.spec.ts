import { Test, TestingModule } from '@nestjs/testing';
import { AuthTokenService } from './auth-token.service';
import { PrismaService } from '../../../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

describe('AuthTokenService', () => {
  let service: AuthTokenService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const mockPrisma = {
    user: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const mockConfigService = {
    getOrThrow: jest.fn().mockReturnValue('secret'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthTokenService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthTokenService>(AuthTokenService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTokens', () => {
    it('should generate access and refresh tokens', async () => {
      mockJwtService.signAsync
        .mockResolvedValueOnce('access_token')
        .mockResolvedValueOnce('refresh_token');

      const result = await service.getTokens(1, 'testuser');

      expect(result).toEqual({
        access_token: 'access_token',
        refresh_token: 'refresh_token',
      });
      expect(mockJwtService.signAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe('refreshTokens', () => {
    it('should validate refresh token and return new tokens', async () => {
      const refreshToken = 'valid_refresh_token';
      const hashedToken = await bcrypt.hash(refreshToken, 10);
      
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 1 });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        username: 'testuser',
        refreshToken: hashedToken
      });
      
      mockJwtService.signAsync
        .mockResolvedValueOnce('new_access_token')
        .mockResolvedValueOnce('new_refresh_token');

      const result = await service.refreshTokens(refreshToken);

      expect(result.access_token).toBe('new_access_token');
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if tokens do not match', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 1 });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        refreshToken: 'different_hash'
      });

      await expect(service.refreshTokens('token'))
        .rejects.toThrow('Invalid refresh token');
    });
  });
});

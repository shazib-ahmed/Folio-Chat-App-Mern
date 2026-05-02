import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import * as bcrypt from 'bcrypt';
import { AuthTokenService } from './services/auth-token.service';
import { AuthProfileService } from './services/auth-profile.service';

/**
 * Core authentication service.
 * Handles user registration, login, and coordinates token/profile management.
 */
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private tokenService: AuthTokenService,
    private profileService: AuthProfileService,
  ) {}

  /**
   * Registers a new user and returns access/refresh tokens.
   * @throws ConflictException if email, username, or phone already exists.
   */
  async register(dto: RegisterDto) {
    const existingEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingEmail) throw new ConflictException('Email already exists');

    const existingUsername = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (existingUsername) throw new ConflictException('Username already taken');

    if (dto.phone) {
      const existingPhone = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
      if (existingPhone) throw new ConflictException('Phone number already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        ...dto,
        password: hashedPassword,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${dto.username}`,
      },
    });

    const tokens = await this.tokenService.getTokens(user.id, user.username);
    await this.tokenService.updateRefreshToken(user.id, tokens.refresh_token);

    const { password, refreshToken, ...userWithoutPassword } = user;
    return { ...tokens, user: userWithoutPassword };
  }

  /**
   * Authenticates a user and returns access/refresh tokens.
   * Supports login via email, username, or phone.
   * @throws UnauthorizedException for invalid credentials.
   */
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.identifier },
          { username: dto.identifier },
          { phone: dto.identifier },
        ],
      },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.tokenService.getTokens(user.id, user.username);
    await this.tokenService.updateRefreshToken(user.id, tokens.refresh_token);

    const { password, refreshToken, ...userWithoutPassword } = user;
    return { ...tokens, user: userWithoutPassword };
  }

  /**
   * Invalidates the user's refresh token on logout.
   */
  async logout(userId: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  async refreshTokens(refreshToken: string) {
    return this.tokenService.refreshTokens(refreshToken);
  }

  async updateProfile(userId: number, dto: UpdateProfileDto, file?: Express.Multer.File) {
    return this.profileService.updateProfile(userId, dto, file);
  }

  async updatePassword(userId: number, dto: UpdatePasswordDto) {
    return this.profileService.updatePassword(userId, dto);
  }

  async updatePublicKey(userId: number, publicKey: string) {
    return this.profileService.updatePublicKey(userId, publicKey);
  }
}

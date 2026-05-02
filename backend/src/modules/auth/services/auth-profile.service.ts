import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UpdatePasswordDto } from '../dto/update-password.dto';
import * as bcrypt from 'bcrypt';
import { IAuthProfileService } from '../interfaces/auth-service.interface';

/**
 * Service for managing user profile information, passwords, and public keys.
 */
@Injectable()
export class AuthProfileService implements IAuthProfileService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  /**
   * Updates user profile data.
   * Handles avatar upload to Cloudinary and uniqueness checks for email/username/phone.
   * @throws ConflictException if new email/username/phone is already taken.
   */
  async updateProfile(userId: number, dto: UpdateProfileDto, file?: Express.Multer.File) {
    if (file) {
      try {
        const upload = await this.cloudinary.uploadFile(file, 'users');
        dto.avatar = upload.secure_url;
      } catch (error) {
        console.error('Failed to upload avatar to Cloudinary:', error);
      }
    } else if (dto.avatar && typeof dto.avatar !== 'string') {
      delete dto.avatar;
    }

    if (dto.email) {
      const existingEmail = await this.prisma.user.findFirst({
        where: { email: dto.email, id: { not: userId } },
      });
      if (existingEmail) throw new ConflictException('Email already exists');
    }

    if (dto.username) {
      const existingUsername = await this.prisma.user.findFirst({
        where: { username: dto.username, id: { not: userId } },
      });
      if (existingUsername) throw new ConflictException('Username already taken');
    }

    if (dto.phone) {
      const existingPhone = await this.prisma.user.findFirst({
        where: { phone: dto.phone, id: { not: userId } },
      });
      if (existingPhone) throw new ConflictException('Phone number already exists');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });

    const { password, refreshToken, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  /**
   * Updates user password after verifying the old password.
   * @throws UnauthorizedException if old password is incorrect or user not found.
   */
  async updatePassword(userId: number, dto: UpdatePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new UnauthorizedException('User not found');

    const isPasswordValid = await bcrypt.compare(dto.oldPassword, user.password);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid old password');

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Password updated successfully' };
  }

  /**
   * Updates the user's public key used for End-to-End Encryption (E2EE).
   */
  async updatePublicKey(userId: number, publicKey: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { publicKey },
    });
  }
}

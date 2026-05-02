import { Body, Controller, Post, HttpCode, HttpStatus, UseInterceptors, UseGuards, Req, Patch, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import * as express from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Req() req: express.Request) {
    const user = req.user as any;
    return this.authService.logout(user.userId);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  /**
   * Updates the user's profile information and avatar.
   */
  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  @UseInterceptors(FileInterceptor('avatar'))
  updateProfile(
    @Req() req: express.Request, 
    @Body() dto: UpdateProfileDto,
    @UploadedFile() file: Express.Multer.File
  ) {
    const user = req.user as any;
    return this.authService.updateProfile(user.userId, dto, file);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('credentials')
  updatePassword(@Req() req: express.Request, @Body() dto: UpdatePasswordDto) {
    const user = req.user as any;
    return this.authService.updatePassword(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('public-key')
  updatePublicKey(@Req() req: express.Request, @Body('publicKey') publicKey: string) {
    const user = req.user as any;
    return this.authService.updatePublicKey(user.userId, publicKey);
  }
}

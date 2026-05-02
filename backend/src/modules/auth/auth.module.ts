import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthTokenService } from './services/auth-token.service';
import { AuthProfileService } from './services/auth-profile.service';

@Module({
  imports: [
    PassportModule,
    CloudinaryModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1d' },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, AuthTokenService, AuthProfileService],
  controllers: [AuthController],
  exports: [AuthService]
})
export class AuthModule { }

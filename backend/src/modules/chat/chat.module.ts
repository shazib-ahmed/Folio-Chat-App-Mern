import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { DatabaseModule } from '../../database/database.module';

import { ChatGateway } from './gateways/chat.gateway';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MessagingService } from './services/messaging.service';
import { BlockService } from './services/block.service';
import { RoomService } from './services/room.service';

@Module({
  imports: [
    DatabaseModule, 
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
  controllers: [ChatController],
  providers: [
    ChatService, 
    ChatGateway,
    MessagingService,
    BlockService,
    RoomService
  ],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}

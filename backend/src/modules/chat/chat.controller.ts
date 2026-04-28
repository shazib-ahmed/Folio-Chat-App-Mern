import { Controller, Get, UseGuards, Req, Query, Param } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import * as express from 'express';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('list')
  async getChatList(@Req() req: express.Request) {
    const user = req.user as any;
    return this.chatService.getChatList(user.userId);
  }

  @Get('search')
  async searchUsers(@Req() req: express.Request, @Query('q') query: string) {
    const user = req.user as any;
    return this.chatService.searchUsers(user.userId, query);
  }

  @Get('user/:username')
  async getUserByUsername(@Param('username') username: string) {
    return this.chatService.getUserByUsername(username);
  }
}

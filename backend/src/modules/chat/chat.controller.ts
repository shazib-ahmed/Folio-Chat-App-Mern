import { Controller, Get, UseGuards, Req, Query, Param, Post, Body, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import * as express from 'express';
import { MessageType } from '@prisma/client';

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

  @Post('send')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB
  }))
  async sendMessage(
    @Req() req: express.Request,
    @Body('receiverId') receiverId: string,
    @Body('message') message: string,
    @Body('type') type: MessageType,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const user = req.user as any;
    return this.chatService.sendMessage(user.userId, Number(receiverId), message, type, file);
  }

  @Get('messages/:username')
  async getMessages(
    @Req() req: express.Request, 
    @Param('username') username: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const user = req.user as any;
    return this.chatService.getMessages(user.userId, username, cursor, limit ? Number(limit) : 20);
  }

  @Post('mark-seen/:chatId')
  async markAsSeen(@Req() req: express.Request, @Param('chatId') chatId: string) {
    const user = req.user as any;
    return this.chatService.markAsSeen(user.userId, Number(chatId));
  }

  @Post('block/:userId')
  async blockUser(@Req() req: express.Request, @Param('userId') userId: string) {
    const user = req.user as any;
    return this.chatService.blockUser(user.userId, Number(userId));
  }

  @Post('unblock/:userId')
  async unblockUser(@Req() req: express.Request, @Param('userId') userId: string) {
    const user = req.user as any;
    return this.chatService.unblockUser(user.userId, Number(userId));
  }

  @Post('accept/:userId')
  async acceptRequest(@Req() req: express.Request, @Param('userId') userId: string) {
    const user = req.user as any;
    return this.chatService.acceptChatRequest(user.userId, Number(userId));
  }
}

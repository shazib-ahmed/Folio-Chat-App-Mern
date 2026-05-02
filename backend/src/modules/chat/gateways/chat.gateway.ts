import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../../database/prisma.service';
import { forwardRef, Inject } from '@nestjs/common';
import { ChatService } from '../chat.service';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => ChatService))
    private chatService: ChatService,
    private jwtService: JwtService
  ) {}

  // Map to track connected users: userId -> Set of socketIds
  private connectedUsers: Map<number, Set<string>> = new Map();
  // Map for fast lookup: socketId -> userId
  private socketToUser: Map<string, number> = new Map();
  // Map to track active calls: userId -> boolean
  private userInCall: Map<number, boolean> = new Map();

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      
      if (!token) {
        console.log(`Connection rejected: No token provided for socket ${client.id}`);
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token as string);
      const uId = Number(payload.userId || payload.sub);

      if (!uId || isNaN(uId)) {
        console.log(`Connection rejected: Invalid payload for socket ${client.id}`);
        client.disconnect();
        return;
      }
      
      // Add to user's sockets
      if (!this.connectedUsers.has(uId)) {
        this.connectedUsers.set(uId, new Set());
      }
      const userSockets = this.connectedUsers.get(uId)!;
      userSockets.add(client.id);
      this.socketToUser.set(client.id, uId);
      
      // Update database status only if this is the first connection
      if (userSockets.size === 1) {
        try {
          await this.prisma.user.update({
            where: { id: uId },
            data: { isOnline: true }
          });

          // Broadcast status change
          this.server.emit('userStatus', { userId: uId, isOnline: true });
          console.log(`User ${uId} is now online (first tab connected)`);
        } catch (err) {
          console.error(`Failed to update online status for user ${uId}:`, err.message);
        }
      }
      
      console.log(`Socket connected: ${client.id} for user: ${uId}. Total sockets: ${userSockets.size}`);
    } catch (err) {
      console.log(`Connection rejected: Invalid token for socket ${client.id}. Error: ${err.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = this.socketToUser.get(client.id);
    
    if (userId) {
      this.socketToUser.delete(client.id);
      
      const userSockets = this.connectedUsers.get(userId);
      if (userSockets) {
        userSockets.delete(client.id);
        
        // If no more sockets for this user, they are truly offline
        if (userSockets.size === 0) {
          this.connectedUsers.delete(userId);
          
          const lastSeen = new Date();
          await this.prisma.user.update({
            where: { id: userId },
            data: { isOnline: false, lastSeen }
          });

          // Broadcast status change
          this.server.emit('userStatus', { 
            userId, 
            isOnline: false, 
            lastSeen: this.formatTime(lastSeen) 
          });

          // Ensure they are removed from active calls if they disconnect
          this.userInCall.delete(userId);
          
          console.log(`User ${userId} is now offline (all tabs closed)`);
        } else {
          console.log(`Socket disconnected: ${client.id} for user: ${userId}. Remaining sockets: ${userSockets.size}`);
        }
      }
    }
  }

  private formatTime(date: Date) {
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return `today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    return date.toLocaleDateString();
  }

  @SubscribeMessage('join')
  handleJoin(@MessageBody() data: { userId: number }, @ConnectedSocket() client: Socket) {
    if (!this.connectedUsers.has(data.userId)) {
      this.connectedUsers.set(data.userId, new Set());
    }
    this.connectedUsers.get(data.userId)!.add(client.id);
    this.socketToUser.set(client.id, data.userId);
    console.log(`User ${data.userId} explicitly joined with socket ${client.id}`);
  }

  sendMessageToUser(userId: number, event: string, payload: any) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.server.to(Array.from(socketId)).emit(event, payload);
    }
  }

  @SubscribeMessage('typing')
  handleTyping(@MessageBody() data: { senderId: number; receiverId: number }, @ConnectedSocket() client: Socket) {
    console.log(`User ${data.senderId} is typing to ${data.receiverId}`);
    this.sendMessageToUser(data.receiverId, 'typing', { senderId: data.senderId });
  }

  @SubscribeMessage('stopTyping')
  handleStopTyping(@MessageBody() data: { senderId: number; receiverId: number }, @ConnectedSocket() client: Socket) {
    console.log(`User ${data.senderId} stopped typing to ${data.receiverId}`);
    this.sendMessageToUser(data.receiverId, 'stopTyping', { senderId: data.senderId });
  }

  @SubscribeMessage('react')
  async handleReact(@MessageBody() data: { userId: number; messageId: number; emoji: string }, @ConnectedSocket() client: Socket) {
    console.log(`User ${data.userId} reacted with ${data.emoji} to message ${data.messageId}`);
    return await this.chatService.addReaction(data.userId, data.messageId, data.emoji);
  }

  broadcastToUsers(userIds: number[], event: string, payload: any) {
    userIds.forEach((id) => this.sendMessageToUser(id, event, payload));
  }

  // --- WebRTC Signaling ---

  @SubscribeMessage('call:request')
  async handleCallRequest(@MessageBody() data: { to: number; from: number; fromName: string; fromUsername: string; fromAvatar?: string; type: 'audio' | 'video' }) {
    console.log(`Call request from ${data.from} to ${data.to}`);
    
    // Check if the receiver is already in a call
    if (this.userInCall.get(data.to)) {
      console.log(`User ${data.to} is busy, notifying ${data.from}`);
      
      // Automate the logging from the backend for 100% reliability
      try {
        console.log(`Backend: Saving missed call log for busy receiver ${data.to} from sender ${data.from}`);
        const savedMsg = await this.chatService.sendMessage(
          data.from, 
          data.to, 
          'Missed call', 
          'CALL', 
          undefined, 
          false, 
          `busy-log-${Date.now()}`
        );
        console.log(`Backend: Missed call log saved with ID ${savedMsg.id}`);
      } catch (err) {
        console.error('CRITICAL: Failed to auto-log busy call:', err.message);
      }

      this.sendMessageToUser(data.from, 'call:busy', { userId: data.to, name: 'User' }); 
      return;
    }

    this.sendMessageToUser(data.to, 'call:request', data);
  }

  @SubscribeMessage('call:offer')
  handleCallOffer(@MessageBody() data: { to: number; offer: any; from: number }) {
    console.log(`Call offer from ${data.from} to ${data.to}`);
    this.sendMessageToUser(data.to, 'call:offer', data);
  }

  @SubscribeMessage('call:answer')
  handleCallAnswer(@MessageBody() data: { to: number; answer: any; from: number }) {
    console.log(`Call answer from ${data.from} to ${data.to}`);
    // Mark both users as in a call
    this.userInCall.set(data.from, true);
    this.userInCall.set(data.to, true);
    this.sendMessageToUser(data.to, 'call:answer', data);
  }

  @SubscribeMessage('call:ice-candidate')
  handleIceCandidate(@MessageBody() data: { to: number; candidate: any; from: number }) {
    this.sendMessageToUser(data.to, 'call:ice-candidate', data);
  }

  @SubscribeMessage('call:reject')
  handleCallReject(@MessageBody() data: { to: number; from: number }) {
    console.log(`Call rejected by ${data.from}, notifying ${data.to}`);
    this.sendMessageToUser(data.to, 'call:reject', data);
  }

  @SubscribeMessage('call:end')
  handleCallEnd(@MessageBody() data: { to: number; from: number }) {
    console.log(`Call ended by ${data.from}, notifying ${data.to}`);
    // Unmark both users
    this.userInCall.delete(data.from);
    this.userInCall.delete(data.to);
    this.sendMessageToUser(data.to, 'call:end', data);
  }
}

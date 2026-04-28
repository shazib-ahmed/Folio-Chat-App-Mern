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
import { PrismaService } from 'src/database/prisma.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private prisma: PrismaService) {}

  // Map to track connected users: userId -> socketId
  private connectedUsers: Map<number, string> = new Map();

  async handleConnection(client: Socket) {
    const userId = client.handshake.query.userId;
    if (userId && !isNaN(Number(userId))) {
      const uId = Number(userId);
      this.connectedUsers.set(uId, client.id);
      
      // Update database status
      await this.prisma.user.update({
        where: { id: uId },
        data: { isOnline: true }
      });

      // Broadcast status change
      this.server.emit('userStatus', { userId: uId, isOnline: true });
      
      console.log(`User connected: ${userId} with socketId: ${client.id}`);
    }
  }

  async handleDisconnect(client: Socket) {
    // Find and remove the user from the map
    for (const [userId, socketId] of this.connectedUsers.entries()) {
      if (socketId === client.id) {
        this.connectedUsers.delete(userId);
        
        // Update database status
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
        
        console.log(`User disconnected: ${userId}`);
        break;
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
    this.connectedUsers.set(data.userId, client.id);
    console.log(`User ${data.userId} explicitly joined with socket ${client.id}`);
  }

  sendMessageToUser(userId: number, event: string, payload: any) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.server.to(socketId).emit(event, payload);
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

  broadcastToUsers(userIds: number[], event: string, payload: any) {
    userIds.forEach((id) => this.sendMessageToUser(id, event, payload));
  }
}

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

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Map to track connected users: userId -> socketId
  private connectedUsers: Map<number, string> = new Map();

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId;
    if (userId) {
      this.connectedUsers.set(Number(userId), client.id);
      console.log(`User connected: ${userId} with socketId: ${client.id}`);
    }
  }

  handleDisconnect(client: Socket) {
    // Find and remove the user from the map
    for (const [userId, socketId] of this.connectedUsers.entries()) {
      if (socketId === client.id) {
        this.connectedUsers.delete(userId);
        console.log(`User disconnected: ${userId}`);
        break;
      }
    }
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

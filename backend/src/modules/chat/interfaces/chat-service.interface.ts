import { MessageType, ChatRoom, Message } from '@prisma/client';

export interface IMessagingService {
  sendMessage(
    senderId: number,
    receiverId: number,
    content: string,
    type: MessageType,
    file?: Express.Multer.File,
    isEncrypted?: boolean,
    clientMsgId?: string,
    providedFileUrl?: string,
    providedFileName?: string,
    providedFileSize?: string,
    isForwarded?: boolean,
    sourceMessageId?: number,
    replyToId?: number,
  ): Promise<Message>;

  deleteMessage(userId: number, messageId: number): Promise<any>;
  updateMessage(userId: number, messageId: number, content: string): Promise<any>;
  markSeen(userId: number, otherUserId: number): Promise<any>;
}

export interface IBlockService {
  blockUser(blockerId: number, blockedId: number): Promise<{ success: boolean }>;
  unblockUser(blockerId: number, blockedId: number): Promise<{ success: boolean }>;
  checkBlockStatus(user1Id: number, user2Id: number): Promise<boolean>;
}

export interface IRoomService {
  getOrCreateChatRoom(user1Id: number, user2Id: number, requesterId?: number): Promise<ChatRoom>;
  acceptChatRequest(userId: number, otherId: number): Promise<any>;
}

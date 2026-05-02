import { Chat } from '../types';

export interface IChatApi {
  getChatList(): Promise<Chat[]>;
  searchUsers(query: string, signal?: AbortSignal): Promise<any[]>;
  getUserByUsername(username: string): Promise<any>;
  uploadFile(file: File): Promise<any>;
  sendMessage(params: SendMessageParams): Promise<any>;
  getMessages(username: string, cursor?: string, limit?: number): Promise<any>;
  markSeen(chatId: string): Promise<any>;
  blockUser(userId: string): Promise<any>;
  unblockUser(userId: string): Promise<any>;
  acceptRequest(userId: string): Promise<any>;
  searchMessages(username: string, query: string, signal?: AbortSignal): Promise<any[]>;
  setPublicKey(publicKey: string): Promise<any>;
  getPublicKey(username: string): Promise<any>;
  updateMessage(messageId: string, message: string): Promise<any>;
  deleteMessage(messageId: string): Promise<any>;
}

export interface SendMessageParams {
  receiverId: string;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'CALL';
  file?: File;
  isEncrypted?: boolean;
  clientMsgId?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  isForwarded?: boolean;
  sourceMessageId?: string;
  replyToId?: string;
}

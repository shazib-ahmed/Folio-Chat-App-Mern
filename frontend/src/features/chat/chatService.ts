import api from '@/shared/lib/axios';
import { Chat } from './types';
import { IChatApi, SendMessageParams } from './interfaces/chat-api.interface';

class ChatApiService implements IChatApi {
  async getChatList(): Promise<Chat[]> {
    const response = await api.get('/chat/list');
    return response.data;
  }

  async searchUsers(query: string, signal?: AbortSignal): Promise<any[]> {
    const response = await api.get(`/chat/search?q=${query}`, { signal });
    return response.data;
  }

  async getUserByUsername(username: string): Promise<any> {
    const response = await api.get(`/chat/user/${username}`);
    return response.data;
  }

  async uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/chat/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }

  async sendMessage(params: SendMessageParams) {
    const formData = new FormData();
    formData.append('receiverId', params.receiverId);
    formData.append('message', params.content);
    formData.append('type', params.type);
    if (params.file) formData.append('file', params.file);
    formData.append('isEncrypted', String(!!params.isEncrypted));
    if (params.clientMsgId) formData.append('clientMsgId', params.clientMsgId);
    if (params.fileUrl) formData.append('fileUrl', params.fileUrl);
    if (params.fileName) formData.append('fileName', params.fileName);
    if (params.fileSize) formData.append('fileSize', params.fileSize);
    formData.append('isForwarded', String(!!params.isForwarded));
    if (params.sourceMessageId) formData.append('sourceMessageId', params.sourceMessageId);
    if (params.replyToId) formData.append('replyToId', params.replyToId);
    
    const response = await api.post('/chat/send', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }

  async getMessages(username: string, cursor?: string, limit: number = 20) {
    const response = await api.get(`/chat/messages/${username}`, {
      params: { cursor, limit }
    });
    return response.data;
  }

  async markSeen(chatId: string) {
    const response = await api.post(`/chat/mark-seen/${chatId}`);
    return response.data;
  }

  async blockUser(userId: string) {
    const response = await api.post(`/chat/block/${userId}`);
    return response.data;
  }

  async unblockUser(userId: string) {
    const response = await api.post(`/chat/unblock/${userId}`);
    return response.data;
  }

  async acceptRequest(userId: string) {
    const response = await api.post(`/chat/accept/${userId}`);
    return response.data;
  }

  async searchMessages(username: string, query: string, signal?: AbortSignal) {
    const response = await api.get(`/chat/messages/${username}/search?q=${query}`, { signal });
    return response.data;
  }

  async setPublicKey(publicKey: string) {
    const response = await api.post('/auth/public-key', { publicKey });
    return response.data;
  }

  async getPublicKey(username: string) {
    const response = await api.get(`/chat/user/${username}/public-key`);
    return response.data;
  }

  async updateMessage(messageId: string, message: string) {
    const response = await api.post(`/chat/update/${messageId}`, { message });
    return response.data;
  }

  async deleteMessage(messageId: string) {
    const response = await api.post(`/chat/delete/${messageId}`);
    return response.data;
  }
}

export const chatApiService = new ChatApiService();

// Wrapper functions for backward compatibility
export const getChatListApi = () => chatApiService.getChatList();
export const searchUsersApi = (query: string, signal?: AbortSignal) => chatApiService.searchUsers(query, signal);
export const getUserByUsernameApi = (username: string) => chatApiService.getUserByUsername(username);
export const uploadFileApi = (file: File) => chatApiService.uploadFile(file);
export const sendMessageApi = (
  receiverId: string, 
  content: string, 
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'CALL', 
  file?: File, 
  isEncrypted: boolean = false, 
  clientMsgId?: string,
  fileUrl?: string,
  fileName?: string,
  fileSize?: string,
  isForwarded: boolean = false,
  sourceMessageId?: string,
  replyToId?: string
) => chatApiService.sendMessage({
  receiverId, content, type, file, isEncrypted, clientMsgId, fileUrl, fileName, fileSize, isForwarded, sourceMessageId, replyToId
});
export const getMessagesApi = (username: string, cursor?: string, limit?: number) => chatApiService.getMessages(username, cursor, limit);
export const markSeenApi = (chatId: string) => chatApiService.markSeen(chatId);
export const blockUserApi = (userId: string) => chatApiService.blockUser(userId);
export const unblockUserApi = (userId: string) => chatApiService.unblockUser(userId);
export const acceptRequestApi = (userId: string) => chatApiService.acceptRequest(userId);
export const searchMessagesApi = (username: string, query: string, signal?: AbortSignal) => chatApiService.searchMessages(username, query, signal);
export const setPublicKeyApi = (publicKey: string) => chatApiService.setPublicKey(publicKey);
export const getPublicKeyApi = (username: string) => chatApiService.getPublicKey(username);
export const updateMessageApi = (messageId: string, message: string) => chatApiService.updateMessage(messageId, message);
export const deleteMessageApi = (messageId: string) => chatApiService.deleteMessage(messageId);

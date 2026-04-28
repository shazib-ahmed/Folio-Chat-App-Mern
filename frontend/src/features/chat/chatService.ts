import api from '@/shared/lib/axios';
import { Chat } from './types';

export const getChatListApi = async (): Promise<Chat[]> => {
  const response = await api.get('/chat/list');
  return response.data;
};

export const searchUsersApi = async (query: string, signal?: AbortSignal): Promise<any[]> => {
  const response = await api.get(`/chat/search?q=${query}`, { signal });
  return response.data;
};

export const getUserByUsernameApi = async (username: string): Promise<any> => {
  const response = await api.get(`/chat/user/${username}`);
  return response.data;
};

export const sendMessageApi = async (formData: FormData): Promise<any> => {
  const response = await api.post('/chat/send', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const getMessagesApi = async (username: string, cursor?: string, limit: number = 20): Promise<any> => {
  const response = await api.get(`/chat/messages/${username}`, {
    params: { cursor, limit }
  });
  return response.data;
};

export const markSeenApi = async (chatId: string): Promise<any> => {
  const response = await api.post(`/chat/mark-seen/${chatId}`);
  return response.data;
};

export const blockUserApi = async (userId: string): Promise<any> => {
  const response = await api.post(`/chat/block/${userId}`);
  return response.data;
};

export const unblockUserApi = async (userId: string): Promise<any> => {
  const response = await api.post(`/chat/unblock/${userId}`);
  return response.data;
};

export const acceptRequestApi = async (userId: string): Promise<any> => {
  const response = await api.post(`/chat/accept/${userId}`);
  return response.data;
};

export const searchMessagesApi = async (username: string, query: string, signal?: AbortSignal): Promise<any[]> => {
  const response = await api.get(`/chat/messages/${username}/search?q=${query}`, { signal });
  return response.data;
};

export const setPublicKeyApi = async (publicKey: string): Promise<any> => {
  const response = await api.post('/auth/public-key', { publicKey });
  return response.data;
};

export const getPublicKeyApi = async (username: string): Promise<string | null> => {
  const response = await api.get(`/chat/user/${username}/public-key`);
  return response.data;
};

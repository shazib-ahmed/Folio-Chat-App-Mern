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

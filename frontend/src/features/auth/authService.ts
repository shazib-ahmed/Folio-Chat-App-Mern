import api from '@/shared/lib/axios';

export const loginApi = async (data: any) => {
  const response = await api.post('/auth/login', data);
  return response.data;
};

export const registerApi = async (data: any) => {
  const response = await api.post('/auth/register', data);
  return response.data;
};

export const logoutApi = async () => {
  // Token is automatically added by interceptor
  const response = await api.post('/auth/logout');
  return response.data;
};

export const refreshApi = async (refreshToken: string) => {
  const response = await api.post('/auth/refresh', { refreshToken });
  return response.data;
};

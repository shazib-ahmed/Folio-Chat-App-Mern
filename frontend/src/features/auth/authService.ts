import api from '@/shared/lib/axios';

class AuthApiService {
  async login(data: any) {
    const response = await api.post('/auth/login', data);
    return response.data;
  }

  async register(data: any) {
    const response = await api.post('/auth/register', data);
    return response.data;
  }

  async logout() {
    const response = await api.post('/auth/logout');
    return response.data;
  }

  async refresh(refreshToken: string) {
    const response = await api.post('/auth/refresh', { refreshToken });
    return response.data;
  }

  async updateProfile(data: any) {
    const response = await api.patch('/auth/profile', data);
    return response.data;
  }

  async updatePassword(data: any) {
    const response = await api.patch('/auth/credentials', data);
    return response.data;
  }
}

export const authApiService = new AuthApiService();

// Wrapper functions for backward compatibility
export const loginApi = (data: any) => authApiService.login(data);
export const registerApi = (data: any) => authApiService.register(data);
export const logoutApi = () => authApiService.logout();
export const refreshApi = (refreshToken: string) => authApiService.refresh(refreshToken);
export const updateProfileApi = (data: any) => authApiService.updateProfile(data);
export const updatePasswordApi = (data: any) => authApiService.updatePassword(data);

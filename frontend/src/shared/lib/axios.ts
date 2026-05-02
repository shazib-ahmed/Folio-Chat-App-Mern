import axios from 'axios';
import { decryptData } from '@/shared/utils/encryption';

const API_URL = process.env.API_URL;

// We'll inject the store later to avoid circular dependencies
let store: any;
export const injectStore = (_store: any) => {
  store = _store;
};

const api = axios.create({
  baseURL: API_URL,
});

// Helper to get token from localStorage directly (to avoid store dependency in request)
const getAccessToken = () => {
  const encryptedToken = localStorage.getItem('t_data');
  return encryptedToken ? decryptData(encryptedToken) : null;
};

const getRefreshToken = () => {
  const encryptedRefreshToken = localStorage.getItem('rt_data');
  return encryptedRefreshToken ? decryptData(encryptedRefreshToken) : null;
};

// Request Interceptor: Attach Access Token
api.interceptors.request.use(
  (config) => {
    // Try to get token from store if available, otherwise fallback to localStorage
    const token = store ? store.getState().auth.token : getAccessToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Token Refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't refresh token for login and register requests
      if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/register')) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        const refreshToken = store ? store.getState().auth.refreshToken : getRefreshToken();

        if (!refreshToken) throw new Error('No refresh token');

        // Call refresh endpoint using fresh axios instance to avoid interceptor loop
        const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const { access_token, refresh_token } = response.data;

        if (store) {
          // Import actions dynamically to avoid top-level circular dependency
          const { setCredentials } = await import('@/features/auth/authSlice');
          const user = store.getState().auth.user;
          if (user) {
            store.dispatch(setCredentials({
              user,
              access_token,
              refresh_token
            }));
          }
        }

        // Update authorization header and retry
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout user
        if (store) {
          const { logout } = await import('@/features/auth/authSlice');
          store.dispatch(logout());
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

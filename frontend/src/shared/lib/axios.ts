import axios from 'axios';
import { store } from '@/app/store';
import { setCredentials, logout } from '@/features/auth/authSlice';

const API_URL = (process.env.API_URL || 'http://localhost:5000') + '/api';

const api = axios.create({
  baseURL: API_URL,
});

// Request Interceptor: Attach Access Token
api.interceptors.request.use(
  (config) => {
    const state = store.getState();
    const token = state.auth.token;

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
        const state = store.getState();
        const refreshToken = state.auth.refreshToken;

        if (!refreshToken) throw new Error('No refresh token');

        // Call refresh endpoint
        const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const { access_token, refresh_token } = response.data;

        // Update Redux Store (which also updates localStorage via its logic if implemented there, 
        // but here we do it in the slice or interceptor. 
        // Our slice's setCredentials handles localStorage.)
        if (state.auth.user) {
          store.dispatch(setCredentials({
            user: state.auth.user,
            access_token,
            refresh_token
          }));
        }

        // Update authorization header and retry
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout user
        store.dispatch(logout());
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

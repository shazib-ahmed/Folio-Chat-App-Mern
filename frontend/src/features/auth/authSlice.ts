import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { encryptData, decryptData } from '@/shared/utils/encryption';

interface User {
  id: number;
  name?: string;
  username: string;
  email: string;
  phone?: string;
  country?: string;
  avatar?: string;
  isOnline?: boolean;
  lastSeen?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const getInitialUser = (): User | null => {
  const encryptedUser = localStorage.getItem('u_data');
  return encryptedUser ? decryptData(encryptedUser) : null;
};

const getInitialToken = (): string | null => {
  const encryptedToken = localStorage.getItem('t_data');
  return encryptedToken ? decryptData(encryptedToken) : null;
};

const getInitialRefreshToken = (): string | null => {
  const encryptedRefreshToken = localStorage.getItem('rt_data');
  return encryptedRefreshToken ? decryptData(encryptedRefreshToken) : null;
};

const initialState: AuthState = {
  user: getInitialUser(),
  token: getInitialToken(),
  refreshToken: getInitialRefreshToken(),
  isAuthenticated: !!getInitialToken(),
  loading: false,
  error: null,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ user: User; access_token: string; refresh_token: string }>
    ) => {
      const { user, access_token, refresh_token } = action.payload;
      state.user = user;
      state.token = access_token;
      state.refreshToken = refresh_token;
      state.isAuthenticated = true;
      
      localStorage.setItem('u_data', encryptData(user));
      localStorage.setItem('t_data', encryptData(access_token));
      localStorage.setItem('rt_data', encryptData(refresh_token));
      
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      localStorage.removeItem('u_data');
      localStorage.removeItem('t_data');
      localStorage.removeItem('rt_data');
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
  },
});

export const { setCredentials, logout, setError, setLoading } = authSlice.actions;

export default authSlice.reducer;

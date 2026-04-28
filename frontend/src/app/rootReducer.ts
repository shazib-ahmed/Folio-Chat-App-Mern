import { combineReducers } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import chatReducer from '../features/chat/chatSlice';

export const rootReducer = combineReducers({
  auth: authReducer,
  chat: chatReducer,
});

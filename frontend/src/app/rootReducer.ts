import { combineReducers } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';

export const rootReducer = combineReducers({
  auth: authReducer,
  // Add reducers here as you create features
});

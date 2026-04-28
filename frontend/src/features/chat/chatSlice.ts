import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Chat } from './types';
import { getChatListApi } from './chatService';

interface ChatState {
  chats: Chat[];
  isLoading: boolean;
  error: string | null;
}

const initialState: ChatState = {
  chats: [],
  isLoading: false,
  error: null,
};

export const fetchChatList = createAsyncThunk(
  'chat/fetchChatList',
  async (_, { rejectWithValue }) => {
    try {
      return await getChatListApi();
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch chat list');
    }
  }
);

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setChats: (state, action: PayloadAction<Chat[]>) => {
      state.chats = action.payload;
    },
    selectChat: (state, action: PayloadAction<Chat>) => {
      const exists = state.chats.find(c => c.id === action.payload.id || c.username === action.payload.username);
      if (!exists) {
        state.chats = [action.payload, ...state.chats];
      }
    },
    updateChatLastMessage: (state, action: PayloadAction<{ chatId: string; message: string; time: string }>) => {
      const chat = state.chats.find(c => c.id === action.payload.chatId);
      if (chat) {
        chat.lastMessage = action.payload.message;
        chat.lastMessageTime = action.payload.time;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchChatList.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchChatList.fulfilled, (state, action) => {
        state.isLoading = false;
        state.chats = action.payload;
      })
      .addCase(fetchChatList.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setChats, selectChat, updateChatLastMessage } = chatSlice.actions;
export default chatSlice.reducer;

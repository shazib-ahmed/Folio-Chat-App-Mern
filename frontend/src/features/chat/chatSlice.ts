import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Chat } from './types';
import { getChatListApi } from './chatService';

interface ChatState {
  chats: Chat[];
  typingUsers: { [chatId: string]: boolean };
  isLoading: boolean;
  error: string | null;
}

const initialState: ChatState = {
  chats: [],
  typingUsers: {},
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
    updateChatLastMessage: (state, action: PayloadAction<{ 
      chatId: string; 
      message: string; 
      time: string;
      isMine?: boolean;
    }>) => {
      const { chatId, message, time, isMine } = action.payload;
      const chatIndex = state.chats.findIndex(c => c.id === chatId);
      if (chatIndex !== -1) {
        const chat = { ...state.chats[chatIndex] };
        chat.lastMessage = isMine ? `You: ${message}` : message;
        chat.lastMessageTime = time;
        
        // Increment unread count if it's NOT my own message
        if (!isMine) {
          chat.unreadCount = (chat.unreadCount || 0) + 1;
        }

        // Remove from current position and move to top
        state.chats.splice(chatIndex, 1);
        state.chats = [chat, ...state.chats];
      }
    },
    clearUnreadCount: (state, action: PayloadAction<string>) => {
      const chat = state.chats.find(c => c.id === action.payload);
      if (chat) {
        chat.unreadCount = 0;
      }
    },
    setTypingStatus: (state, action: PayloadAction<{ chatId: string; isTyping: boolean }>) => {
      state.typingUsers[action.payload.chatId] = action.payload.isTyping;
    },
    setUserStatus: (state, action: PayloadAction<{ userId: string; isOnline: boolean; lastSeen?: string }>) => {
      const chat = state.chats.find(c => c.id === action.payload.userId);
      if (chat) {
        chat.online = action.payload.isOnline;
        if (action.payload.lastSeen) {
          chat.lastSeen = action.payload.lastSeen;
        }
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

export const { setChats, selectChat, updateChatLastMessage, clearUnreadCount, setTypingStatus, setUserStatus } = chatSlice.actions;
export default chatSlice.reducer;

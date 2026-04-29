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
      sender?: any;
      receiver?: any;
      isEncrypted?: boolean;
      lastMessageSenderId?: string;
      lastMessageId?: string;
      isForwarded?: boolean;
    }>) => {
      const { chatId, message, time, isMine, sender, receiver, isEncrypted, lastMessageSenderId, lastMessageId, isForwarded } = action.payload;
      const chatIndex = state.chats.findIndex(c => c.id === chatId);
      
      if (chatIndex !== -1) {
        const chat = { ...state.chats[chatIndex] };
        // For encrypted messages, we store the raw message. 
        // For plain text, we prepend "You: " if it's mine.
        chat.lastMessage = message;
        chat.lastMessageTime = time;
        chat.isEncrypted = isEncrypted;
        chat.lastMessageSenderId = lastMessageSenderId;
        chat.lastMessageId = lastMessageId;
        chat.isForwarded = isForwarded;
        
        if (!isMine) {
          chat.unreadCount = (chat.unreadCount || 0) + 1;
        }

        state.chats.splice(chatIndex, 1);
        state.chats = [chat, ...state.chats];
      } else if (!isMine && sender) {
        // New incoming chat room
        const newChat: Chat = {
          id: sender.id,
          name: sender.name,
          username: sender.username,
          avatar: sender.avatar,
          online: sender.online,
          lastMessage: message,
          lastMessageTime: time,
          unreadCount: 1,
          isEncrypted: isEncrypted,
          isForwarded: isForwarded,
          lastMessageSenderId: lastMessageSenderId,
          lastMessageId: lastMessageId
        };
        state.chats = [newChat, ...state.chats];
      } else if (isMine && receiver) {
        // New outgoing chat room
        const newChat: Chat = {
          id: receiver.id,
          name: receiver.name,
          username: receiver.username,
          avatar: receiver.avatar,
          online: receiver.online,
          lastMessage: message,
          lastMessageTime: time,
          unreadCount: 0,
          isEncrypted: isEncrypted,
          isForwarded: isForwarded,
          lastMessageSenderId: lastMessageSenderId,
          lastMessageId: lastMessageId
        };
        state.chats = [newChat, ...state.chats];
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
    },
    updateChatStatus: (state, action: PayloadAction<{ chatRoomId: string; status: 'PENDING' | 'ACCEPTED' }>) => {
      // Find chat by chatRoomId (sorted user IDs)
      const { chatRoomId, status } = action.payload;
      console.log(`Updating chat status for room ${chatRoomId} to ${status}`);
      state.chats = state.chats.map(chat => {
        return chat; 
      });
    },
    updateChatPreview: (state, action: PayloadAction<{ 
      messageId: string; 
      senderId: string; 
      receiverId: string; 
      sidebarText: string;
      isMine: boolean;
      isEncrypted?: boolean;
    }>) => {
      const { messageId, senderId, receiverId, sidebarText, isEncrypted } = action.payload;
      
      const chat = state.chats.find(c => {
        const idMatch = String(c.id) === String(senderId) || String(c.id) === String(receiverId);
        const msgMatch = String(c.lastMessageId) === String(messageId);
        return idMatch && msgMatch;
      });

      if (chat) {
        chat.lastMessage = sidebarText;
        if (isEncrypted !== undefined) {
          chat.isEncrypted = isEncrypted;
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

export const { setChats, selectChat, updateChatLastMessage, clearUnreadCount, setTypingStatus, setUserStatus, updateChatStatus, updateChatPreview } = chatSlice.actions;
export default chatSlice.reducer;

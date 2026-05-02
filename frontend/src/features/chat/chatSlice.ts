import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Chat } from './types';
import { getChatListApi } from './chatService';

/**
 * Interface representing the global chat state.
 */
interface ChatState {
  chats: Chat[];
  typingUsers: { [chatId: string]: boolean };
  selectedChat: Chat | null;
  selectedChatMessages: any[];
  isLoading: boolean;
  isLoadingSelectedChat: boolean;
  isE2eeInitialized: boolean;
  error: string | null;
}

const initialState: ChatState = {
  chats: [],
  typingUsers: {},
  selectedChat: null,
  selectedChatMessages: [],
  isLoading: false,
  isLoadingSelectedChat: false,
  isE2eeInitialized: false,
  error: null,
};

/**
 * Fetches the user's chat list from the server.
 */
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

/**
 * Fetches detailed information and message history for a specific chat.
 * Implements a dual-loading strategy: retrieves cached messages from IndexedDB for an instant UI response
 * while potentially waiting for server synchronization if no cache is available.
 */
export const fetchSelectedChat = createAsyncThunk(
  'chat/fetchSelectedChat',
  async (username: string, { getState, rejectWithValue }) => {
    const { chat: chatState, auth } = getState() as { chat: ChatState; auth: any };
    const me = auth.user;
    
    let chat = chatState.chats.find(c => c.username === username);
    
    try {
      const { getUserByUsernameApi, getMessagesApi } = await import('./chatService');
      const { getCachedMessages, getLocalPrivateKey, decryptMessageBatch } = await import('@/shared/lib/cryptoUtils');

      if (!chat) {
        const user = await getUserByUsernameApi(username);
        chat = {
          id: user.id.toString(),
          name: user.name || user.username,
          username: user.username,
          avatar: user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`,
          online: user.isOnline,
          unreadCount: 0
        } as Chat;
      }

      const cached = await getCachedMessages(username);
      let initialMessages = [];
      if (cached && cached.length > 0) {
        const privateKey = me?.id ? await getLocalPrivateKey(String(me.id)) : null;
        initialMessages = await decryptMessageBatch(cached, privateKey, me?.id ? String(me.id) : undefined);
      }

      if (initialMessages.length === 0) {
        const data = await getMessagesApi(username);
        const privateKey = me?.id ? await getLocalPrivateKey(String(me.id)) : null;
        const serverMessages = await decryptMessageBatch(data.messages || [], privateKey, me?.id ? String(me.id) : undefined);
        return { chat, messages: serverMessages, fromCache: false };
      }

      return { chat, messages: initialMessages, fromCache: true };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'User not found');
    }
  }
);

/**
 * Redux Slice for managing chat-related data and states.
 */
const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setChats: (state, action: PayloadAction<Chat[]>) => {
      state.chats = action.payload;
    },
    setSelectedChat: (state, action: PayloadAction<Chat | null>) => {
      state.selectedChat = action.payload;
    },
    selectChat: (state, action: PayloadAction<Chat>) => {
      const exists = state.chats.find(c => c.id === action.payload.id || c.username === action.payload.username);
      if (!exists) {
        state.chats = [action.payload, ...state.chats];
      }
    },
    /**
     * Updates the last message preview and time for a chat in the sidebar.
     * Moves the chat to the top of the list (WhatsApp-style).
     */
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
      lastMessageType?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'CALL';
      isForwarded?: boolean;
    }>) => {
      const { chatId, message, time, isMine, sender, receiver, isEncrypted, lastMessageSenderId, lastMessageId, lastMessageType, isForwarded } = action.payload;
      const chatIndex = state.chats.findIndex(c => c.id === chatId);

      if (chatIndex !== -1) {
        const chat = { ...state.chats[chatIndex] };
        chat.lastMessage = message;
        chat.lastMessageTime = time;
        chat.lastMessageSenderId = lastMessageSenderId;
        chat.lastMessageId = lastMessageId;
        chat.isEncrypted = isEncrypted;
        chat.lastMessageType = lastMessageType;
        chat.isForwarded = isForwarded;

        if (!isMine) {
          chat.unreadCount = (chat.unreadCount || 0) + 1;
        }

        state.chats.splice(chatIndex, 1);
        state.chats = [chat, ...state.chats];
      } else if (!isMine && sender) {
        const newChat: Chat = {
          id: String(sender.id),
          name: sender.name || sender.username,
          username: sender.username,
          avatar: sender.avatar,
          lastMessage: message,
          lastMessageTime: time,
          unreadCount: 1,
          online: sender.isOnline,
          isEncrypted: isEncrypted,
          lastMessageSenderId: lastMessageSenderId,
          lastMessageId: lastMessageId,
          lastMessageType: lastMessageType
        };
        state.chats = [newChat, ...state.chats];
      } else if (isMine && receiver) {
        const newChat: Chat = {
          id: String(receiver.id),
          name: receiver.name || receiver.username,
          username: receiver.username,
          avatar: receiver.avatar,
          lastMessage: message,
          lastMessageTime: time,
          unreadCount: 0,
          online: receiver.isOnline,
          isEncrypted: isEncrypted,
          lastMessageSenderId: lastMessageSenderId,
          lastMessageId: lastMessageId,
          lastMessageType: lastMessageType
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
    updateChatStatus: (state, _action: PayloadAction<{ chatRoomId: string; status: 'PENDING' | 'ACCEPTED' }>) => {
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
    },
    setE2eeInitialized: (state, action: PayloadAction<boolean>) => {
      state.isE2eeInitialized = action.payload;
    },
    setSelectedChatMessages: (state, action: PayloadAction<any[]>) => {
      state.selectedChatMessages = action.payload;
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
      })
      .addCase(fetchSelectedChat.pending, (state) => {
        state.isLoadingSelectedChat = true;
        state.error = null;
      })
      .addCase(fetchSelectedChat.fulfilled, (state, action) => {
        state.isLoadingSelectedChat = false;
        state.selectedChat = action.payload.chat;
        state.selectedChatMessages = action.payload.messages;
      })
      .addCase(fetchSelectedChat.rejected, (state, action) => {
        state.isLoadingSelectedChat = false;
        state.error = action.payload as string;
        state.selectedChat = null;
        state.selectedChatMessages = [];
      });
  },
});

export const { setChats, setSelectedChat, setSelectedChatMessages, selectChat, updateChatLastMessage, clearUnreadCount, setTypingStatus, setUserStatus, updateChatStatus, updateChatPreview, setE2eeInitialized } = chatSlice.actions;
export default chatSlice.reducer;

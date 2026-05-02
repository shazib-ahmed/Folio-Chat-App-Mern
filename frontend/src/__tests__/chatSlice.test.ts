import chatReducer, { updateChatLastMessage, clearUnreadCount, setTypingStatus, setUserStatus } from '../features/chat/chatSlice';
import { Chat } from '../features/chat/types';

describe('Chat Redux Slice', () => {
  const initialState = {
    chats: [] as Chat[],
    typingUsers: {},
    selectedChat: null,
    selectedChatMessages: [],
    isLoading: false,
    isLoadingSelectedChat: false,
    isE2eeInitialized: false,
    error: null,
  };

  test('should return the initial state', () => {
    expect(chatReducer(undefined, { type: '@@INIT' })).toEqual(initialState);
  });

  test('should update last message and move chat to top', () => {
    const chat1: Chat = { id: '1', name: 'User 1', username: 'user1', unreadCount: 0, avatar: '' };
    const chat2: Chat = { id: '2', name: 'User 2', username: 'user2', unreadCount: 0, avatar: '' };
    const state = { ...initialState, chats: [chat1, chat2] };

    const update = {
      chatId: '2',
      message: 'New message',
      time: new Date().toISOString(),
      isMine: false,
      lastMessageId: 'msg123'
    };

    const nextState = chatReducer(state, updateChatLastMessage(update));

    expect(nextState.chats[0].id).toBe('2');
    expect(nextState.chats[0].lastMessage).toBe('New message');
    expect(nextState.chats[0].unreadCount).toBe(1);
  });

  test('should clear unread count', () => {
    const chat: Chat = { id: '1', name: 'User 1', username: 'user1', unreadCount: 5, avatar: '' };
    const state = { ...initialState, chats: [chat] };

    const nextState = chatReducer(state, clearUnreadCount('1'));
    expect(nextState.chats[0].unreadCount).toBe(0);
  });

  test('should set typing status', () => {
    const nextState = chatReducer(initialState, setTypingStatus({ chatId: '1', isTyping: true }));
    expect(nextState.typingUsers['1']).toBe(true);
  });

  test('should update user online status', () => {
    const chat: Chat = { id: '1', name: 'User 1', username: 'user1', online: false, avatar: '', unreadCount: 0 };
    const state = { ...initialState, chats: [chat] };

    const nextState = chatReducer(state, setUserStatus({ userId: '1', isOnline: true }));
    expect(nextState.chats[0].online).toBe(true);
  });
});

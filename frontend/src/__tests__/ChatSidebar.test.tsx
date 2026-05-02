import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChatSidebar } from '../features/chat/components/ChatSidebar';
import * as chatService from '../features/chat/chatService';
import { Chat } from '../features/chat/types';

/**
 * Manual mocks for react-router-dom, Redux, and fontawesome.
 */
jest.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: (props: any) => <span data-testid="icon" onClick={props.onClick} />
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/' }),
  Link: ({ children }: any) => <div>{children}</div>,
  NavLink: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('react-redux', () => ({
  useDispatch: () => jest.fn(),
  useSelector: (fn: any) => fn({
    auth: { user: { id: 'me', username: 'me_user', avatar: '' } },
    chat: { isLoading: false, typingUsers: {} }
  }),
}));

// Mock the search API
jest.mock('../features/chat/chatService', () => ({
  searchUsersApi: jest.fn()
}));

const mockChats: Chat[] = [
  {
    id: '1',
    name: 'John Doe',
    username: 'johndoe',
    avatar: '',
    lastMessage: 'Hello!',
    lastMessageTime: new Date().toISOString(),
    unreadCount: 2,
    online: true
  },
  {
    id: '2',
    name: 'Jane Smith',
    username: 'janesmith',
    avatar: '',
    lastMessage: 'See you later',
    lastMessageTime: new Date().toISOString(),
    unreadCount: 0,
    online: false
  }
];

const defaultProps = {
  chats: mockChats,
  activeChatId: undefined
};

describe('ChatSidebar Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders the list of chats', () => {
    render(<ChatSidebar {...defaultProps} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  test('displays unread badge when unreadCount > 0', () => {
    render(<ChatSidebar {...defaultProps} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  test('shows online indicator for online users', () => {
    const { container } = render(<ChatSidebar {...defaultProps} />);
    // Look for the emerald dot class
    const onlineIndicator = container.querySelector('.bg-emerald-500');
    expect(onlineIndicator).toBeInTheDocument();
  });

  test('filters chat list based on search query', async () => {
    const mockSearchResults = [
      { id: 3, name: 'Search Result User', username: 'searchuser', isOnline: true, avatar: '' }
    ];
    (chatService.searchUsersApi as jest.Mock).mockResolvedValue(mockSearchResults);

    render(<ChatSidebar {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText(/Search users.../i);
    
    fireEvent.change(searchInput, { target: { value: 'search' } });
    
    // Wait for debounce and API call
    await waitFor(() => {
      expect(screen.getByText('Search Result User')).toBeInTheDocument();
    }, { timeout: 2000 });

    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  test('renders "No users found" when search yields no results', async () => {
    (chatService.searchUsersApi as jest.Mock).mockResolvedValue([]);

    render(<ChatSidebar {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText(/Search users.../i);
    
    fireEvent.change(searchInput, { target: { value: 'UnknownUser' } });
    
    await waitFor(() => {
      expect(screen.getByText(/No users found/i)).toBeInTheDocument();
    }, { timeout: 2000 });
  });
});

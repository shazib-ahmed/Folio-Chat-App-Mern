import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MessageList } from '../features/chat/components/MessageList';

/**
 * Mocking dependencies to focus on rendering logic.
 */
jest.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: () => <span data-testid="icon" />
}));

jest.mock('../features/chat/components/MessageBubble', () => ({
  MessageBubble: ({ message }: any) => <div data-testid="message-bubble">{message.text}</div>
}));

const mockMe = { id: '1', name: 'Me', username: 'me' };
const mockChat = { id: '2', name: 'John', username: 'john' };
const mockMessages: any[] = [
  {
    id: 'msg1',
    text: 'Hello World',
    senderId: '1',
    messageType: 'TEXT',
    timestamp: new Date().toISOString(),
    isEncrypted: false
  },
  {
    id: 'msg2',
    text: 'Encrypted Message',
    senderId: '2',
    messageType: 'TEXT',
    timestamp: new Date().toISOString(),
    isEncrypted: true
  }
];

const defaultProps: any = {
  localMessages: mockMessages,
  isLoadingMessages: false,
  isFetchingMore: false,
  isTyping: false,
  isUploading: false,
  me: mockMe,
  chat: mockChat,
  searchResults: [],
  searchMatchIndex: -1,
  highlightedMessageId: null,
  deletingMessageId: null,
  messagesContainerRef: { current: null },
  scrollRef: { current: null },
  handleScroll: jest.fn(),
  onEdit: jest.fn(),
  onDelete: jest.fn(),
  onForward: jest.fn(),
  onReply: jest.fn(),
  onScrollTo: jest.fn(),
  onReact: jest.fn()
};

describe('MessageList Component', () => {
  test('renders the list of messages', () => {
    render(<MessageList {...defaultProps} />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
    expect(screen.getByText('Encrypted Message')).toBeInTheDocument();
  });

  test('renders typing indicator when isTyping is true', () => {
    render(<MessageList {...defaultProps} isTyping={true} />);
    // The typing indicator has 3 dots
    const dots = screen.getAllByRole('generic').filter(el => el.className.includes('animate-typing-dot'));
    expect(dots.length).toBe(3);
  });

  test('renders uploading state when isUploading is true', () => {
    render(<MessageList {...defaultProps} isUploading={true} />);
    expect(screen.getByText(/Uploading file/i)).toBeInTheDocument();
  });

  test('renders fetching more indicator', () => {
    render(<MessageList {...defaultProps} isFetchingMore={true} />);
    expect(screen.getByText(/Loading older messages/i)).toBeInTheDocument();
  });
});

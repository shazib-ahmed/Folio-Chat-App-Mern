import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChatHeader } from '../features/chat/components/ChatHeader';

/**
 * Manual mocks are used for react-router-dom and fontawesome.
 * Important: The FontAwesomeIcon mock must pass through the onClick prop to test interactions.
 */
jest.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: (props: any) => <span data-testid="icon" onClick={props.onClick} />
}));

const mockChat = {
  id: '1',
  name: 'John Doe',
  username: 'johndoe',
  avatar: '',
  online: true,
  unreadCount: 0
};

const defaultProps = {
  chat: mockChat,
  isSearching: false,
  setIsSearching: jest.fn(),
  searchQuery: '',
  setSearchQuery: jest.fn(),
  searchResults: [],
  searchMatchIndex: -1,
  navigateSearch: jest.fn(),
  setSearchResults: jest.fn(),
  isLoadingMessages: false,
  isTyping: false,
  isBlocked: false,
  blockedByMe: false,
  chatStatus: 'ACCEPTED',
  onStartVideoCall: jest.fn(),
  onStartAudioCall: jest.fn(),
  setIsBlockModalOpen: jest.fn(),
  setIsUnblockModalOpen: jest.fn(),
};

describe('ChatHeader Component', () => {
  test('renders user name and online status', () => {
    render(<ChatHeader {...defaultProps} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('online')).toBeInTheDocument();
  });

  test('shows typing status when isTyping is true', () => {
    render(<ChatHeader {...defaultProps} isTyping={true} />);
    expect(screen.getByText('typing...')).toBeInTheDocument();
  });

  test('enters search mode when search icon is clicked', () => {
    render(<ChatHeader {...defaultProps} />);
    const icons = screen.getAllByTestId('icon');
    // Header icon structure: [0: ArrowLeft, 1: Video, 2: Phone, 3: Search, 4: Ban]
    fireEvent.click(icons[3]); 
    expect(defaultProps.setIsSearching).toHaveBeenCalledWith(true);
  });

  test('renders search input when isSearching is true', () => {
    render(<ChatHeader {...defaultProps} isSearching={true} />);
    expect(screen.getByPlaceholderText('Search messages...')).toBeInTheDocument();
  });

  test('calls onStartAudioCall when phone icon is clicked', () => {
    render(<ChatHeader {...defaultProps} />);
    const icons = screen.getAllByTestId('icon');
    // Header icon structure: [0: ArrowLeft, 1: Video, 2: Phone, 3: Search, 4: Ban]
    fireEvent.click(icons[2]);
    expect(defaultProps.onStartAudioCall).toHaveBeenCalled();
  });
});

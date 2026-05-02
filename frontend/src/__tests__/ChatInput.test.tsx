import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChatInput } from '../features/chat/components/ChatInput';

/**
 * Mocking external components, icons, and Redux.
 */
jest.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: (props: any) => <span data-testid="icon" onClick={props.onClick} />
}));

jest.mock('emoji-picker-react', () => () => <div data-testid="emoji-picker" />);

jest.mock('react-redux', () => ({
  useDispatch: () => jest.fn(),
}));

const defaultProps: any = {
  chat: { id: '2', name: 'John', username: 'john' },
  me: { id: '1', name: 'Me', username: 'me' },
  inputText: '',
  setInputText: jest.fn(),
  handleSendMessage: jest.fn(),
  isLoadingMessages: false,
  isBlocked: false,
  blockedByMe: false,
  chatStatus: 'ACCEPTED',
  requesterId: null,
  localMessages: [],
  selectedFile: null,
  filePreview: null,
  removeSelectedFile: jest.fn(),
  handleFileClick: jest.fn(),
  isEmojiPickerOpen: false,
  setIsEmojiPickerOpen: jest.fn(),
  handleEmojiClick: jest.fn(),
  pickerRef: { current: null },
  editingMessage: null,
  setEditingMessage: jest.fn(),
  replyingToMessage: null,
  setReplyingToMessage: jest.fn(),
  isRecording: false,
  recordingTime: 0,
  startRecording: jest.fn(),
  stopRecording: jest.fn(),
  cancelRecording: jest.fn(),
  setIsAcceptModalOpen: jest.fn(),
  setIsBlockModalOpen: jest.fn(),
  setIsUnblockModalOpen: jest.fn(),
  typingTimeoutRef: { current: null }
};

describe('ChatInput Component', () => {
  test('renders input field with placeholder', () => {
    render(<ChatInput {...defaultProps} />);
    expect(screen.getByPlaceholderText(/Type a message.../i)).toBeInTheDocument();
  });

  test('updates text on change', () => {
    render(<ChatInput {...defaultProps} />);
    const input = screen.getByPlaceholderText(/Type a message.../i);
    fireEvent.change(input, { target: { value: 'Hello' } });
    expect(defaultProps.setInputText).toHaveBeenCalledWith('Hello');
  });

  test('triggers handleSendMessage on form submit', () => {
    render(<ChatInput {...defaultProps} inputText="Hello World" />);
    const form = screen.getByLabelText('message-form');
    fireEvent.submit(form);
    expect(defaultProps.handleSendMessage).toHaveBeenCalled();
  });

  test('shows correct message when user is blocked by other', () => {
    render(<ChatInput {...defaultProps} isBlocked={true} />);
    expect(screen.getByText(/This contact has blocked you/i)).toBeInTheDocument();
  });

  test('shows correct message when I blocked the user', () => {
    render(<ChatInput {...defaultProps} isBlocked={true} blockedByMe={true} />);
    expect(screen.getByText(/You have blocked this contact/i)).toBeInTheDocument();
  });

  test('shows recording state when isRecording is true', () => {
    render(<ChatInput {...defaultProps} isRecording={true} recordingTime={5} />);
    // The component renders Math.floor(5/60):"05" -> "0:05"
    expect(screen.getByText('0:05')).toBeInTheDocument();
  });

  test('opens emoji picker when emoji icon is clicked', () => {
    render(<ChatInput {...defaultProps} />);
    const icons = screen.getAllByTestId('icon');
    // Icons: 0: Paperclip, 1: Emoji, 2: Microphone (Send is hidden)
    fireEvent.click(icons[1]);
    expect(defaultProps.setIsEmojiPickerOpen).toHaveBeenCalled();
  });
});

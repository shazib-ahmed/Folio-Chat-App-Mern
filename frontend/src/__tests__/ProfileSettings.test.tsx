import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProfileSettings } from '../features/settings/components/ProfileSettings';
import { useSelector, useDispatch } from 'react-redux';
import { updateProfileApi } from '@/features/auth/authService';

/**
 * Mocking Redux and API services.
 * Note: Using @ alias to match component imports for reliable mocking.
 */
jest.mock('react-redux', () => ({
  useSelector: jest.fn(),
  useDispatch: jest.fn(),
}));

jest.mock('@/features/auth/authService', () => ({
  updateProfileApi: jest.fn(),
}));

jest.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: (props: any) => <span data-testid="icon" className={props.className} />
}));

const mockUser = {
  id: 1,
  name: 'John Doe',
  username: 'johndoe',
  email: 'john@example.com',
  avatar: '',
  phone: '',
  country: ''
};

describe('ProfileSettings Component', () => {
  const mockDispatch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useSelector as unknown as jest.Mock).mockReturnValue({ user: mockUser });
    (useDispatch as unknown as jest.Mock).mockReturnValue(mockDispatch);
  });

  test('renders with user data', () => {
    render(<ProfileSettings />);
    expect(screen.getByLabelText(/Full Name/i)).toHaveValue('John Doe');
    expect(screen.getByLabelText(/Username/i)).toHaveValue('johndoe');
    expect(screen.getByLabelText(/Email Address/i)).toHaveValue('john@example.com');
  });

  test('updates input values on change', () => {
    render(<ProfileSettings />);
    const nameInput = screen.getByLabelText(/Full Name/i);
    fireEvent.change(nameInput, { target: { id: 'profile-name', value: 'Jane Doe' } });
    expect(nameInput).toHaveValue('Jane Doe');
  });

  test('calls updateProfileApi on submit', async () => {
    (updateProfileApi as unknown as jest.Mock).mockResolvedValue({ ...mockUser, name: 'Jane Doe' });
    render(<ProfileSettings />);
    
    const submitButton = screen.getByText(/Save Changes/i);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(updateProfileApi).toHaveBeenCalled();
    });
  });

  test('displays success message after successful update', async () => {
    (updateProfileApi as unknown as jest.Mock).mockResolvedValue({ ...mockUser });
    render(<ProfileSettings />);
    
    fireEvent.click(screen.getByText(/Save Changes/i));

    await waitFor(() => {
      expect(screen.getByText(/Profile updated successfully/i)).toBeInTheDocument();
    });
  });

  test('displays error message on API failure', async () => {
    (updateProfileApi as unknown as jest.Mock).mockRejectedValue({
      response: { data: { message: 'Invalid email' } }
    });
    render(<ProfileSettings />);
    
    fireEvent.click(screen.getByText(/Save Changes/i));

    await waitFor(() => {
      expect(screen.getByText(/Invalid email/i)).toBeInTheDocument();
    });
  });
});

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { jest } from '@jest/globals';
import UserCreateForm from '../UserCreateForm';

// Mock the axios instance
const mockPost = jest.fn();
jest.mock('../../../services/axios', () => ({
  post: mockPost,
}));

// Mock the auth hook
jest.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { is_admin: true },
    token: 'mock-token'
  })
}));

const mockAxios = require('../../../services/axios');

const renderWithChakra = (component) => {
  return render(
    <ChakraProvider>
      {component}
    </ChakraProvider>
  );
};

describe('UserCreateForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the user creation form', () => {
    renderWithChakra(<UserCreateForm />);
    
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/is admin/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create user/i })).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    renderWithChakra(<UserCreateForm />);
    
    const submitButton = screen.getByRole('button', { name: /create user/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
      // Phone and email are now optional, so no required error messages
    });
  });

  it('validates phone number format', async () => {
    renderWithChakra(<UserCreateForm />);
    
    const phoneInput = screen.getByLabelText(/phone number/i);
    fireEvent.change(phoneInput, { target: { value: '123' } });
    
    const submitButton = screen.getByRole('button', { name: /create user/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/phone number must be at least 10 digits/i)).toBeInTheDocument();
    });
  });

  it('validates email format', async () => {
    renderWithChakra(<UserCreateForm />);
    
    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    
    const submitButton = screen.getByRole('button', { name: /create user/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
    });
  });

  it('submits valid form data', async () => {
    const mockResponse = {
      data: {
        user_number: 23,
        first_name: 'Test',
        last_name: 'User',
        full_name: 'Test User',
        phone: '5551234567',
        email: 'test@example.com',
        is_admin: false
      }
    };
    
    mockAxios.post.mockResolvedValueOnce(mockResponse);
    
    renderWithChakra(<UserCreateForm />);
    
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'User' } });
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '5551234567' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    
    const submitButton = screen.getByRole('button', { name: /create user/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockAxios.post).toHaveBeenCalledWith('/users/create', {
        first_name: 'Test',
        last_name: 'User',
        phone: '5551234567',
        email: 'test@example.com',
        is_admin: false
      });
    });
  });

  it('handles submission errors', async () => {
    const mockError = {
      response: {
        data: {
          detail: 'User with this email already exists'
        }
      }
    };
    
    mockAxios.post.mockRejectedValueOnce(mockError);
    
    renderWithChakra(<UserCreateForm />);
    
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'User' } });
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '5551234567' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    
    const submitButton = screen.getByRole('button', { name: /create user/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/user with this email already exists/i)).toBeInTheDocument();
    });
  });

  it('shows loading state during submission', async () => {
    mockAxios.post.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    renderWithChakra(<UserCreateForm />);
    
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'User' } });
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '5551234567' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    
    const submitButton = screen.getByRole('button', { name: /create user/i });
    fireEvent.click(submitButton);
    
    expect(screen.getByText(/creating user/i)).toBeInTheDocument();
  });
});
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { jest } from '@jest/globals';
import UserList from '../UserList';

// Mock the axios instance
const mockGet = jest.fn();
const mockPatch = jest.fn();
const mockDelete = jest.fn();
jest.mock('../../../services/axios', () => ({
  get: mockGet,
  patch: mockPatch,
  delete: mockDelete,
}));

// Mock the auth hook
jest.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { is_admin: true, user_number: 10 },
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

const mockUsers = [
  {
    user_number: 11,
    full_name: 'John Doe',
    phone: '5551234567',
    email: 'john@example.com',
    is_admin: false,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    user_number: 12,
    full_name: 'Jane Smith',
    phone: '5559876543',
    email: 'jane@example.com',
    is_admin: true,
    is_active: true,
    created_at: '2024-01-02T00:00:00Z'
  }
];

describe('UserList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios.get.mockResolvedValue({ data: mockUsers });
  });

  it('renders the user list', async () => {
    renderWithChakra(<UserList />);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  it('displays user information correctly', async () => {
    renderWithChakra(<UserList />);
    
    await waitFor(() => {
      expect(screen.getByText('#11')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('5551234567')).toBeInTheDocument();
      expect(screen.getByText('Staff')).toBeInTheDocument();
      expect(screen.getByText('Admin')).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    mockAxios.get.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    renderWithChakra(<UserList />);
    
    expect(screen.getByText(/loading users/i)).toBeInTheDocument();
  });

  it('handles search functionality', async () => {
    renderWithChakra(<UserList />);
    
    const searchInput = screen.getByPlaceholderText(/search users/i);
    fireEvent.change(searchInput, { target: { value: 'John' } });
    
    await waitFor(() => {
      expect(mockAxios.get).toHaveBeenCalledWith('/users?query=John');
    });
  });

  it('filters by user status', async () => {
    renderWithChakra(<UserList />);
    
    const statusFilter = screen.getByDisplayValue(/all users/i);
    fireEvent.change(statusFilter, { target: { value: 'active' } });
    
    await waitFor(() => {
      expect(mockAxios.get).toHaveBeenCalledWith('/users?is_active=true');
    });
  });

  it('toggles user status', async () => {
    mockAxios.patch.mockResolvedValueOnce({ data: { ...mockUsers[0], is_active: false } });
    
    renderWithChakra(<UserList />);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    const statusToggle = screen.getAllByRole('button', { name: /toggle status/i })[0];
    fireEvent.click(statusToggle);
    
    await waitFor(() => {
      expect(mockAxios.patch).toHaveBeenCalledWith('/users/11/status', { is_active: false });
    });
  });

  it('resets user PIN', async () => {
    mockAxios.patch.mockResolvedValueOnce({ data: { message: 'PIN reset successfully' } });
    
    renderWithChakra(<UserList />);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    const resetButton = screen.getAllByRole('button', { name: /reset pin/i })[0];
    fireEvent.click(resetButton);
    
    await waitFor(() => {
      expect(mockAxios.patch).toHaveBeenCalledWith('/users/11/pin/reset');
    });
  });

  it('prevents self-modification', async () => {
    const currentUserData = [{ ...mockUsers[0], user_number: 10 }];
    mockAxios.get.mockResolvedValueOnce({ data: currentUserData });
    
    renderWithChakra(<UserList />);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    const statusToggle = screen.queryByRole('button', { name: /toggle status/i });
    expect(statusToggle).not.toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    mockAxios.get.mockRejectedValueOnce(new Error('API Error'));
    
    renderWithChakra(<UserList />);
    
    await waitFor(() => {
      expect(screen.getByText(/error loading users/i)).toBeInTheDocument();
    });
  });
});
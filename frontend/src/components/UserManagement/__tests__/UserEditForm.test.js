import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { jest } from '@jest/globals';
import UserEditForm from '../UserEditForm';

// Mock the axios instance
const mockPatch = jest.fn();
jest.mock('../../../services/axios', () => ({
  patch: mockPatch,
}));

const mockAxios = require('../../../services/axios');

const renderWithChakra = (component) => {
  return render(
    <ChakraProvider>
      {component}
    </ChakraProvider>
  );
};

const mockUser = {
  user_number: 23,
  first_name: 'John',
  last_name: 'Doe',
  full_name: 'John Doe',
  phone: '5551234567',
  email: 'john@example.com',
  is_admin: false
};

describe('UserEditForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the user edit form when open', () => {
    renderWithChakra(
      <UserEditForm 
        user={mockUser}
        isOpen={true}
        onClose={() => {}}
        onUserUpdated={() => {}}
      />
    );
    
    expect(screen.getByText('Edit User - John Doe (#23)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('John')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5551234567')).toBeInTheDocument();
    expect(screen.getByDisplayValue('john@example.com')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    renderWithChakra(
      <UserEditForm 
        user={mockUser}
        isOpen={false}
        onClose={() => {}}
        onUserUpdated={() => {}}
      />
    );
    
    expect(screen.queryByText('Edit User - John Doe (#23)')).not.toBeInTheDocument();
  });

  it('validates required fields', async () => {
    renderWithChakra(
      <UserEditForm 
        user={mockUser}
        isOpen={true}
        onClose={() => {}}
        onUserUpdated={() => {}}
      />
    );
    
    // Clear all fields
    fireEvent.change(screen.getByDisplayValue('John Doe'), { target: { value: '' } });
    fireEvent.change(screen.getByDisplayValue('5551234567'), { target: { value: '' } });
    fireEvent.change(screen.getByDisplayValue('john@example.com'), { target: { value: '' } });
    
    const updateButton = screen.getByText('Update User');
    fireEvent.click(updateButton);
    
    await waitFor(() => {
      expect(screen.getByText(/full name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/phone number is required/i)).toBeInTheDocument();
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    });
  });

  it('submits valid form data', async () => {
    const mockOnUserUpdated = jest.fn();
    const mockOnClose = jest.fn();
    
    const updatedUser = {
      ...mockUser,
      full_name: 'John Updated',
      phone: '5559876543',
      email: 'john.updated@example.com',
      is_admin: true
    };
    
    mockAxios.patch.mockResolvedValueOnce({ data: updatedUser });
    
    renderWithChakra(
      <UserEditForm 
        user={mockUser}
        isOpen={true}
        onClose={mockOnClose}
        onUserUpdated={mockOnUserUpdated}
      />
    );
    
    fireEvent.change(screen.getByDisplayValue('John Doe'), { target: { value: 'John Updated' } });
    fireEvent.change(screen.getByDisplayValue('5551234567'), { target: { value: '5559876543' } });
    fireEvent.change(screen.getByDisplayValue('john@example.com'), { target: { value: 'john.updated@example.com' } });
    
    const adminSwitch = screen.getByRole('checkbox');
    fireEvent.click(adminSwitch);
    
    const updateButton = screen.getByText('Update User');
    fireEvent.click(updateButton);
    
    await waitFor(() => {
      expect(mockAxios.patch).toHaveBeenCalledWith('/users/23', {
        full_name: 'John Updated',
        phone: '5559876543',
        email: 'john.updated@example.com',
        is_admin: true
      });
      expect(mockOnUserUpdated).toHaveBeenCalledWith(updatedUser);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('handles submission errors', async () => {
    const mockError = {
      response: {
        data: {
          detail: 'Email already exists'
        }
      }
    };
    
    mockAxios.patch.mockRejectedValueOnce(mockError);
    
    renderWithChakra(
      <UserEditForm 
        user={mockUser}
        isOpen={true}
        onClose={() => {}}
        onUserUpdated={() => {}}
      />
    );
    
    const updateButton = screen.getByText('Update User');
    fireEvent.click(updateButton);
    
    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
    });
  });

  it('shows loading state during submission', async () => {
    mockAxios.patch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    renderWithChakra(
      <UserEditForm 
        user={mockUser}
        isOpen={true}
        onClose={() => {}}
        onUserUpdated={() => {}}
      />
    );
    
    const updateButton = screen.getByText('Update User');
    fireEvent.click(updateButton);
    
    expect(screen.getByText(/updating/i)).toBeInTheDocument();
  });

  it('handles cancel button correctly', () => {
    const mockOnClose = jest.fn();
    
    renderWithChakra(
      <UserEditForm 
        user={mockUser}
        isOpen={true}
        onClose={mockOnClose}
        onUserUpdated={() => {}}
      />
    );
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });
});
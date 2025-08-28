import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AlertBellAction from '../AlertBellAction';
import serviceAlertService from '../../../services/serviceAlertService';

// Mock the service
jest.mock('../../../services/serviceAlertService');

describe('AlertBellAction Component', () => {
  const mockOnBellClick = jest.fn();
  const testCustomerPhone = '1234567890';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders bell icon with no badge when alert count is 0', async () => {
    serviceAlertService.getCustomerAlertCount.mockResolvedValue({
      customer_phone: testCustomerPhone,
      active_count: 0,
      resolved_count: 0,
      total_count: 0
    });

    render(
      <AlertBellAction 
        customerPhone={testCustomerPhone}
        onBellClick={mockOnBellClick}
      />
    );

    await waitFor(() => {
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('title', 'No active service alerts');
      
      // Check that no badge is present
      expect(screen.queryByText(/\d+/)).not.toBeInTheDocument();
    });
  });

  test('renders bell icon with badge showing correct count', async () => {
    serviceAlertService.getCustomerAlertCount.mockResolvedValue({
      customer_phone: testCustomerPhone,
      active_count: 5,
      resolved_count: 2,
      total_count: 7
    });

    render(
      <AlertBellAction 
        customerPhone={testCustomerPhone}
        onBellClick={mockOnBellClick}
      />
    );

    await waitFor(() => {
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('title', '5 active service alerts');
      
      // Check badge shows correct count
      const badge = screen.getByText('5');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-red-500');
    });
  });

  test('shows 99+ when alert count exceeds 99', async () => {
    serviceAlertService.getCustomerAlertCount.mockResolvedValue({
      customer_phone: testCustomerPhone,
      active_count: 150,
      resolved_count: 50,
      total_count: 200
    });

    render(
      <AlertBellAction 
        customerPhone={testCustomerPhone}
        onBellClick={mockOnBellClick}
      />
    );

    await waitFor(() => {
      const badge = screen.getByText('99+');
      expect(badge).toBeInTheDocument();
    });
  });

  test('calls onBellClick when clicked', async () => {
    const mockRefreshCount = jest.fn();
    serviceAlertService.getCustomerAlertCount.mockResolvedValue({
      customer_phone: testCustomerPhone,
      active_count: 3,
      resolved_count: 0,
      total_count: 3
    });

    render(
      <AlertBellAction 
        customerPhone={testCustomerPhone}
        onBellClick={mockOnBellClick}
      />
    );

    await waitFor(() => {
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(mockOnBellClick).toHaveBeenCalledWith(
        testCustomerPhone,
        3,
        expect.any(Function)
      );
    });
  });

  test('shows loading state initially', () => {
    serviceAlertService.getCustomerAlertCount.mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 1000))
    );

    render(
      <AlertBellAction 
        customerPhone={testCustomerPhone}
        onBellClick={mockOnBellClick}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  test('handles API error gracefully', async () => {
    serviceAlertService.getCustomerAlertCount.mockRejectedValue(
      new Error('Network error')
    );

    render(
      <AlertBellAction 
        customerPhone={testCustomerPhone}
        onBellClick={mockOnBellClick}
      />
    );

    await waitFor(() => {
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();
      // Should show 0 count on error
      expect(screen.queryByText(/\d+/)).not.toBeInTheDocument();
    });
  });

  test('refreshes count when refreshCount is called', async () => {
    serviceAlertService.getCustomerAlertCount
      .mockResolvedValueOnce({
        customer_phone: testCustomerPhone,
        active_count: 3,
        resolved_count: 0,
        total_count: 3
      })
      .mockResolvedValueOnce({
        customer_phone: testCustomerPhone,
        active_count: 2,
        resolved_count: 1,
        total_count: 3
      });

    const { rerender } = render(
      <AlertBellAction 
        customerPhone={testCustomerPhone}
        onBellClick={mockOnBellClick}
      />
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    // Simulate calling refreshCount (this would be done via ref in real usage)
    serviceAlertService.getCustomerAlertCount.mockClear();
    rerender(
      <AlertBellAction 
        customerPhone={testCustomerPhone}
        onBellClick={mockOnBellClick}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  test('does not fetch if customerPhone is not provided', () => {
    render(
      <AlertBellAction 
        customerPhone=""
        onBellClick={mockOnBellClick}
      />
    );

    expect(serviceAlertService.getCustomerAlertCount).not.toHaveBeenCalled();
  });

  test('badge has proper animation', async () => {
    serviceAlertService.getCustomerAlertCount.mockResolvedValue({
      customer_phone: testCustomerPhone,
      active_count: 5,
      resolved_count: 0,
      total_count: 5
    });

    render(
      <AlertBellAction 
        customerPhone={testCustomerPhone}
        onBellClick={mockOnBellClick}
      />
    );

    await waitFor(() => {
      const badge = screen.getByText('5');
      expect(badge).toHaveClass('animate-pulse');
      expect(badge).toHaveStyle({ animationDuration: '2s' });
    });
  });

  test('bell icon changes color based on alert presence', async () => {
    // Test with no alerts
    serviceAlertService.getCustomerAlertCount.mockResolvedValue({
      customer_phone: testCustomerPhone,
      active_count: 0,
      resolved_count: 0,
      total_count: 0
    });

    const { rerender } = render(
      <AlertBellAction 
        customerPhone={testCustomerPhone}
        onBellClick={mockOnBellClick}
      />
    );

    await waitFor(() => {
      const bellIcon = screen.getByRole('button').querySelector('svg');
      expect(bellIcon).toHaveClass('text-slate-400');
    });

    // Test with alerts
    serviceAlertService.getCustomerAlertCount.mockResolvedValue({
      customer_phone: testCustomerPhone,
      active_count: 3,
      resolved_count: 0,
      total_count: 3
    });

    rerender(
      <AlertBellAction 
        customerPhone={testCustomerPhone}
        onBellClick={mockOnBellClick}
      />
    );

    await waitFor(() => {
      const bellIcon = screen.getByRole('button').querySelector('svg');
      expect(bellIcon).toHaveClass('text-slate-600');
    });
  });
});
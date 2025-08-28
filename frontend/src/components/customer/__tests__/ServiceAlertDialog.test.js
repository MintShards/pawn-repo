import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import ServiceAlertDialog from '../ServiceAlertDialog';
import serviceAlertService from '../../../services/serviceAlertService';
import { toast } from '../../ui/toast';

// Mock dependencies
jest.mock('../../../services/serviceAlertService');
jest.mock('../../ui/toast');

describe('ServiceAlertDialog Component', () => {
  const mockOnClose = jest.fn();
  const mockOnAlertResolved = jest.fn();
  
  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    customerPhone: '1234567890',
    customerName: 'John Doe',
    onAlertResolved: mockOnAlertResolved
  };

  const mockAlerts = [
    {
      id: '1',
      customer_phone: '1234567890',
      alert_type: 'hold_request',
      priority: 'high',
      title: 'Hold gold ring',
      description: 'Customer wants to hold gold ring for 3 days',
      item_reference: 'Gold Ring - 14K',
      status: 'active',
      created_at: new Date().toISOString(),
      created_by: '69',
      updated_at: new Date().toISOString()
    },
    {
      id: '2',
      customer_phone: '1234567890',
      alert_type: 'payment_arrangement',
      priority: 'medium',
      title: 'Payment plan discussion',
      description: 'Customer needs to discuss payment options',
      item_reference: null,
      status: 'active',
      created_at: new Date().toISOString(),
      created_by: '02',
      updated_at: new Date().toISOString()
    }
  ];

  const mockCustomerItems = [
    {
      id: 'item1',
      description: 'Gold Ring - 14K',
      category: 'jewelry',
      condition: 'excellent',
      status: 'active',
      loan_date: new Date().toISOString(),
      maturity_date: new Date().toISOString()
    },
    {
      id: 'item2',
      description: 'MacBook Pro 2021',
      category: 'electronics',
      condition: 'good',
      status: 'active',
      loan_date: new Date().toISOString(),
      maturity_date: new Date().toISOString()
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    serviceAlertService.getCustomerAlerts.mockResolvedValue({
      alerts: mockAlerts,
      total: 2,
      page: 1,
      per_page: 50,
      has_next: false,
      has_prev: false
    });
    serviceAlertService.getCustomerItems.mockResolvedValue(mockCustomerItems);
  });

  test('renders dialog with customer information', async () => {
    render(<ServiceAlertDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Service Alerts - John Doe/)).toBeInTheDocument();
      expect(screen.getByText('1234567890')).toBeInTheDocument();
      expect(screen.getByText('Manage service alerts and customer requests')).toBeInTheDocument();
    });
  });

  test('displays active alerts correctly', async () => {
    render(<ServiceAlertDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Active Alerts (2)')).toBeInTheDocument();
      expect(screen.getByText('Hold gold ring')).toBeInTheDocument();
      expect(screen.getByText('Payment plan discussion')).toBeInTheDocument();
      
      // Check priority badges
      expect(screen.getByText('HIGH')).toBeInTheDocument();
      expect(screen.getByText('MEDIUM')).toBeInTheDocument();
      
      // Check alert types
      expect(screen.getByText('Hold Request')).toBeInTheDocument();
      expect(screen.getByText('Payment Arrangement')).toBeInTheDocument();
    });
  });

  test('shows empty state when no alerts', async () => {
    serviceAlertService.getCustomerAlerts.mockResolvedValue({
      alerts: [],
      total: 0,
      page: 1,
      per_page: 50,
      has_next: false,
      has_prev: false
    });

    render(<ServiceAlertDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No active alerts for this customer')).toBeInTheDocument();
    });
  });

  test('opens create alert form when Create Alert button clicked', async () => {
    render(<ServiceAlertDialog {...defaultProps} />);

    await waitFor(() => {
      const createButton = screen.getByText('Create Alert');
      fireEvent.click(createButton);
      
      expect(screen.getByText('Create New Alert')).toBeInTheDocument();
      expect(screen.getByLabelText('Alert Type')).toBeInTheDocument();
      expect(screen.getByLabelText('Priority')).toBeInTheDocument();
      expect(screen.getByLabelText('Alert Title')).toBeInTheDocument();
      expect(screen.getByLabelText('Description')).toBeInTheDocument();
    });
  });

  test('submits new alert successfully', async () => {
    serviceAlertService.createAlert.mockResolvedValue({
      id: '3',
      customer_phone: '1234567890',
      alert_type: 'general_note',
      priority: 'low',
      title: 'Test alert',
      description: 'Test description',
      status: 'active',
      created_at: new Date().toISOString(),
      created_by: '69'
    });

    render(<ServiceAlertDialog {...defaultProps} />);

    // Open create form
    await waitFor(() => {
      fireEvent.click(screen.getByText('Create Alert'));
    });

    // Fill form
    const titleInput = screen.getByPlaceholderText('Brief description of the alert');
    const descriptionInput = screen.getByPlaceholderText('Detailed description of the alert');
    
    fireEvent.change(titleInput, { target: { value: 'Test alert' } });
    fireEvent.change(descriptionInput, { target: { value: 'Test description' } });

    // Submit form
    const submitButton = screen.getAllByText('Create Alert')[1]; // Second one is the submit button
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(serviceAlertService.createAlert).toHaveBeenCalledWith({
        customer_phone: '1234567890',
        alert_type: 'general_note',
        priority: 'medium',
        title: 'Test alert',
        description: 'Test description',
        item_reference: ''
      });
      
      expect(toast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'Service alert created successfully'
      });
      
      expect(mockOnAlertResolved).toHaveBeenCalled();
    });
  });

  test('resolves single alert', async () => {
    serviceAlertService.resolveAlert.mockResolvedValue({
      ...mockAlerts[0],
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolved_by: '69'
    });

    render(<ServiceAlertDialog {...defaultProps} />);

    await waitFor(() => {
      const resolveButtons = screen.getAllByText('Resolve');
      fireEvent.click(resolveButtons[0]); // Click first resolve button
    });

    await waitFor(() => {
      expect(serviceAlertService.resolveAlert).toHaveBeenCalledWith('1', null);
      expect(toast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'Alert resolved successfully'
      });
      expect(mockOnAlertResolved).toHaveBeenCalled();
    });
  });

  test('resolves all alerts', async () => {
    serviceAlertService.resolveAllCustomerAlerts.mockResolvedValue({
      message: 'Successfully resolved 2 alerts',
      resolved_count: 2,
      customer_phone: '1234567890'
    });

    render(<ServiceAlertDialog {...defaultProps} />);

    await waitFor(() => {
      const resolveAllButton = screen.getByText('Resolve All');
      fireEvent.click(resolveAllButton);
    });

    await waitFor(() => {
      expect(serviceAlertService.resolveAllCustomerAlerts).toHaveBeenCalledWith(
        '1234567890',
        'Bulk resolution by staff member'
      );
      expect(toast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'All alerts resolved for John Doe'
      });
      expect(mockOnAlertResolved).toHaveBeenCalled();
    });
  });

  test('handles API errors gracefully', async () => {
    serviceAlertService.getCustomerAlerts.mockRejectedValue(
      new Error('Network error')
    );

    render(<ServiceAlertDialog {...defaultProps} />);

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to load service alerts',
        variant: 'destructive'
      });
    });
  });

  test('closes dialog when Close button clicked', async () => {
    render(<ServiceAlertDialog {...defaultProps} />);

    await waitFor(() => {
      const closeButton = screen.getByText('Close');
      fireEvent.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  test('priority badges have correct colors', async () => {
    render(<ServiceAlertDialog {...defaultProps} />);

    await waitFor(() => {
      const highPriorityBadge = screen.getByText('HIGH').parentElement;
      const mediumPriorityBadge = screen.getByText('MEDIUM').parentElement;
      
      expect(highPriorityBadge).toHaveClass('bg-red-100', 'text-red-800');
      expect(mediumPriorityBadge).toHaveClass('bg-yellow-100', 'text-yellow-800');
    });
  });

  test('displays item reference when present', async () => {
    render(<ServiceAlertDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Item:')).toBeInTheDocument();
      expect(screen.getByText('Gold Ring - 14K')).toBeInTheDocument();
    });
  });

  test('shows loading state correctly', () => {
    serviceAlertService.getCustomerAlerts.mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 1000))
    );

    render(<ServiceAlertDialog {...defaultProps} />);

    expect(screen.getByText('Loading alerts...')).toBeInTheDocument();
  });

  test('cancels create alert form', async () => {
    render(<ServiceAlertDialog {...defaultProps} />);

    // Open create form
    await waitFor(() => {
      fireEvent.click(screen.getByText('Create Alert'));
    });

    // Click cancel
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    // Form should be hidden
    expect(screen.queryByText('Create New Alert')).not.toBeInTheDocument();
  });

  test('validates form fields', async () => {
    render(<ServiceAlertDialog {...defaultProps} />);

    // Open create form
    await waitFor(() => {
      fireEvent.click(screen.getByText('Create Alert'));
    });

    // Try to submit with empty fields
    const submitButton = screen.getAllByText('Create Alert')[1];
    fireEvent.click(submitButton);

    // Form should still be open (not submitted due to validation)
    expect(screen.getByText('Create New Alert')).toBeInTheDocument();
  });

  test('handles dialog close properly', () => {
    const { rerender } = render(<ServiceAlertDialog {...defaultProps} />);
    
    // Close dialog
    rerender(<ServiceAlertDialog {...defaultProps} isOpen={false} />);
    
    // Dialog should not be visible
    expect(screen.queryByText(/Service Alerts - John Doe/)).not.toBeInTheDocument();
  });
});
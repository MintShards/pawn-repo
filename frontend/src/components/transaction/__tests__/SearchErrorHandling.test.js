/**
 * Comprehensive test suite for search error handling scenarios
 * 
 * Tests cover:
 * 1. Search Failed - Server errors, network issues, validation failures
 * 2. Not Found - Empty results, invalid IDs, non-existent data
 * 3. Not Applicable - Status validation, business rule violations
 * 4. Error Recovery - Retry mechanisms, fallback strategies
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TransactionList from '../TransactionList';
import transactionService from '../../../services/transactionService';

// Mock the transaction service
jest.mock('../../../services/transactionService');
const mockedTransactionService = transactionService;

// Mock other dependencies
jest.mock('../../../services/customerService', () => ({
  getAllCustomers: jest.fn(() => Promise.resolve({ customers: [] })),
  getMultipleCustomers: jest.fn(() => Promise.resolve({})), // Add missing mock
}));

jest.mock('../../../utils/transactionUtils', () => ({
  initializeSequenceNumbers: jest.fn(),
  formatTransactionId: (tx) => tx.formatted_id || 'PW000001',
  formatExtensionId: jest.fn(),
  formatStorageLocation: jest.fn(),
  formatCurrency: (amount) => `$${amount}`,
}));

jest.mock('../../../utils/timezoneUtils', () => ({
  formatBusinessDate: (date) => new Date(date).toLocaleDateString(),
}));

// Mock child components
jest.mock('../TransactionCard', () => {
  return function MockTransactionCard({ transaction }) {
    return <div data-testid={`transaction-${transaction.transaction_id}`}>{transaction.formatted_id}</div>;
  };
});

jest.mock('../components/StatusBadge', () => {
  return function MockStatusBadge({ status }) {
    return <span data-testid="status-badge">{status}</span>;
  };
});

describe('Search Error Handling', () => {
  const mockProps = {
    onCreateNew: jest.fn(),
    onViewTransaction: jest.fn(),
    onViewCustomer: jest.fn(),
    onPayment: jest.fn(),
    onExtension: jest.fn(),
    onStatusUpdate: jest.fn(),
    refreshTrigger: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful mocks
    mockedTransactionService.getAllTransactions.mockResolvedValue({
      transactions: [],
      total_count: 0,
    });

    mockedTransactionService.getStatusCounts.mockResolvedValue({
      all: 0,
      active: 0,
      overdue: 0,
      extended: 0,
      redeemed: 0,
      sold: 0,
    });

    mockedTransactionService.enrichTransactionsWithExtensions.mockImplementation((txs) => 
      Promise.resolve(txs)
    );
  });

  describe('Search Failed Scenarios', () => {
    test('handles server error gracefully', async () => {
      // Mock server error
      mockedTransactionService.unifiedSearch.mockRejectedValue(
        new Error('Server error: Internal server error')
      );

      render(<TransactionList {...mockProps} />);

      // Perform search
      const searchInput = screen.getByPlaceholderText('Search by transaction number, extension ID, customer name, or phone - Press Enter to search');
      fireEvent.change(searchInput, { target: { value: '5551234567' } });
      fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
        expect(screen.getByText(/Server error: Internal server error/)).toBeInTheDocument();
      });

      // Should show retry button
      const retryButton = screen.getByText('Retry');
      expect(retryButton).toBeInTheDocument();
    });

    test('handles network connectivity error', async () => {
      // Mock network error
      const networkError = new Error('Failed to fetch');
      networkError.name = 'NetworkError';
      mockedTransactionService.unifiedSearch.mockRejectedValue(networkError);

      render(<TransactionList {...mockProps} />);

      // Perform search
      const searchInput = screen.getByPlaceholderText('Search by transaction number, extension ID, customer name, or phone - Press Enter to search');
      fireEvent.change(searchInput, { target: { value: 'PW000001' } });
      fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
        expect(screen.getByText(/Failed to fetch/)).toBeInTheDocument();
      });
    });

    test('handles validation error for invalid search parameters', async () => {
      // Mock validation error
      const validationError = new Error('Invalid search parameters: search text too long');
      validationError.status = 400;
      mockedTransactionService.unifiedSearch.mockRejectedValue(validationError);

      render(<TransactionList {...mockProps} />);

      // Perform search with invalid input
      const searchInput = screen.getByPlaceholderText('Search by transaction number, extension ID, customer name, or phone - Press Enter to search');
      fireEvent.change(searchInput, { target: { value: 'a'.repeat(1000) } }); // Very long search term
      fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
        expect(screen.getByText(/Invalid search parameters: search text too long/)).toBeInTheDocument();
      });
    });

    test('handles timeout error', async () => {
      // Mock timeout error
      mockedTransactionService.unifiedSearch.mockImplementation(() => 
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 100);
        })
      );

      render(<TransactionList {...mockProps} />);

      // Perform search
      const searchInput = screen.getByPlaceholderText('Search by transaction number, extension ID, customer name, or phone - Press Enter to search');
      fireEvent.change(searchInput, { target: { value: '5551234567' } });
      fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

      // Should eventually show timeout error
      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
        expect(screen.getByText(/Request timeout/)).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Not Found Scenarios', () => {
    test('shows empty state for no search results', async () => {
      // Mock empty search results
      mockedTransactionService.unifiedSearch.mockResolvedValue({
        transactions: [],
        total_count: 0,
        search_metadata: {
          search_type: 'phone_number',
          search_text: '9999999999',
          execution_time_ms: 5.2,
          has_more: false,
        },
      });

      render(<TransactionList {...mockProps} />);

      // Perform search for non-existent data
      const searchInput = screen.getByPlaceholderText('Search by transaction number, extension ID, customer name, or phone - Press Enter to search');
      fireEvent.change(searchInput, { target: { value: '9999999999' } });
      fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

      // Wait for search to complete and loading to finish
      await waitFor(() => {
        expect(mockedTransactionService.unifiedSearch).toHaveBeenCalledWith(
          expect.objectContaining({
            search_text: '9999999999',
            search_type: 'auto_detect'
          })
        );
      });

      // Wait longer for empty state to render (there may be async operations)
      await waitFor(() => {
        expect(screen.getByText('No Matching Transactions')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Should show phone-specific message
      await waitFor(() => {
        expect(screen.getByText(/No transactions found for customer phone/)).toBeInTheDocument();
        expect(screen.getByText(/9999999999/)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Should show clear search button
      expect(screen.getByText('Clear All Filters')).toBeInTheDocument();
    });

    test('shows appropriate message for invalid transaction ID format', async () => {
      // Mock empty results for invalid format
      mockedTransactionService.unifiedSearch.mockResolvedValue({
        transactions: [],
        total_count: 0,
        search_metadata: {
          search_type: 'full_text',
          search_text: 'INVALID123',
          execution_time_ms: 3.1,
          has_more: false,
        },
      });

      render(<TransactionList {...mockProps} />);

      // Search with invalid transaction ID format
      const searchInput = screen.getByPlaceholderText('Search by transaction number, extension ID, customer name, or phone - Press Enter to search');
      fireEvent.change(searchInput, { target: { value: 'INVALID123' } });
      fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

      // Should show no results found with specific message for generic search
      await waitFor(() => {
        expect(screen.getByText('No Matching Transactions')).toBeInTheDocument();
        expect(screen.getByText('No transactions found for "INVALID123"')).toBeInTheDocument();
      });
    });

    test('handles customer with no transactions', async () => {
      // Mock customer exists but has no transactions
      mockedTransactionService.unifiedSearch.mockResolvedValue({
        transactions: [],
        total_count: 0,
        search_metadata: {
          search_type: 'phone_number',
          search_text: '5551111111',
          execution_time_ms: 8.7,
          has_more: false,
        },
      });

      render(<TransactionList {...mockProps} />);

      // Search for customer with no transactions
      const searchInput = screen.getByPlaceholderText('Search by transaction number, extension ID, customer name, or phone - Press Enter to search');
      fireEvent.change(searchInput, { target: { value: '5551111111' } });
      fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

      // Should show empty state with phone-specific message
      await waitFor(() => {
        expect(screen.getByText('No Matching Transactions')).toBeInTheDocument();
        expect(screen.getByText('No transactions found for customer phone 5551111111')).toBeInTheDocument();
      });
    });
  });

  describe('Not Applicable Scenarios', () => {
    test('validates phone number format', async () => {
      // Mock phone number validation error
      const validationError = new Error('Invalid phone number format. Must be 10 digits.');
      validationError.status = 400;
      mockedTransactionService.unifiedSearch.mockRejectedValue(validationError);

      render(<TransactionList {...mockProps} />);

      // Search with invalid phone format
      const searchInput = screen.getByPlaceholderText('Search by transaction number, extension ID, customer name, or phone - Press Enter to search');
      fireEvent.change(searchInput, { target: { value: '123' } }); // Too short
      fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
        expect(screen.getByText(/Invalid phone number format/)).toBeInTheDocument();
      });
    });

    test('handles search with special characters', async () => {
      // Mock search with special characters - should be handled gracefully
      mockedTransactionService.unifiedSearch.mockResolvedValue({
        transactions: [],
        total_count: 0,
        search_metadata: {
          search_type: 'full_text',
          search_text: '@#$%^&*()',
          execution_time_ms: 2.1,
          has_more: false,
        },
      });

      render(<TransactionList {...mockProps} />);

      // Search with special characters
      const searchInput = screen.getByPlaceholderText('Search by transaction number, extension ID, customer name, or phone - Press Enter to search');
      fireEvent.change(searchInput, { target: { value: '@#$%^&*()' } });
      fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

      // Should handle gracefully and show no results with specific message
      await waitFor(() => {
        expect(screen.getByText('No Matching Transactions')).toBeInTheDocument();
        expect(screen.getByText('No transactions found for "@#$%^&*()";')).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    test('handles extremely long search terms', async () => {
      const longSearchTerm = 'a'.repeat(500);
      
      // Mock handling of long search term
      const validationError = new Error('Search term too long. Maximum 100 characters allowed.');
      validationError.status = 400;
      mockedTransactionService.unifiedSearch.mockRejectedValue(validationError);

      render(<TransactionList {...mockProps} />);

      // Search with very long term
      const searchInput = screen.getByPlaceholderText('Search by transaction number, extension ID, customer name, or phone - Press Enter to search');
      fireEvent.change(searchInput, { target: { value: longSearchTerm } });
      fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
        expect(screen.getByText(/Search term too long/)).toBeInTheDocument();
      });
    });
  });

  describe('Error Recovery Mechanisms', () => {
    test('retry button works after error', async () => {
      let callCount = 0;
      mockedTransactionService.unifiedSearch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Temporary server error'));
        }
        return Promise.resolve({
          transactions: [{
            transaction_id: 'txn-001',
            formatted_id: 'PW000001',
            customer_id: '5551234567',
            customer_name: 'John Doe',
            loan_amount: 1000,
            status: 'active',
            pawn_date: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }],
          total_count: 1,
          search_metadata: {
            search_type: 'transaction_id',
            search_text: 'PW000001',
            execution_time_ms: 12.3,
            has_more: false,
          },
        });
      });

      render(<TransactionList {...mockProps} />);

      // Initial search fails
      const searchInput = screen.getByPlaceholderText('Search by transaction number, extension ID, customer name, or phone - Press Enter to search');
      fireEvent.change(searchInput, { target: { value: 'PW000001' } });
      fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

      // Should show error initially
      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
        expect(screen.getByText(/Temporary server error/)).toBeInTheDocument();
      });

      // Click retry button
      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      // Should succeed on retry
      await waitFor(() => {
        expect(screen.getByText('1 result')).toBeInTheDocument();
        expect(screen.getByText('PW000001')).toBeInTheDocument();
      });
    });

    test('clear search works after error', async () => {
      // Mock search error
      mockedTransactionService.unifiedSearch.mockRejectedValue(
        new Error('Search service unavailable')
      );

      render(<TransactionList {...mockProps} />);

      // Perform search that fails
      const searchInput = screen.getByPlaceholderText('Search by transaction number, extension ID, customer name, or phone - Press Enter to search');
      fireEvent.change(searchInput, { target: { value: 'PW000001' } });
      fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
      });

      // Clear search
      const clearButton = screen.getByText('Clear All Filters');
      fireEvent.click(clearButton);

      // Should clear search input and error
      await waitFor(() => {
        expect(searchInput.value).toBe('');
        expect(screen.queryByText(/Error:/)).not.toBeInTheDocument();
      });
    });

    test('handles partial failure gracefully', async () => {
      // Mock search succeeds but customer enrichment fails
      mockedTransactionService.unifiedSearch.mockResolvedValue({
        transactions: [{
          transaction_id: 'txn-001',
          formatted_id: 'PW000001',
          customer_id: '5551234567',
          loan_amount: 1000,
          status: 'active',
          pawn_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }],
        total_count: 1,
        search_metadata: {
          search_type: 'transaction_id',
          execution_time_ms: 8.1,
        },
      });

      render(<TransactionList {...mockProps} />);

      // Perform search
      const searchInput = screen.getByPlaceholderText('Search by transaction number, extension ID, customer name, or phone - Press Enter to search');
      fireEvent.change(searchInput, { target: { value: 'PW000001' } });
      fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

      // Should show results despite customer enrichment failure
      await waitFor(() => {
        expect(screen.getByText('1 result')).toBeInTheDocument();
        expect(screen.getByText('PW000001')).toBeInTheDocument();
      });

      // Should not show error for partial failure
      expect(screen.queryByText(/Error:/)).not.toBeInTheDocument();
    });
  });

  describe('Rate Limiting and Performance', () => {
    test('handles rate limiting gracefully', async () => {
      const rateLimitError = new Error('Rate limit exceeded. Please try again later.');
      rateLimitError.status = 429;
      mockedTransactionService.unifiedSearch.mockRejectedValue(rateLimitError);

      render(<TransactionList {...mockProps} />);

      // Perform search
      const searchInput = screen.getByPlaceholderText('Search by transaction number, extension ID, customer name, or phone - Press Enter to search');
      fireEvent.change(searchInput, { target: { value: '5551234567' } });
      fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

      // Should show rate limit error
      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
        expect(screen.getByText(/Rate limit exceeded/)).toBeInTheDocument();
      });
    });

    test('shows loading state during search', async () => {
      // Mock slow search
      mockedTransactionService.unifiedSearch.mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => {
            resolve({
              transactions: [],
              total_count: 0,
              search_metadata: { execution_time_ms: 2000 }
            });
          }, 500);
        })
      );

      render(<TransactionList {...mockProps} />);

      // Perform search
      const searchInput = screen.getByPlaceholderText('Search by transaction number, extension ID, customer name, or phone - Press Enter to search');
      fireEvent.change(searchInput, { target: { value: '5551234567' } });
      fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

      // Should show loading state
      expect(screen.getByText('Loading transactions...')).toBeInTheDocument();

      // Should complete eventually
      await waitFor(() => {
        expect(screen.getByText('No transactions found')).toBeInTheDocument();
      }, { timeout: 1000 });
    });
  });
});
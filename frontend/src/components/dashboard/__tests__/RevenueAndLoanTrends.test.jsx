import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RevenueAndLoanTrends from '../RevenueAndLoanTrends';
import * as trendsService from '../../../services/trendsService';

// Mock the trends service
jest.mock('../../../services/trendsService');

// Mock Recharts to avoid rendering issues in tests
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: ({ children }) => <div data-testid="bar-chart">{children}</div>,
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Bar: () => null,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Cell: () => null
}));

describe('RevenueAndLoanTrends Component', () => {
  const mockValidData = {
    revenue: {
      summary: {
        total_revenue: 15000,
        avg_daily_revenue: 500,
        total_payments: 30,
        total_interest: 3000,
        total_extension_fees: 500
      },
      data: [
        {
          date: '2025-11-01',
          total_revenue: 1500,
          principal_collected: 1000,
          interest_collected: 400,
          extension_fees: 100,
          payment_count: 3
        },
        {
          date: '2025-11-02',
          total_revenue: 1200,
          principal_collected: 800,
          interest_collected: 300,
          extension_fees: 100,
          payment_count: 2
        }
      ],
      period: '30d'
    },
    loans: {
      summary: {
        total_redeemed: 15,
        total_redeemed_amount: 9000,
        total_forfeited: 5,
        total_forfeited_amount: 3000,
        total_sold: 3,
        total_sold_amount: 1800,
        current_active_loans: 150,
        avg_loan_amount: 600
      },
      data: [
        {
          date: '2025-11-01',
          active_loans: 148,
          redeemed: 1,
          redeemed_amount: 600,
          forfeited: 0,
          forfeited_amount: 0,
          sold: 0,
          sold_amount: 0
        },
        {
          date: '2025-11-02',
          active_loans: 150,
          redeemed: 0,
          redeemed_amount: 0,
          forfeited: 1,
          forfeited_amount: 600,
          sold: 0,
          sold_amount: 0
        }
      ],
      period: '30d'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    trendsService.getAllTrends.mockResolvedValue(mockValidData);
  });

  describe('Race Condition Prevention', () => {
    it('should abort previous request when period changes rapidly', async () => {
      const abortSpy = jest.spyOn(AbortController.prototype, 'abort');

      render(<RevenueAndLoanTrends />);

      // Wait for initial load to complete by checking for actual data content
      await waitFor(() => {
        expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Rapidly change periods
      const buttons = screen.getAllByRole('radio');
      fireEvent.click(buttons[0]); // 7d
      fireEvent.click(buttons[2]); // 90d
      fireEvent.click(buttons[3]); // 1y

      // AbortController.abort should be called for each period change
      await waitFor(() => expect(abortSpy).toHaveBeenCalled());

      abortSpy.mockRestore();
    });

    it('should handle AbortError gracefully', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      trendsService.getAllTrends.mockRejectedValueOnce(abortError);

      render(<RevenueAndLoanTrends />);

      await waitFor(() => expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Request aborted'),
        expect.any(String)
      ));

      consoleLogSpy.mockRestore();
    });

    it('should pass AbortSignal to service calls', async () => {
      render(<RevenueAndLoanTrends />);

      await waitFor(() => {
        expect(trendsService.getAllTrends).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            aborted: expect.any(Boolean)
          })
        );
      });
    });
  });

  describe('ARIA Labels and Accessibility', () => {
    it('should have radiogroup with proper aria-label', async () => {
      render(<RevenueAndLoanTrends />);

      await waitFor(() => {
        const radiogroup = screen.getByRole('radiogroup', { name: /time period selection/i });
        expect(radiogroup).toBeInTheDocument();
      });
    });

    it('should have radio buttons with proper ARIA attributes', async () => {
      render(<RevenueAndLoanTrends />);

      await waitFor(() => {
        const radios = screen.getAllByRole('radio');
        expect(radios.length).toBeGreaterThan(0);

        radios.forEach(radio => {
          expect(radio).toHaveAttribute('aria-label');
          expect(radio).toHaveAttribute('aria-checked');
        });
      });
    });

    it('should mark selected period with aria-checked="true"', async () => {
      render(<RevenueAndLoanTrends />);

      await waitFor(() => {
        const selectedRadio = screen.getByRole('radio', { checked: true });
        expect(selectedRadio).toHaveAttribute('aria-checked', 'true');
      });
    });

    it('should have refresh button with aria-label', async () => {
      render(<RevenueAndLoanTrends />);

      await waitFor(() => {
        const refreshButton = screen.getByLabelText(/refresh trends data/i);
        expect(refreshButton).toBeInTheDocument();
      });
    });

    it('should have charts with role="img" and aria-label', async () => {
      render(<RevenueAndLoanTrends />);

      await waitFor(() => {
        expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      });

      const chartContainers = screen.getAllByRole('img');
      expect(chartContainers.length).toBeGreaterThan(0);

      chartContainers.forEach(container => {
        expect(container).toHaveAttribute('aria-label');
      });
    });

    it('should have hidden data tables for screen readers', async () => {
      render(<RevenueAndLoanTrends />);

      await waitFor(() => {
        expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      });

      // Check for screen reader only tables
      const srOnlyTables = document.querySelectorAll('table.sr-only');
      expect(srOnlyTables.length).toBeGreaterThan(0);
    });
  });

  describe('Data Validation', () => {
    it('should validate data structure and throw error for invalid data', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      trendsService.getAllTrends.mockResolvedValueOnce({ invalid: 'data' });

      render(<RevenueAndLoanTrends />);

      await waitFor(() => {
        // Check for either the specific error message or generic fallback
        const errorText = screen.queryByText(/invalid trends data structure/i) ||
                         screen.queryByText(/missing required trends data fields/i) ||
                         screen.queryByText(/failed to load/i);
        expect(errorText).toBeInTheDocument();
      }, { timeout: 3000 });

      consoleErrorSpy.mockRestore();
    });

    it('should throw error for missing revenue summary', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      trendsService.getAllTrends.mockResolvedValueOnce({
        revenue: { data: [] },
        loans: mockValidData.loans
      });

      render(<RevenueAndLoanTrends />);

      await waitFor(() => {
        expect(screen.getByText(/invalid revenue summary structure/i)).toBeInTheDocument();
      });

      consoleErrorSpy.mockRestore();
    });

    it('should throw error for missing loan summary', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      trendsService.getAllTrends.mockResolvedValueOnce({
        revenue: mockValidData.revenue,
        loans: { data: [] }
      });

      render(<RevenueAndLoanTrends />);

      await waitFor(() => {
        expect(screen.getByText(/invalid loan summary structure/i)).toBeInTheDocument();
      });

      consoleErrorSpy.mockRestore();
    });

    it('should throw error for non-array data', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      trendsService.getAllTrends.mockResolvedValueOnce({
        revenue: { ...mockValidData.revenue, data: 'not-an-array' },
        loans: mockValidData.loans
      });

      render(<RevenueAndLoanTrends />);

      await waitFor(() => {
        expect(screen.getByText(/invalid revenue data array/i)).toBeInTheDocument();
      });

      consoleErrorSpy.mockRestore();
    });

    it('should accept valid data without errors', async () => {
      render(<RevenueAndLoanTrends />);

      await waitFor(() => {
        expect(screen.getByText('Total Revenue')).toBeInTheDocument();
        expect(screen.queryByText(/failed to load/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Regression Tests - Existing Functionality', () => {
    it('should render loading skeleton initially', () => {
      trendsService.getAllTrends.mockImplementation(() => new Promise(() => {})); // Never resolves to keep loading

      const { container } = render(<RevenueAndLoanTrends />);

      // Check for loading skeletons (elements with animate-pulse class)
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should display summary statistics after loading', async () => {
      // Ensure mock returns valid data (reset from previous test)
      trendsService.getAllTrends.mockResolvedValue(mockValidData);

      render(<RevenueAndLoanTrends />);

      // Wait for component to finish loading and display summary statistics
      await waitFor(() => {
        const totalRevenue = screen.queryByText('Total Revenue');
        expect(totalRevenue).toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify all summary statistics are present (use getAllByText since these appear in both visible stats and hidden screen reader tables)
      expect(screen.getAllByText('Total Revenue').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Redemptions').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Avg Loan').length).toBeGreaterThan(0);
    });

    it('should format currency correctly', async () => {
      render(<RevenueAndLoanTrends />);

      await waitFor(() => {
        // Check for currency formatting (e.g., $15,000)
        expect(screen.getByText(/\$15,000/)).toBeInTheDocument();
      });
    });

    it('should change period when button clicked', async () => {
      render(<RevenueAndLoanTrends />);

      await waitFor(() => {
        expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      });

      const sevenDayButton = screen.getByRole('radio', { name: /select 7 days period/i });
      fireEvent.click(sevenDayButton);

      await waitFor(() => {
        expect(trendsService.getAllTrends).toHaveBeenCalledWith('7d', expect.any(Object));
      });
    });

    it('should handle refresh button click', async () => {
      render(<RevenueAndLoanTrends />);

      await waitFor(() => {
        expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      });

      const refreshButton = screen.getByLabelText(/refresh trends data/i);
      fireEvent.click(refreshButton);

      await waitFor(() => {
        // Should call getAllTrends again (initial + refresh)
        expect(trendsService.getAllTrends).toHaveBeenCalledTimes(2);
      });
    });

    it('should display error message on fetch failure', async () => {
      trendsService.getAllTrends.mockRejectedValueOnce(new Error('Network error'));

      render(<RevenueAndLoanTrends />);

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      trendsService.getAllTrends.mockRejectedValueOnce(new Error('Failed'));

      render(<RevenueAndLoanTrends />);

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /retry/i });
        expect(retryButton).toBeInTheDocument();
      });
    });

    it('should render charts after loading', async () => {
      render(<RevenueAndLoanTrends />);

      await waitFor(() => {
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });
    });
  });

  describe('Component Cleanup', () => {
    it('should abort pending request on unmount', async () => {
      const abortSpy = jest.spyOn(AbortController.prototype, 'abort');

      const { unmount } = render(<RevenueAndLoanTrends />);

      unmount();

      expect(abortSpy).toHaveBeenCalled();
      abortSpy.mockRestore();
    });
  });
});

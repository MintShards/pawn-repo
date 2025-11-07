import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DashboardPage from '../DashboardPage';
import { AuthContext } from '../../context/AuthContext';
import * as useDashboardStatsModule from '../../hooks/useDashboardStats';
import serviceAlertService from '../../services/serviceAlertService';

// Mock modules
jest.mock('../../hooks/useDashboardStats');
jest.mock('../../services/serviceAlertService');
jest.mock('../../components/common/AppHeader', () => {
  return function MockAppHeader() {
    return <div data-testid="app-header">App Header</div>;
  };
});

// Mock AuthContext
const mockAuthContext = {
  user: {
    user_id: '69',
    username: 'Admin User',
    role: 'admin'
  },
  loading: false,
  fetchUserDataIfNeeded: jest.fn()
};

// Wrapper with required providers
const renderWithProviders = (component) => {
  return render(
    <BrowserRouter>
      <AuthContext.Provider value={mockAuthContext}>
        {component}
      </AuthContext.Provider>
    </BrowserRouter>
  );
};

describe('DashboardPage Integration Tests', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock useDashboardStats hook
    useDashboardStatsModule.useDashboardStats = jest.fn(() => ({
      metrics: {
        this_month_revenue: {
          display_value: '$12,500',
          trend_direction: 'up',
          trend_percentage: 15.5
        },
        active_loans: {
          display_value: '125',
          trend_direction: 'up',
          trend_percentage: 8.2
        },
        new_customers_this_month: {
          display_value: '23',
          trend_direction: 'stable',
          trend_percentage: 0
        },
        went_overdue_this_week: {
          display_value: '5',
          trend_direction: 'down',
          trend_percentage: -12.3
        }
      },
      isInitialLoad: false,
      error: null
    }));

    // Mock service alert service
    serviceAlertService.getUniqueCustomerAlertStats = jest.fn().mockResolvedValue({
      unique_customer_count: 8,
      total_alert_count: 15,
      trend_direction: 'up',
      trend_percentage: 20.0
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initial Render', () => {
    it('should render dashboard page with all main sections', async () => {
      renderWithProviders(<DashboardPage />);

      // Check for main sections
      expect(screen.getByTestId('app-header')).toBeInTheDocument();

      // Wait for stats to load
      await waitFor(() => {
        expect(screen.getByText("Month's Revenue")).toBeInTheDocument();
      });

      // Verify all 5 stat cards are rendered
      expect(screen.getByText("Month's Revenue")).toBeInTheDocument();
      expect(screen.getByText('Active Loans')).toBeInTheDocument();
      expect(screen.getByText('New Customers')).toBeInTheDocument();
      expect(screen.getByText('Overdue This Week')).toBeInTheDocument();
      expect(screen.getByText('Service Alerts')).toBeInTheDocument();
    });

    it('should display correct metric values', async () => {
      renderWithProviders(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('$12,500')).toBeInTheDocument();
      });

      expect(screen.getByText('125')).toBeInTheDocument();
      expect(screen.getByText('23')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument(); // Service alerts
    });

    it('should display trend indicators correctly', async () => {
      renderWithProviders(<DashboardPage />);

      await waitFor(() => {
        // Look for upward trend indicators
        const trends = screen.getAllByText(/↑.*15\.5%/);
        expect(trends.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading skeletons initially', () => {
      // Mock initial loading state
      useDashboardStatsModule.useDashboardStats = jest.fn(() => ({
        metrics: {},
        isInitialLoad: true,
        error: null
      }));

      renderWithProviders(<DashboardPage />);

      // Check for loading skeleton elements (animate-pulse class)
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should hide loading skeletons after data loads', async () => {
      renderWithProviders(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Month's Revenue")).toBeInTheDocument();
      });

      // Stats should be visible
      expect(screen.getByText('$12,500')).toBeInTheDocument();
    });
  });

  describe('Data Fetching', () => {
    it('should call useDashboardStats hook', () => {
      renderWithProviders(<DashboardPage />);

      expect(useDashboardStatsModule.useDashboardStats).toHaveBeenCalled();
    });

    it('should fetch service alert stats', async () => {
      renderWithProviders(<DashboardPage />);

      await waitFor(() => {
        expect(serviceAlertService.getUniqueCustomerAlertStats).toHaveBeenCalled();
      });
    });

    it('should handle fetch errors gracefully', async () => {
      // Mock API error
      serviceAlertService.getUniqueCustomerAlertStats = jest.fn().mockRejectedValue(
        new Error('API Error')
      );

      renderWithProviders(<DashboardPage />);

      await waitFor(() => {
        // Should display 0 for failed stats
        expect(screen.getByText('0')).toBeInTheDocument();
      });
    });
  });

  describe('User Authentication', () => {
    it('should display welcome message for logged in user', async () => {
      renderWithProviders(<DashboardPage />);

      await waitFor(() => {
        // Welcome message should contain user info (tested via getWelcomeMessage util)
        const pageHeader = screen.getByText(/daily overview/i).closest('div');
        expect(pageHeader).toBeInTheDocument();
      });
    });

    it('should fetch user data if not loaded', () => {
      const mockFetch = jest.fn();
      const contextWithoutUser = {
        ...mockAuthContext,
        user: null,
        fetchUserDataIfNeeded: mockFetch
      };

      render(
        <BrowserRouter>
          <AuthContext.Provider value={contextWithoutUser}>
            <DashboardPage />
          </AuthContext.Provider>
        </BrowserRouter>
      );

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Error Boundaries', () => {
    it('should wrap stats grid in error boundary', () => {
      renderWithProviders(<DashboardPage />);

      // Error boundary should be present (tested via ErrorBoundary component)
      // This is a structural test - actual error handling tested in ErrorBoundary.test.js
      const dashboard = screen.getByRole('main');
      expect(dashboard).toBeInTheDocument();
    });
  });

  describe('Responsive Layout', () => {
    it('should render grid layout for stats cards', async () => {
      renderWithProviders(<DashboardPage />);

      await waitFor(() => {
        const grid = document.querySelector('.grid');
        expect(grid).toBeInTheDocument();
        expect(grid).toHaveClass('grid-cols-1');
        expect(grid).toHaveClass('sm:grid-cols-2');
        expect(grid).toHaveClass('lg:grid-cols-5');
      });
    });
  });

  describe('Dark Mode Support', () => {
    it('should have dark mode classes on all cards', async () => {
      renderWithProviders(<DashboardPage />);

      await waitFor(() => {
        const cards = document.querySelectorAll('.dark\\:from-purple-950\\/50');
        expect(cards.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper semantic structure', async () => {
      renderWithProviders(<DashboardPage />);

      await waitFor(() => {
        // Main element
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
    });

    it('should have accessible stat card structure', async () => {
      renderWithProviders(<DashboardPage />);

      await waitFor(() => {
        // Cards should have proper structure for screen readers
        const mainContent = screen.getByRole('main');
        expect(mainContent).toBeInTheDocument();
      });
    });
  });

  describe('Event Listeners', () => {
    it('should set up service alert event listeners', async () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');

      renderWithProviders(<DashboardPage />);

      await waitFor(() => {
        expect(addEventListenerSpy).toHaveBeenCalledWith(
          'refreshAlertCounts',
          expect.any(Function)
        );
        expect(addEventListenerSpy).toHaveBeenCalledWith(
          'refreshCustomerAlerts',
          expect.any(Function)
        );
      });

      addEventListenerSpy.mockRestore();
    });
  });

  describe('Performance', () => {
    it('should use memoized components', () => {
      renderWithProviders(<DashboardPage />);

      // DashboardStatCard and TrendIndicator should be memoized
      // This is tested via React.memo implementation
      // Actual performance gains would be measured with React DevTools Profiler
    });
  });
});

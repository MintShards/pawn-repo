import React, { useMemo, useCallback } from 'react';
import { Button } from './button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Unified Pagination Component
 *
 * Reusable pagination component with configurable theming for consistent UX across
 * transactions, customers, users, and activity logs.
 *
 * Features:
 * - Smart ellipsis algorithm for large page counts (e.g., 1 2 ... 1013)
 * - Configurable page size selector with flexible options
 * - Theme-aware styling matching module branding (blue, orange, cyan, purple, green)
 * - Responsive layout with mobile support
 * - Accessibility-compliant with ARIA labels
 *
 * @param {Object} props
 * @param {number} props.currentPage - Current active page (1-indexed)
 * @param {number} props.totalPages - Total number of pages
 * @param {number} props.pageSize - Current page size (items per page)
 * @param {number} props.totalItems - Total number of items
 * @param {Function} props.onPageChange - Callback when page changes: (pageNum: number) => void
 * @param {Function} props.onPageSizeChange - Callback when page size changes: (size: number) => void
 * @param {Array<number>} [props.pageSizeOptions=[10, 25, 50, 100]] - Available page size options
 * @param {Object} [props.theme] - Theme configuration
 * @param {string} [props.theme.primary='blue'] - Primary color (blue|orange|cyan|purple|green)
 * @param {boolean} [props.showPageSizeSelector=true] - Show/hide page size selector
 * @param {number} [props.maxVisiblePages=7] - Maximum visible page buttons before ellipsis
 * @param {string} [props.itemLabel='items'] - Label for items (e.g., 'transactions', 'customers', 'logs')
 *
 * @example
 * // Basic usage with standard configuration
 * <UnifiedPagination
 *   currentPage={currentPage}
 *   totalPages={totalPages}
 *   pageSize={pageSize}
 *   totalItems={totalItems}
 *   onPageChange={setCurrentPage}
 *   onPageSizeChange={setPageSize}
 * />
 *
 * @example
 * // Using getPaginationConfig utility for standardized settings
 * import { getPaginationConfig } from '../../utils/paginationConfig';
 *
 * <UnifiedPagination
 *   currentPage={currentPage}
 *   totalPages={totalPages}
 *   pageSize={pageSize}
 *   totalItems={totalItems}
 *   onPageChange={setCurrentPage}
 *   onPageSizeChange={(value) => {
 *     setPageSize(value);
 *     setCurrentPage(1); // Reset to page 1 when size changes
 *   }}
 *   {...getPaginationConfig('customers')}
 * />
 *
 * @example
 * // Custom configuration without page size selector
 * <UnifiedPagination
 *   currentPage={page}
 *   totalPages={totalPages}
 *   pageSize={10}
 *   totalItems={totalItems}
 *   onPageChange={setPage}
 *   showPageSizeSelector={false}
 *   theme={{ primary: 'green' }}
 *   itemLabel="records"
 * />
 *
 * @example
 * // Activity log with custom page size options
 * <UnifiedPagination
 *   currentPage={page}
 *   totalPages={totalPages}
 *   pageSize={perPage}
 *   totalItems={totalActivities}
 *   onPageChange={setPage}
 *   onPageSizeChange={handlePageSizeChange}
 *   pageSizeOptions={[5, 10, 20, 50, 100]}
 *   theme={{ primary: 'blue' }}
 *   itemLabel="logs"
 * />
 */
const UnifiedPagination = React.memo(({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  theme = { primary: 'blue' },
  showPageSizeSelector = true,
  maxVisiblePages = 7,
  itemLabel = 'items'
}) => {
  // Theme color mapping
  const themeColors = useMemo(() => {
    const colorMap = {
      blue: {
        bg: 'bg-blue-600',
        bgHover: 'hover:bg-blue-700',
        border: 'border-blue-600'
      },
      orange: {
        bg: 'bg-orange-600',
        bgHover: 'hover:bg-orange-700',
        border: 'border-orange-600'
      },
      cyan: {
        bg: 'bg-cyan-600',
        bgHover: 'hover:bg-cyan-700',
        border: 'border-cyan-600'
      },
      purple: {
        bg: 'bg-purple-600',
        bgHover: 'hover:bg-purple-700',
        border: 'border-purple-600'
      },
      green: {
        bg: 'bg-green-600',
        bgHover: 'hover:bg-green-700',
        border: 'border-green-600'
      }
    };
    return colorMap[theme.primary] || colorMap.blue;
  }, [theme.primary]);

  // Calculate smart page numbers with ellipsis
  const pageNumbers = useMemo(() => {
    if (totalPages <= 1) return [];

    const pages = [];

    if (totalPages <= maxVisiblePages) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Smart pagination: show first, last, current, and surrounding pages
      const leftSiblingIndex = Math.max(currentPage - 1, 1);
      const rightSiblingIndex = Math.min(currentPage + 1, totalPages);

      const showLeftDots = leftSiblingIndex > 2;
      const showRightDots = rightSiblingIndex < totalPages - 1;

      // Always show first page
      pages.push(1);

      // Show left dots if needed
      if (showLeftDots) {
        pages.push('...');
      }

      // Show current page and siblings (but not if they're already shown)
      for (let i = leftSiblingIndex; i <= rightSiblingIndex; i++) {
        if (i > 1 && i < totalPages) {
          pages.push(i);
        }
      }

      // Show right dots if needed
      if (showRightDots) {
        pages.push('...');
      }

      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  }, [currentPage, totalPages, maxVisiblePages]);

  // Calculate display text for "Showing X-Y of Z"
  const displayText = useMemo(() => {
    if (totalItems === 0) return `No ${itemLabel}`;
    const start = Math.min((currentPage - 1) * pageSize + 1, totalItems);
    const end = Math.min(currentPage * pageSize, totalItems);
    return `Showing ${start}-${end} of ${totalItems} ${itemLabel}`;
  }, [currentPage, pageSize, totalItems, itemLabel]);

  // Memoized page change handler
  const handlePageChange = useCallback((pageNum) => {
    return (e) => {
      e.preventDefault();
      if (pageNum !== currentPage) {
        onPageChange(pageNum);
      }
    };
  }, [currentPage, onPageChange]);

  // Memoized navigation handlers
  const handlePrevious = useCallback((e) => {
    e.preventDefault();
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

  const handleNext = useCallback((e) => {
    e.preventDefault();
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  }, [currentPage, totalPages, onPageChange]);

  // Don't render if no items
  if (totalItems === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
      {/* Left side: Display text */}
      <div className="text-sm text-slate-600 dark:text-slate-400">
        {displayText}
      </div>

      {/* Center: Page navigation */}
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevious}
          disabled={currentPage === 1}
          className="h-8 px-3"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>

        {/* Page number buttons */}
        <div className="flex items-center space-x-1">
          {pageNumbers.map((pageNum, index) => {
            if (pageNum === '...') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 text-slate-400 dark:text-slate-600"
                >
                  ...
                </span>
              );
            }

            return (
              <Button
                key={pageNum}
                variant="outline"
                size="sm"
                className={`w-8 h-8 p-0 ${
                  currentPage === pageNum
                    ? `${themeColors.bg} text-white ${themeColors.border} ${themeColors.bgHover}`
                    : 'hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                }`}
                onClick={handlePageChange(pageNum)}
                aria-label={`Go to page ${pageNum}`}
                aria-current={currentPage === pageNum ? 'page' : undefined}
              >
                {pageNum}
              </Button>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={currentPage >= totalPages}
          className="h-8 px-3"
          aria-label="Next page"
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Right side: Page size selector */}
      {showPageSizeSelector && onPageSizeChange && (
        <div className="flex items-center space-x-2">
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Show:
          </span>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((option) => (
                <SelectItem key={option} value={option.toString()}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
});

UnifiedPagination.displayName = 'UnifiedPagination';

export default UnifiedPagination;

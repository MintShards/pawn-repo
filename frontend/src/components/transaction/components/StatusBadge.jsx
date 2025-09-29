import { Badge } from '../../ui/badge';
import { cn } from '../../../lib/utils';

const StatusBadge = ({ status }) => {
  // Theme-aware status colors with proper contrast ratios
  const getStatusClasses = (status) => {
    switch (status?.toLowerCase()) {
      case 'redeemed':
        // Green - Success/Complete
        return 'bg-green-500 dark:bg-green-600 text-white hover:bg-green-600 dark:hover:bg-green-700';
      
      case 'active':
        // Blue - Stable/Ongoing
        return 'bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700';
      
      case 'extended':
        // Cyan - Informational/Extended
        return 'bg-cyan-500 dark:bg-cyan-600 text-white hover:bg-cyan-600 dark:hover:bg-cyan-700';
      
      case 'sold':
        // Purple - Completed Transaction
        return 'bg-purple-500 dark:bg-purple-600 text-white hover:bg-purple-600 dark:hover:bg-purple-700';
      
      case 'hold':
        // Amber - Pending/Warning (with dark text for contrast)
        return 'bg-amber-400 dark:bg-amber-500 text-amber-900 dark:text-amber-950 hover:bg-amber-500 dark:hover:bg-amber-600';
      
      case 'forfeited':
        // Deep Orange - Negative Outcome
        return 'bg-orange-600 dark:bg-orange-700 text-white hover:bg-orange-700 dark:hover:bg-orange-800';
      
      case 'overdue':
        // Red - Urgent/Critical
        return 'bg-red-500 dark:bg-red-600 text-white hover:bg-red-600 dark:hover:bg-red-700';
      
      case 'damaged':
        // Brown - Degraded Condition
        return 'bg-amber-800 dark:bg-amber-900 text-white hover:bg-amber-900 dark:hover:bg-amber-950';
      
      case 'voided':
        // Gray - Neutral/Disabled
        return 'bg-gray-500 dark:bg-gray-600 text-white hover:bg-gray-600 dark:hover:bg-gray-700';
      
      default:
        // Default - Unknown status
        return 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600';
    }
  };

  const getStatusText = (status) => {
    return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
  };

  const statusClasses = getStatusClasses(status);
  
  return (
    <Badge 
      className={cn(
        "px-1.5 py-0.5 text-xs font-medium rounded whitespace-nowrap sm:px-2 sm:py-1 border-0",
        "transition-colors duration-200", // Smooth theme transitions
        "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background", // Accessibility
        statusClasses
      )}
      aria-label={`Status: ${getStatusText(status)}`}
    >
      {getStatusText(status)}
    </Badge>
  );
};

export default StatusBadge;
import { Badge } from '../../ui/badge';

const StatusBadge = ({ status }) => {
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'redeemed':
        return 'text-white';                      // #4CAF50 - Green (success/complete)
      case 'active':
        return 'text-white';                      // #2196F3 - Blue (stable/ongoing)
      case 'extended':
        return 'text-white';                      // #00BCD4 - Teal (informational/extended)
      case 'sold':
        return 'text-white';                      // #9C27B0 - Purple (completed transaction)
      case 'hold':
        return 'text-black';                      // #FFC107 - Amber (pending/warning)
      case 'forfeited':
        return 'text-white';                      // #FF5722 - Deep orange (negative outcome)
      case 'overdue':
        return 'text-white';                      // #F44336 - Red (urgent/critical)
      case 'damaged':
        return 'text-white';                      // #795548 - Brown (degraded condition)
      case 'voided':
        return 'text-white';                      // #9E9E9E - Grey (neutral/disabled)
      
      default:
        return 'bg-gray-200 text-gray-800';       // Default unknown
    }
  };

  const getStatusBackground = (status) => {
    switch (status?.toLowerCase()) {
      case 'redeemed':
        return '#4CAF50';                         // Green (success/complete)
      case 'active':
        return '#2196F3';                         // Blue (stable/ongoing)
      case 'extended':
        return '#00BCD4';                         // Teal (informational/extended)
      case 'sold':
        return '#9C27B0';                         // Purple (completed transaction)
      case 'hold':
        return '#FFC107';                         // Amber (pending/warning)
      case 'forfeited':
        return '#FF5722';                         // Deep orange (negative outcome)
      case 'overdue':
        return '#F44336';                         // Red (urgent/critical)
      case 'damaged':
        return '#795548';                         // Brown (degraded condition)
      case 'voided':
        return '#9E9E9E';                         // Grey (neutral/disabled)
      
      default:
        return '#E5E7EB';                         // Default grey
    }
  };

  const getStatusText = (status) => {
    return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
  };

  const backgroundColor = getStatusBackground(status);
  const textColor = getStatusColor(status);
  
  return (
    <Badge 
      className={`px-1.5 py-0.5 text-xs font-medium rounded whitespace-nowrap ${textColor} sm:px-2 sm:py-1 border-0`}
      style={{ backgroundColor }}
    >
      {getStatusText(status)}
    </Badge>
  );
};

export default StatusBadge;
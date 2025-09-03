import { Badge } from '../../ui/badge';

const StatusBadge = ({ status }) => {
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-green-500 text-white';
      case 'overdue':
        return 'bg-red-500 text-white';
      case 'extended':
        return 'bg-blue-500 text-white';
      case 'redeemed':
        return 'bg-purple-500 text-white';
      case 'forfeited':
        return 'bg-orange-500 text-white';
      case 'sold':
        return 'bg-gray-500 text-white';
      case 'hold':
        return 'bg-yellow-500 text-black';
      case 'voided':
        return 'bg-gray-700 text-white';
      case 'canceled':
        return 'bg-gray-400 text-white';
      default:
        return 'bg-gray-200 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
  };

  return (
    <Badge className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(status)}`}>
      {getStatusText(status)}
    </Badge>
  );
};

export default StatusBadge;
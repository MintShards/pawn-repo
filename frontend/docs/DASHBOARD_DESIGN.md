# Dashboard Design Specification
## Pawn Shop Management System

**Version**: 1.0
**Date**: January 2025
**Status**: Design Specification

---

## 1. Executive Summary

This document outlines the design for a simple but useful dashboard for the pawn shop management system. The dashboard provides at-a-glance operational insights for both Admin and Staff users, focusing on real-time metrics, quick actions, and system health monitoring.

### Design Principles
- **Simplicity First**: Clean, uncluttered interface with essential information only
- **Real-Time Updates**: Live metrics via WebSocket with fallback to polling
- **Role-Aware**: Contextual content based on user role (Admin vs Staff)
- **Action-Oriented**: Quick access to common daily tasks
- **Mobile-Friendly**: Responsive design for tablet and mobile use

---

## 2. Dashboard Layout

### 2.1 Grid Structure

```
┌─────────────────────────────────────────────────────────┐
│  Header (AppHeader with Dashboard title)                │
├─────────────────────────────────────────────────────────┤
│  Welcome Section                                         │
│  - Greeting with user name                              │
│  - Context message                                       │
│  - Primary CTA (New Transaction)                        │
├─────────────────────────────────────────────────────────┤
│  Stats Grid (5 cards in row)                           │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│  │Card 1│ │Card 2│ │Card 3│ │Card 4│ │Card 5│         │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘         │
├─────────────────────────────────────────────────────────┤
│  Main Content (2-column layout)                         │
│  ┌──────────────────┐  ┌───────────────────────────┐  │
│  │ Quick Actions    │  │ Recent Activity           │  │
│  │ (Left Column)    │  │ (Right Column - wider)    │  │
│  │                  │  │                           │  │
│  │ - Quick Links    │  │ - Latest Transactions     │  │
│  │ - System Status  │  │ - Pending Actions         │  │
│  └──────────────────┘  └───────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Responsive Breakpoints
- **Desktop (lg)**: 5 stat cards, 2-column layout
- **Tablet (md)**: 3-2 stat cards, 2-column layout
- **Mobile (sm)**: 2 cards per row, single column layout

---

## 3. Component Specifications

### 3.1 Stats Cards (Real-Time Metrics)

Five key metrics displayed as gradient cards with icons:

#### Card 1: Active Loans
- **Metric**: `active_loans`
- **Display**: Count of active transactions
- **Color**: Blue gradient (from-blue-50 to-indigo-50)
- **Icon**: CreditCard
- **Sub-text**: "X new this week" (trend indicator)
- **Data Source**: `/api/v1/stats/metrics` or WebSocket `/ws/stats`

#### Card 2: New This Month
- **Metric**: `new_this_month`
- **Display**: Count of transactions created this month
- **Color**: Emerald gradient (from-emerald-50 to-teal-50)
- **Icon**: TrendingUp
- **Sub-text**: "vs X last month" (comparison)
- **Data Source**: `/api/v1/stats/metrics`

#### Card 3: Service Alerts
- **Metric**: Custom (from serviceAlertService)
- **Display**: Unique customer count with active alerts
- **Color**: Red gradient (from-red-50 to-rose-50)
- **Icon**: Bell
- **Sub-text**: "X customer(s) with alerts"
- **Click Action**: Navigate to service alerts page
- **Data Source**: `/api/v1/service-alert/unique-customer-stats`

#### Card 4: Due This Week
- **Metric**: `maturity_this_week`
- **Display**: Loans maturing within 7 days
- **Color**: Amber gradient (from-amber-50 to-orange-50)
- **Icon**: Calendar
- **Sub-text**: "No overdue items" or "X overdue"
- **Data Source**: `/api/v1/stats/metrics`

#### Card 5: Today's Collection
- **Metric**: `todays_collection`
- **Display**: Total cash collected today
- **Color**: Violet gradient (from-violet-50 to-purple-50)
- **Icon**: DollarSign
- **Sub-text**: "+X% from yesterday" (percentage change)
- **Format**: Currency ($X,XXX.XX)
- **Data Source**: `/api/v1/stats/metrics`

#### Card Design Specifications
```jsx
<Card className="border-0 shadow-lg bg-gradient-to-br from-{color}-50 to-{color2}-50
               dark:from-{color}-950/50 dark:to-{color2}-950/50 relative overflow-hidden">
  <div className="absolute top-0 right-0 w-20 h-20 bg-{color}-500/10 rounded-full -mr-10 -mt-10" />
  <CardContent className="p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-{color}-600 dark:text-{color}-400">
          {metric_name}
        </p>
        <p className="text-2xl font-bold text-{color}-900 dark:text-{color}-100">
          {value}
        </p>
        <p className="text-xs text-{color}-600/70 dark:text-{color}-400/70 flex items-center mt-1">
          <Icon className="w-3 h-3 mr-1" />
          {sub_text}
        </p>
      </div>
      <div className="w-12 h-12 bg-{color}-500/20 rounded-xl flex items-center justify-center">
        <Icon className="w-6 h-6 text-{color}-600 dark:text-{color}-400" />
      </div>
    </div>
  </CardContent>
</Card>
```

---

### 3.2 Quick Actions Panel (Left Column)

Card with 4-6 common action buttons:

```jsx
<Card>
  <CardHeader>
    <CardTitle>Quick Actions</CardTitle>
    <CardDescription>Common daily tasks</CardDescription>
  </CardHeader>
  <CardContent className="space-y-3">
    {/* Action buttons */}
  </CardContent>
</Card>
```

#### Action Buttons (Priority Order)
1. **New Pawn Transaction** (Primary)
   - Route: `/transactions`
   - Icon: Plus
   - Color: Emerald/Teal gradient

2. **Manage Customers**
   - Route: `/customers`
   - Icon: Users
   - Color: Blue/Indigo gradient

3. **Process Payment**
   - Route: `/payments` (or payment modal)
   - Icon: CreditCard
   - Color: Amber/Orange gradient

4. **View Service Alerts**
   - Route: `/service-alerts`
   - Icon: Bell
   - Color: Red/Rose gradient
   - Badge: Show count if > 0

5. **Generate Report** (Admin Only)
   - Route: `/reports`
   - Icon: FileText
   - Color: Slate gradient

6. **Business Settings** (Admin Only)
   - Route: `/settings`
   - Icon: Settings
   - Color: Violet/Purple gradient

---

### 3.3 System Status Panel (Left Column, Below Quick Actions)

Real-time system health indicators:

```jsx
<Card>
  <CardHeader>
    <CardTitle>System Status</CardTitle>
    <CardDescription>All systems operational</CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Status indicators */}
  </CardContent>
</Card>
```

#### Status Indicators
1. **Database**
   - Icon: Database
   - Status: Connected (green) / Disconnected (red)
   - Source: Backend health check

2. **API Service**
   - Icon: Zap
   - Status: Online (green) / Offline (red)
   - Source: API ping or stats endpoint

3. **Authentication**
   - Icon: Shield
   - Status: Secure (green) / Issues (yellow)
   - Source: Auth service status

4. **Cache (Optional)**
   - Icon: Server
   - Status: Active (green) / Degraded (yellow)
   - Source: Redis connection status

---

### 3.4 Recent Activity Panel (Right Column)

List of latest transactions and updates:

```jsx
<Card className="h-full">
  <CardHeader>
    <div className="flex items-center justify-between">
      <div>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest transactions and updates</CardDescription>
      </div>
      <Button variant="ghost" size="sm" onClick={handleRefresh}>
        <RefreshCw className="w-4 h-4 mr-2" />
        Refresh
      </Button>
    </div>
  </CardHeader>
  <CardContent>
    {/* Activity list or empty state */}
  </CardContent>
</Card>
```

#### Activity Items (Show last 10)
- **New Transaction**: Customer name, amount, timestamp
- **Payment Received**: Customer, amount, balance remaining
- **Extension Processed**: Customer, new maturity date
- **Item Redeemed**: Customer, transaction ID
- **Service Alert Created**: Customer, alert type

#### Empty State
Display when no recent activity:
- Icon: FileText (large, muted)
- Message: "No Recent Activity"
- Subtext: "When you create transactions, they'll appear here"
- CTA: "Create First Transaction" button

---

## 4. Data Integration

### 4.1 Real-Time Stats via WebSocket

```javascript
// WebSocket connection for live stats
const ws = new WebSocket('ws://localhost:8000/ws/stats');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Update stats cards:
  // - active_loans
  // - new_this_month
  // - overdue_loans
  // - maturity_this_week
  // - todays_collection
};
```

### 4.2 REST API Fallback

If WebSocket fails or not supported:
```javascript
// Poll every 30-60 seconds
const fetchStats = async () => {
  const response = await fetch('/api/v1/stats/metrics', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  return data.metrics;
};
```

### 4.3 Service Alert Stats

```javascript
// Fetch unique customer alert stats
const fetchAlertStats = async () => {
  const response = await serviceAlertService.getUniqueCustomerAlertStats();
  return {
    unique_customer_count: response.unique_customer_count,
    total_alert_count: response.total_alert_count
  };
};

// Refresh on events
window.addEventListener('refreshAlertCounts', fetchAlertStats);
window.addEventListener('refreshCustomerAlerts', fetchAlertStats);
```

### 4.4 Recent Activity Feed

```javascript
// Fetch recent transactions (latest 10)
const fetchRecentActivity = async () => {
  const response = await fetch('/api/v1/pawn-transaction/?limit=10&sort=-created_at', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};
```

---

## 5. State Management

### 5.1 Dashboard State Structure

```javascript
const [dashboardState, setDashboardState] = useState({
  // Stats metrics
  metrics: {
    active_loans: 0,
    new_this_month: 0,
    overdue_loans: 0,
    maturity_this_week: 0,
    todays_collection: 0.00
  },

  // Service alerts
  alertStats: {
    unique_customer_count: 0,
    total_alert_count: 0
  },

  // Recent activity
  recentActivity: [],

  // System status
  systemStatus: {
    database: 'connected',
    api: 'online',
    auth: 'secure'
  },

  // Loading states
  loading: {
    metrics: true,
    alerts: true,
    activity: true
  }
});
```

### 5.2 Update Strategies

- **WebSocket Updates**: Real-time for stats metrics
- **Polling Updates**: Every 60 seconds for alert stats (rate limit safety)
- **Manual Refresh**: User-triggered for recent activity
- **Event-Driven**: Listen for custom events (alert updates, transactions)

---

## 6. Role-Based Features

### 6.1 Admin-Only Elements

1. **Business Settings Card** (Quick Actions)
   - Access to loan limit configuration
   - Forfeiture config
   - System settings

2. **Advanced System Status**
   - Cache performance metrics
   - User activity statistics
   - Database performance

3. **Generate Report Button**
   - Financial reports
   - Audit logs
   - User activity reports

### 6.2 Staff View

- All stat cards (read-only)
- Quick Actions: New Transaction, Manage Customers, Process Payment
- Recent Activity view
- Basic System Status

---

## 7. Performance Considerations

### 7.1 Optimization Strategies

1. **WebSocket Connection Pooling**
   - Single connection for all stats
   - Automatic reconnection on disconnect
   - Graceful degradation to polling

2. **Caching**
   - Cache alert stats for 30-60 seconds
   - Cache recent activity for 30 seconds
   - Redis-backed stats caching on backend

3. **Lazy Loading**
   - Load recent activity only when panel is visible
   - Defer non-critical system status checks

4. **Debouncing**
   - Debounce manual refresh actions (1 second)
   - Rate limit WebSocket message processing

### 7.2 Loading States

- Skeleton loaders for stat cards during initial load
- Shimmer effect for Recent Activity panel
- Spinner for manual refresh operations
- Toast notifications for errors

---

## 8. Error Handling

### 8.1 API Failures

```javascript
try {
  const stats = await fetchStats();
  setMetrics(stats);
} catch (error) {
  // Show error toast
  toast.error('Failed to load dashboard stats');
  // Set default values
  setMetrics(DEFAULT_METRICS);
}
```

### 8.2 WebSocket Disconnection

```javascript
ws.onerror = () => {
  console.warn('WebSocket disconnected, falling back to polling');
  startPolling(); // Fallback to REST API polling
};
```

### 8.3 Partial Data Failures

- Display available metrics even if some fail
- Show warning indicator on failed cards
- Provide manual retry option

---

## 9. Accessibility

### 9.1 WCAG 2.1 AA Compliance

- **Color Contrast**: All text meets 4.5:1 minimum ratio
- **Keyboard Navigation**: All actions accessible via keyboard
- **Screen Readers**: Proper ARIA labels for all cards
- **Focus Indicators**: Clear focus states for interactive elements

### 9.2 ARIA Labels

```jsx
<Card aria-label="Active Loans Metric" role="region">
  <p aria-live="polite">{value}</p>
</Card>

<Button aria-label="Refresh recent activity" onClick={handleRefresh}>
  <RefreshCw className="w-4 h-4" aria-hidden="true" />
</Button>
```

---

## 10. Implementation Roadmap

### Phase 1: Core Dashboard (Priority 1)
- [x] Basic layout structure
- [ ] Stats cards with static data
- [ ] Quick Actions panel
- [ ] Recent Activity panel (empty state)

### Phase 2: Real-Time Integration (Priority 2)
- [ ] WebSocket integration for stats
- [ ] REST API fallback polling
- [ ] Service alert stats integration
- [ ] Recent activity data fetch

### Phase 3: Role-Based Features (Priority 3)
- [ ] Admin-only actions
- [ ] Business settings integration
- [ ] Advanced system status

### Phase 4: Polish & Performance (Priority 4)
- [ ] Loading states and skeletons
- [ ] Error handling and retry logic
- [ ] Performance optimization
- [ ] Accessibility audit

---

## 11. File Structure

```
frontend/src/
├── pages/
│   └── DashboardPage.jsx              # Main dashboard page
├── components/
│   ├── dashboard/
│   │   ├── StatsCard.jsx              # Reusable stat card component
│   │   ├── QuickActions.jsx           # Quick actions panel
│   │   ├── SystemStatus.jsx           # System status indicators
│   │   ├── RecentActivity.jsx         # Recent activity feed
│   │   └── useStatsWebSocket.js       # WebSocket hook
│   └── common/
│       └── AppHeader.jsx              # Existing header
├── services/
│   ├── statsCacheService.js           # Existing stats service
│   └── serviceAlertService.js         # Existing alert service
└── hooks/
    ├── useDashboardStats.js           # Dashboard data hook
    └── useRecentActivity.js           # Recent activity hook
```

---

## 12. API Endpoints Reference

### Stats Metrics
- `GET /api/v1/stats/metrics` - All metrics
- `GET /api/v1/stats/metrics/{metric_type}` - Specific metric
- `WS /ws/stats` - Real-time WebSocket updates

### Service Alerts
- `GET /api/v1/service-alert/unique-customer-stats` - Alert statistics

### Recent Activity
- `GET /api/v1/pawn-transaction/?limit=10&sort=-created_at` - Latest transactions

### System Health
- `GET /api/v1/stats/health` - System health check

---

## 13. Testing Strategy

### Unit Tests
- Stats card rendering with different values
- Quick action button navigation
- WebSocket connection handling
- Error state handling

### Integration Tests
- API data fetching and display
- WebSocket real-time updates
- Role-based rendering (Admin vs Staff)
- Refresh functionality

### E2E Tests
- Complete dashboard load
- Navigation from quick actions
- Real-time stat updates
- Mobile responsive layout

---

## Appendix A: Color Palette

### Stat Card Colors
```scss
// Active Loans - Blue
$blue-gradient: linear-gradient(to-br, #dbeafe, #e0e7ff);
$blue-text: #2563eb;
$blue-icon-bg: rgba(59, 130, 246, 0.2);

// New This Month - Emerald
$emerald-gradient: linear-gradient(to-br, #d1fae5, #ccfbf1);
$emerald-text: #059669;
$emerald-icon-bg: rgba(16, 185, 129, 0.2);

// Service Alerts - Red
$red-gradient: linear-gradient(to-br, #fee2e2, #ffe4e6);
$red-text: #dc2626;
$red-icon-bg: rgba(239, 68, 68, 0.2);

// Due This Week - Amber
$amber-gradient: linear-gradient(to-br, #fef3c7, #fed7aa);
$amber-text: #d97706;
$amber-icon-bg: rgba(245, 158, 11, 0.2);

// Today's Collection - Violet
$violet-gradient: linear-gradient(to-br, #ede9fe, #f3e8ff);
$violet-text: #7c3aed;
$violet-icon-bg: rgba(139, 92, 246, 0.2);
```

---

## Appendix B: Component API Reference

### StatsCard Component

```jsx
<StatsCard
  title="Active Loans"
  value={156}
  subText="5 new this week"
  icon={CreditCard}
  color="blue"
  trend={{
    direction: "up",
    percentage: 3.2
  }}
  onClick={() => navigate('/transactions')}
  loading={false}
/>
```

### QuickActions Component

```jsx
<QuickActions
  actions={[
    { label: 'New Transaction', icon: Plus, route: '/transactions', color: 'emerald' },
    { label: 'Manage Customers', icon: Users, route: '/customers', color: 'blue' }
  ]}
  userRole={user.role}
/>
```

---

**End of Design Specification**

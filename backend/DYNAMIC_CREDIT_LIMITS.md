# Dynamic Credit Limit System - Real-Time Sync Implementation

## Overview

The system now uses **real-time synchronization** for credit limits. Customers without custom limits dynamically use the Financial Policy system default, which means changing the Financial Policy configuration immediately affects all non-custom customers.

## How It Works

### Credit Limit Storage

**Before (Hardcoded)**:
```python
# Customer model
credit_limit: Decimal = Field(default=Decimal("3000.00"))

# All customers stored explicit value
customer.credit_limit = 3000.00  # Stored in database
```

**After (Dynamic)**:
```python
# Customer model
credit_limit: Optional[Decimal] = Field(default=None)

# Customers using system default
customer.credit_limit = None  # No stored value, fetch dynamically

# Customers with custom limits
customer.credit_limit = 5000.00  # Explicit custom value stored
```

### Credit Limit Resolution

The system uses `Customer.get_effective_credit_limit()` method:

```python
async def get_effective_credit_limit(self) -> Decimal:
    """Get effective credit limit for this customer."""
    # If customer has custom limit, use it
    if self.credit_limit is not None:
        return self.credit_limit

    # Otherwise, fetch system default from Financial Policy
    financial_config = await FinancialPolicyConfig.get_current_config()
    if financial_config and financial_config.customer_credit_limit:
        return Decimal(str(financial_config.customer_credit_limit))

    # Fallback to $3,000 if config unavailable
    return Decimal("3000.00")
```

## Real-Time Behavior

### Scenario 1: System Default Changes

**Setup**:
- Financial Policy default: $3,000
- Customer A: `credit_limit = None` (using system default)
- Customer B: `credit_limit = 5000` (custom limit)

**Action**: Admin changes Financial Policy to $4,000

**Result**:
- ✅ Customer A **immediately** uses $4,000 (dynamic fetch)
- ❌ Customer B still uses $5,000 (custom limit unchanged)

### Scenario 2: New Customer Creation

**Before**:
```python
# New customer gets hardcoded $3,000
customer.credit_limit = 3000.00
```

**After**:
```python
# New customer uses system default dynamically
customer.credit_limit = None  # Will fetch Financial Policy default
```

### Scenario 3: Setting Custom Limit

**Action**: Admin sets Customer A to custom $10,000

**Result**:
```python
customer.credit_limit = 10000.00  # Stored explicitly
# This customer no longer affected by Financial Policy changes
```

### Scenario 4: Resetting to System Default

**Action**: Admin resets Customer A to system default

**Result**:
```python
customer.credit_limit = None  # Remove custom limit
# Customer A now dynamically uses Financial Policy default again
```

## Benefits

✅ **True Centralized Management**: Change Financial Policy → affects all customers instantly
✅ **No Data Migration**: Existing customers automatically benefit from new defaults
✅ **Flexible Per-Customer Overrides**: Custom limits still work for special cases
✅ **Audit Trail Preserved**: Financial Policy changes tracked with timestamps
✅ **Backward Compatible**: System gracefully handles old data

## Database Changes

### Customer Model

**Field Changes**:
```python
# OLD
credit_limit: Decimal = Field(default=Decimal("3000.00"))

# NEW
credit_limit: Optional[Decimal] = Field(
    default=None,
    description="Custom credit limit (None = use system default from Financial Policy)"
)
```

**New Method**:
```python
async def get_effective_credit_limit(self) -> Decimal:
    """Dynamically fetch effective credit limit."""
```

### Migration Impact

**Existing Customers**:
- Customers with `credit_limit = 3000.00` → **Can be migrated** to `None` (use system default)
- Customers with other values → **Keep as custom limits** (preserve intentional overrides)

**Migration Script**:
```bash
# Preview changes (recommended first)
python migrate_credit_limits_to_dynamic.py --dry-run

# Apply migration
python migrate_credit_limits_to_dynamic.py

# Verify results
python migrate_credit_limits_to_dynamic.py --verify-only
```

## Code Integration Points

### 1. Customer Service (`customer_service.py`)

**Create Customer**:
```python
# New customers get credit_limit = None by default
customer_dict["credit_limit"] = None  # Will dynamically use Financial Policy
```

**Logging**:
```python
credit_limit_source = "custom" if customer.credit_limit is not None else "system_default"
```

### 2. Transaction Service (`pawn_transaction_service.py`)

**Credit Limit Enforcement**:
```python
# Get effective credit limit (custom or system default)
effective_credit_limit = await customer.get_effective_credit_limit()

# Validate transaction
if potential_total > effective_credit_limit:
    limit_source = "custom" if customer.credit_limit is not None else "system default"
    raise PawnTransactionError(
        f"Customer limit ({limit_source}): ${effective_credit_limit:,.2f}"
    )
```

### 3. Frontend (`CustomCreditLimitDialog.jsx`)

**Detect Limit Source**:
```jsx
// Check if customer has explicit custom limit
const isUsingCustomLimit = customer.credit_limit !== null && customer.credit_limit !== undefined;

// Fetch system default dynamically
const [systemDefault, setSystemDefault] = useState(3000);
const financialConfig = await businessConfigService.getFinancialPolicyConfig();
setSystemDefault(parseFloat(financialConfig.customer_credit_limit));
```

**Display**:
```jsx
{isUsingCustomLimit ? (
  <p>Custom limit: ${currentEffectiveLimit.toLocaleString()}</p>
) : (
  <p>System default: ${systemDefault.toLocaleString()}</p>
)}
```

## Configuration Steps

### 1. Set Financial Policy Default

1. Navigate to **Admin > Business Settings > Financial Policies**
2. Set **Customer Credit Limit** to desired default (e.g., $4,000)
   - **Minimum**: $3,000 (cannot go below this amount)
   - **Maximum**: $50,000
3. Save changes with reason

### 2. Run Migration (Optional)

Convert existing $3,000 customers to use dynamic default:

```bash
cd backend
source env/bin/activate  # or env\Scripts\activate on Windows

# Preview changes
python migrate_credit_limits_to_dynamic.py --dry-run

# Apply migration
python migrate_credit_limits_to_dynamic.py

# Expected output:
# ✅ 45 customers now use dynamic system default ($4,000)
```

### 3. Verify Results

```bash
python migrate_credit_limits_to_dynamic.py --verify-only

# Output:
# Total Customers: 150
# Using System Default (credit_limit = None): 45
# Using Custom Limits: 105
```

### 4. Test Behavior

**Test 1: Create New Customer**
- Create customer via UI
- Check database: `credit_limit` should be `null`
- Customer automatically uses Financial Policy default

**Test 2: Change Financial Policy**
- Update Financial Policy default to $5,000
- Check existing customers with `credit_limit = None`
- They should now see $5,000 as their limit

**Test 3: Set Custom Limit**
- Select customer with `credit_limit = None`
- Set custom limit to $8,000
- Customer now uses $8,000 (not affected by Financial Policy changes)

**Test 4: Reset to System Default**
- Select customer with custom limit
- Reset to system default (leave field empty, save)
- Customer's `credit_limit` set to `null`
- Customer now dynamically uses Financial Policy default again

## API Changes

### Customer Response Schema

**Before**:
```json
{
  "credit_limit": "3000.00"  // Always has value
}
```

**After**:
```json
{
  "credit_limit": null  // null = using system default
}
// OR
{
  "credit_limit": "5000.00"  // Custom limit
}
```

### Customer Update Request

**Reset to System Default**:
```json
{
  "credit_limit": null  // Remove custom limit, use system default
}
```

**Set Custom Limit**:
```json
{
  "credit_limit": "10000.00"  // Set custom limit
}
```

## Monitoring

### Log Queries

**Check New Customer Creation**:
```bash
grep "Customer created" app.log | grep "credit_limit_source"

# Output:
# Customer created | credit_limit_source=system_default | phone=1234567890
```

**Check Credit Limit Validation**:
```bash
grep "Credit limit validation" app.log

# Output:
# Credit limit validation passed | credit_limit=4000.0 | credit_limit_source=system_default
```

### Database Queries

**Count Customers Using System Default**:
```javascript
db.customers.countDocuments({ credit_limit: null })
```

**Count Customers with Custom Limits**:
```javascript
db.customers.countDocuments({ credit_limit: { $ne: null } })
```

**Find All System Default Customers**:
```javascript
db.customers.find(
  { credit_limit: null },
  { first_name: 1, last_name: 1, phone_number: 1 }
)
```

## Troubleshooting

### Issue: Customer Shows Wrong Limit

**Symptoms**: Customer with `credit_limit = null` shows $3,000 instead of configured $4,000

**Diagnosis**:
1. Check Financial Policy configuration:
   ```javascript
   db.financial_policy_config.findOne({ is_active: true })
   ```
2. Check customer credit_limit field:
   ```javascript
   db.customers.findOne({ phone_number: "1234567890" })
   ```
3. Check application logs for fetch errors

**Resolution**:
- Ensure Financial Policy config has `customer_credit_limit` set
- Verify `is_active: true` on the config
- Check for database connection errors in logs

### Issue: Migration Failed Partially

**Symptoms**: Some customers migrated, some didn't

**Diagnosis**:
```bash
python migrate_credit_limits_to_dynamic.py --verify-only
```

**Resolution**:
1. Review error messages from migration script
2. Fix any database connection issues
3. Re-run migration (script is idempotent)
4. Manually update remaining customers if needed

### Issue: UI Shows Stale Credit Limit

**Symptoms**: UI shows old limit after Financial Policy change

**Diagnosis**:
- Check if customer has custom limit (not null)
- Check browser cache/local storage
- Verify API response

**Resolution**:
1. Refresh page to fetch latest data
2. Clear browser cache if persistent
3. Verify customer has `credit_limit = null` in database

## Rollback Plan

If you need to revert to hardcoded behavior:

### 1. Database Rollback

Convert all `null` credit_limit values back to $3,000:

```javascript
db.customers.updateMany(
  { credit_limit: null },
  { $set: { credit_limit: 3000.00 } }
)
```

### 2. Code Rollback

```bash
git revert <commit-hash>
```

### 3. Verify Rollback

```bash
python migrate_credit_limits_to_dynamic.py --verify-only

# Should show:
# Using System Default (credit_limit = None): 0
# Using Custom Limits: 150
```

## Summary

✅ **Dynamic Default**: Changing Financial Policy immediately affects all non-custom customers
✅ **Per-Customer Override**: Custom limits still work for special cases
✅ **Real-Time Sync**: No batch updates or cron jobs needed
✅ **Backward Compatible**: Gracefully handles existing data
✅ **Easy Migration**: One-time script to convert existing customers
✅ **Complete Audit Trail**: All changes tracked with timestamps and reasons

**Result**: You now have **true centralized credit limit management** where changing the Financial Policy setting to $4,000 will immediately apply to all customers using the system default (those with `credit_limit = null`).

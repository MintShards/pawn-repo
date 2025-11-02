# Credit Limit Migration Guide

## Overview

The system has been updated to use centralized credit limit defaults from the Financial Policy configuration instead of hardcoded values in the Customer model.

## What Changed

### Before
- **Hardcoded Default**: All new customers received a hardcoded $3,000 credit limit in `customer_model.py`
- **No Enforcement**: Credit limits were informational only, not enforced during transaction creation
- **Limited Flexibility**: Changing the default required code changes and redeployment

### After
- **Centralized Configuration**: Default credit limit is managed via Financial Policy settings (Admin > Business Settings)
- **Enforcement Option**: Optional credit limit enforcement when creating transactions
- **Business Flexibility**: Admins can adjust default credit limit without code changes
- **Audit Trail**: All credit limit configuration changes are tracked with timestamps and user IDs

## Database Impact

### Existing Customers

**No migration required** - Existing customers are not affected:

1. **Customers with Custom Limits**:
   - Existing custom `credit_limit` values remain unchanged
   - Custom limits continue to override system defaults
   - These customers will see "Using Custom Credit Limit" in the UI

2. **Customers with Default Limit ($3,000)**:
   - Existing customers with `credit_limit = 3000` will keep their current value
   - They are NOT automatically updated to match new Financial Policy defaults
   - This preserves data integrity and prevents unexpected changes

### New Customers

**All new customers** created after this update will receive the credit limit from Financial Policy configuration:

1. **Default Behavior**:
   ```python
   # New customer creation flow
   financial_config = await FinancialPolicyConfig.get_current_config()
   default_credit_limit = financial_config.customer_credit_limit  # e.g., $5000
   customer.credit_limit = default_credit_limit
   ```

2. **Fallback Protection**:
   - If Financial Policy config is not available, fallback to $3,000
   - Logged as warning for visibility

## Configuration Steps

### 1. Set Default Credit Limit (Required)

1. Navigate to **Admin > Business Settings > Financial Policies**
2. Locate **Credit Limit Settings** section
3. Set **Customer Credit Limit** to your desired default (e.g., $5,000)
4. Set **Enforce Credit Limit** to `true` if you want to block transactions exceeding limits
5. Provide a **reason** for the configuration change
6. Click **Save Changes**

### 2. Verify Configuration

```bash
# Check current configuration via MongoDB
mongosh mongodb://localhost:27017/pawn-repo

use pawn-repo
db.financial_policy_config.findOne(
  { is_active: true },
  { customer_credit_limit: 1, enforce_credit_limit: 1, updated_at: 1 }
)
```

Expected output:
```json
{
  "_id": ObjectId("..."),
  "customer_credit_limit": 5000.0,
  "enforce_credit_limit": true,
  "updated_at": ISODate("2025-01-01T00:00:00.000Z")
}
```

### 3. Test New Customer Creation

1. Create a test customer via the UI or API
2. Verify they receive the configured default credit limit
3. Check logs for confirmation:
   ```
   INFO: Using Financial Policy default credit limit
   default_limit="5000.00" config_id="..."
   ```

## Optional: Update Existing Customers

If you want to update existing customers to match the new Financial Policy default:

### Option 1: Bulk Update via Script (Recommended)

```python
# update_customer_credit_limits.py
"""
Update existing customers with default credit limit ($3000)
to match new Financial Policy configuration.
"""
import asyncio
from decimal import Decimal
from app.core.database import init_db
from app.models.customer_model import Customer
from app.models.business_config_model import FinancialPolicyConfig

async def update_existing_customers():
    """Update customers with default $3000 to new Financial Policy default."""
    await init_db()

    # Get current Financial Policy default
    financial_config = await FinancialPolicyConfig.get_current_config()
    if not financial_config or not financial_config.customer_credit_limit:
        print("ERROR: No Financial Policy configuration found")
        return

    new_default = Decimal(str(financial_config.customer_credit_limit))
    old_default = Decimal("3000.00")

    print(f"Updating customers from ${old_default} to ${new_default}")

    # Find customers with old default credit limit
    customers = await Customer.find(
        Customer.credit_limit == old_default
    ).to_list()

    print(f"Found {len(customers)} customers with ${old_default} credit limit")

    # Update each customer
    updated_count = 0
    for customer in customers:
        customer.credit_limit = new_default
        await customer.save()
        updated_count += 1
        print(f"Updated {customer.first_name} {customer.last_name} - {customer.phone_number}")

    print(f"\nMigration complete: {updated_count} customers updated")

if __name__ == "__main__":
    asyncio.run(update_existing_customers())
```

**Usage**:
```bash
cd backend
source env/bin/activate  # or env\Scripts\activate on Windows
python update_customer_credit_limits.py
```

### Option 2: Manual Update via MongoDB

```javascript
// Update all customers with $3000 credit limit to new default ($5000)
use pawn-repo

// First, verify how many customers will be affected
db.customers.countDocuments({ credit_limit: 3000 })

// Update all customers with $3000 to $5000
db.customers.updateMany(
  { credit_limit: 3000 },
  { $set: { credit_limit: 5000 } }
)

// Verify update
db.customers.countDocuments({ credit_limit: 5000 })
```

### Option 3: Gradual Manual Update via UI

For a more controlled approach, update customers individually:

1. Navigate to **Customers** page
2. Select customer with default $3,000 credit limit
3. Click **Set Custom Limit**
4. Enter new default amount (e.g., $5,000)
5. Provide reason: "Updated to match new Financial Policy default"
6. Save changes

## Credit Limit Enforcement

### How It Works

When `enforce_credit_limit` is enabled in Financial Policy:

1. **Transaction Creation Check**:
   ```python
   potential_total = customer.total_loan_value + new_loan_amount
   if potential_total > customer.credit_limit:
       raise PawnTransactionError("Transaction would exceed customer credit limit")
   ```

2. **Error Message Example**:
   ```
   Transaction would exceed customer credit limit.
   Customer limit: $5,000.00
   Current usage: $4,200.00
   New loan: $1,500.00
   Total would be: $5,700.00
   ```

3. **Logging**:
   - All credit limit checks are logged with full context
   - Failed validations include customer phone, limits, and amounts
   - Successful validations logged at INFO level

### Disabling Enforcement

If credit limit enforcement causes issues:

1. Navigate to **Admin > Business Settings > Financial Policies**
2. Set **Enforce Credit Limit** to `false`
3. Provide reason: "Temporarily disabling enforcement"
4. Save changes

Credit limits will still be displayed but not enforced.

## Rollback Plan

If you need to revert to the old behavior:

### 1. Disable Credit Limit Enforcement

```python
# In Financial Policy config
enforce_credit_limit = False
```

### 2. Revert Code Changes (if needed)

```bash
git revert <commit-hash>
```

The system will fall back to using:
- Existing customer `credit_limit` values
- $3,000 fallback for new customers without Financial Policy config

## Testing Checklist

- [ ] Financial Policy configuration accessible in Admin settings
- [ ] New customers receive configured default credit limit
- [ ] Existing customers retain their current credit limits
- [ ] Custom credit limits override system defaults
- [ ] Credit limit enforcement blocks over-limit transactions (when enabled)
- [ ] Credit limit enforcement is optional (can be disabled)
- [ ] UI displays credit limit source (system default vs custom)
- [ ] Audit trail records all configuration changes
- [ ] Logs show credit limit assignment for new customers
- [ ] Fallback to $3,000 works when config unavailable

## Monitoring

### Key Metrics to Watch

1. **Customer Creation**:
   - Monitor logs for "Using Financial Policy default credit limit"
   - Watch for fallback warnings: "Failed to fetch Financial Policy config"

2. **Transaction Validation**:
   - Track credit limit validation failures
   - Monitor "Credit limit validation passed" log entries

3. **Configuration Changes**:
   - Audit trail in `financial_policy_config` collection
   - Review `reason` fields for change justification

### Log Queries

```bash
# Check recent customer creations with credit limit assignment
grep "Using Financial Policy default credit limit" /var/log/pawnshop/app.log

# Check credit limit enforcement events
grep "Credit limit validation" /var/log/pawnshop/app.log

# Check for fallback usage
grep "Failed to fetch Financial Policy config" /var/log/pawnshop/app.log
```

## Support

If you encounter issues during migration:

1. **Check Logs**: Review application logs for errors
2. **Verify Configuration**: Ensure Financial Policy config is active
3. **Test Fallback**: Verify $3,000 fallback works when config unavailable
4. **Database Integrity**: Run MongoDB queries to verify customer credit limits
5. **Contact Support**: Include relevant logs and error messages

## Summary

✅ **Benefits**:
- Centralized credit limit management
- Optional enforcement for risk management
- Flexible business rule configuration
- Complete audit trail

⚠️ **Important**:
- Existing customers are NOT automatically updated
- New customers use Financial Policy default
- Enforcement is optional and can be disabled
- Fallback to $3,000 ensures system stability

📝 **Next Steps**:
1. Configure Financial Policy credit limit settings
2. Test with new customer creation
3. Decide whether to update existing customers
4. Enable enforcement if desired
5. Monitor logs for proper operation

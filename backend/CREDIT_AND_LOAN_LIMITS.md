# Credit and Loan Limits - Complete Guide

**Last Updated**: 2025-11-02
**Status**: Production-Ready ✅

This is the comprehensive guide for credit and loan limit functionality in the pawnshop system. Both systems work identically with complete architectural parity.

---

## Quick Start

### For Administrators

**Setting System Defaults**:
1. Navigate to Admin → Business Settings → Financial Policy
2. Configure:
   - **Credit Limit**: Min $3,000 (default: $3,000)
   - **Loan Limit**: Min 8, Max 20 (default: 8)
3. Changes take effect immediately for all customers without custom limits

**Setting Custom Limits** (per customer):
1. Navigate to Customer Details
2. Set custom credit limit (overrides system default)
3. Set custom loan limit (overrides system default)
4. Leave empty to use system defaults

### For Developers

**Get Effective Limits**:
```python
# Credit limit
credit_limit = await customer.get_effective_credit_limit()  # Returns Decimal

# Loan limit
loan_limit = await customer.get_effective_loan_limit()  # Returns int
```

**Priority Logic**: Custom → Financial Policy → Fallback

---

## System Overview

### Credit Limits

**Purpose**: Control maximum total loan value per customer

**How It Works**:
- **System Default**: Set in Financial Policy (min $3,000)
- **Custom Per-Customer**: Override system default (optional)
- **Dynamic Updates**: Changes to system default affect all non-custom customers immediately
- **Enforcement**: Validated on every transaction creation

**Fields**:
- `FinancialPolicyConfig.customer_credit_limit` - System default
- `Customer.credit_limit` - Per-customer override (None = use system default)

**Example**:
```python
# Customer with no custom limit
customer.credit_limit = None
effective = await customer.get_effective_credit_limit()  # Returns $3000 (or Financial Policy default)

# Customer with custom limit
customer.credit_limit = Decimal("5000.00")
effective = await customer.get_effective_credit_limit()  # Returns $5000
```

---

### Loan Limits

**Purpose**: Control maximum active loans per customer

**How It Works**:
- **System Default**: Set in Financial Policy (min 8, max 20)
- **Custom Per-Customer**: Override system default (optional)
- **Dynamic Updates**: Changes to system default affect all non-custom customers immediately
- **Enforcement**: Validated before transaction creation

**Fields**:
- `FinancialPolicyConfig.max_active_loans_per_customer` - System default
- `Customer.custom_loan_limit` - Per-customer override (None = use system default)

**Example**:
```python
# Customer with no custom limit
customer.custom_loan_limit = None
effective = await customer.get_effective_loan_limit()  # Returns 8 (or Financial Policy default)

# Customer with custom limit
customer.custom_loan_limit = 15
effective = await customer.get_effective_loan_limit()  # Returns 15
```

---

## Complete Parity

Both systems follow identical architectural patterns:

| Feature | Credit Limit | Loan Limit |
|---------|--------------|------------|
| **Model Method** | `get_effective_credit_limit()` | `get_effective_loan_limit()` |
| **Return Type** | `Decimal` | `int` |
| **Custom Field** | `credit_limit` | `custom_loan_limit` |
| **Config Field** | `customer_credit_limit` | `max_active_loans_per_customer` |
| **Priority** | Custom → Config → Fallback | Custom → Config → Fallback |
| **Fallback** | $3,000 | 8 |
| **Dynamic Updates** | Yes | Yes |
| **Per-Customer Override** | Yes | Yes |
| **Frontend Validation** | Yes (min $3,000) | Yes (min 8, max 20) |
| **Backend Enforcement** | Yes | Yes |

---

## Configuration

### Financial Policy Settings

**Location**: Admin → Business Settings → Financial Policy

**Credit Limit**:
- Field: "Default Customer Credit Limit (optional)"
- Minimum: $3,000
- Validation: Real-time, enforced at 4 layers
- Default: $3,000 if not configured

**Loan Limit**:
- Field: "Default Customer Loan Limit (optional)"
- Minimum: 8
- Maximum: 20
- Validation: Real-time, enforced at 4 layers
- Default: 8 if not configured

**UI Features**:
- Side-by-side layout
- Real-time validation
- Red border + error message on invalid input
- Save button disabled when errors present
- Prefilled with current values

---

### Per-Customer Overrides

**Credit Limit Override**:
```python
# Set custom limit
customer.credit_limit = Decimal("10000.00")
await customer.save()

# Remove custom limit (use system default)
customer.credit_limit = None
await customer.save()
```

**Loan Limit Override**:
```python
# Set custom limit
customer.custom_loan_limit = 20
await customer.save()

# Remove custom limit (use system default)
customer.custom_loan_limit = None
await customer.save()
```

---

## How Dynamic Updates Work

### Scenario 1: Change System Default

**Action**: Admin changes Financial Policy Loan Limit from 8 to 10

**Results**:
- Customer A (`custom_loan_limit=None`) → Changes from 8 to 10 ✅
- Customer B (`custom_loan_limit=None`) → Changes from 8 to 10 ✅
- Customer C (`custom_loan_limit=15`) → Stays at 15 (custom override) ✅

**Same for Credit Limits**: Changing system credit limit from $3000 to $4000 affects all customers with `credit_limit=None`

---

### Scenario 2: Set Custom Limit for VIP

**Action**: Set Customer A's `custom_loan_limit=20`

**Results**:
- Customer A → Now uses 20 (ignores system default) ✅
- Future system default changes → Don't affect Customer A ✅
- Other customers → Still use system default ✅

**Same for Credit Limits**: Setting `credit_limit=$10000` for VIP customer

---

### Scenario 3: Remove Custom Limit

**Action**: Clear Customer A's custom limit (set to `None`)

**Results**:
- Customer A → Now uses current system default (e.g., 10) ✅
- Future system default changes → Now affect Customer A ✅

---

## API Reference

### Get Financial Policy Configuration

```http
GET /api/v1/business-config/financial-policy
```

**Response**:
```json
{
  "customer_credit_limit": 3000.0,
  "max_active_loans_per_customer": 8,
  "min_loan_amount": 10.0,
  "max_loan_amount": 10000.0,
  "default_monthly_interest_rate": 20.0,
  ...
}
```

---

### Update Financial Policy Configuration

```http
POST /api/v1/business-config/financial-policy
```

**Request**:
```json
{
  "customer_credit_limit": 4000.0,
  "max_active_loans_per_customer": 10,
  "reason": "Adjusting limits for business expansion"
}
```

---

### Get Customer with Effective Limits

```python
customer = await Customer.find_one(Customer.phone_number == "1234567890")

# Get effective limits
credit_limit = await customer.get_effective_credit_limit()  # Decimal
loan_limit = await customer.get_effective_loan_limit()      # int

print(f"Credit Limit: ${credit_limit}")
print(f"Loan Limit: {loan_limit} active loans")
```

---

## Validation Layers

Both systems have **4 validation layers**:

### Layer 1: Frontend Real-Time Validation
- Validates as user types
- Shows red border + error message immediately
- Disables save button when errors present

### Layer 2: Frontend Pre-Submit Validation
- Backup validation before API call
- Shows toast error if validation fails
- Prevents invalid submissions

### Layer 3: Backend Pydantic Schema
- API request validation
- Field constraints (`ge`, `le`)
- Returns 422 Unprocessable Entity on violation

### Layer 4: Runtime Enforcement
- Business logic validation
- Transaction service checks limits before creation
- Returns error if limits exceeded

---

## Error Messages

### Credit Limit Errors

**Frontend**:
- "Credit limit cannot be below $3,000"

**Backend**:
- "Customer credit limit cannot be below $3,000"
- "Transaction would exceed customer credit limit"

### Loan Limit Errors

**Frontend**:
- "Loan limit cannot be below 8"
- "Loan limit cannot exceed 20"

**Backend**:
- "Loan limit cannot be below 8"
- "Customer has reached maximum active loans"

---

## Testing

See `TEST_VALIDATION.md` for comprehensive test results.

**Quick Validation**:
1. Change Financial Policy defaults → Verify dynamic updates
2. Set custom limits → Verify overrides work
3. Clear custom limits → Verify fallback to system defaults
4. Try invalid values → Verify all validation layers

---

## Troubleshooting

### Q: I changed the Financial Policy but customer limits didn't change

**A**: Check if customer has custom limit set. Custom limits override system defaults.

```python
if customer.credit_limit is not None:
    print("Customer has custom credit limit")
if customer.custom_loan_limit is not None:
    print("Customer has custom loan limit")
```

---

### Q: How do I make all customers use the new system default?

**A**: Clear all custom limits:

```python
# Clear credit limits
customers = await Customer.find(Customer.credit_limit != None).to_list()
for customer in customers:
    customer.credit_limit = None
    await customer.save()

# Clear loan limits
customers = await Customer.find(Customer.custom_loan_limit != None).to_list()
for customer in customers:
    customer.custom_loan_limit = None
    await customer.save()
```

---

### Q: Where are the system defaults stored?

**A**: In `FinancialPolicyConfig` collection:
- `customer_credit_limit` - Credit limit default
- `max_active_loans_per_customer` - Loan limit default

---

## Architecture Benefits

### 1. Single Source of Truth
- All limits in `FinancialPolicyConfig`
- No confusion about which config to use
- Consistent API for reading and updating

### 2. Dynamic Updates
- Changes take effect immediately
- No need to update each customer
- System-wide consistency

### 3. Flexibility
- Per-customer overrides when needed
- Easy to revert to system defaults
- VIP treatment for specific customers

### 4. Maintainability
- Centralized logic in model methods
- Changes in one place affect entire system
- Easy to test and validate

---

## Related Documentation

- **IMPLEMENTATION_HISTORY.md** - How we built this system
- **TEST_VALIDATION.md** - Comprehensive test results
- **CLAUDE.md** - Technical implementation details

---

## Summary

**Credit and Loan Limits** work identically with complete parity:
- ✅ Dynamic system defaults via Financial Policy
- ✅ Per-customer custom overrides
- ✅ Immediate dynamic updates
- ✅ Multi-layer validation
- ✅ Centralized model methods
- ✅ Clean, maintainable architecture

Both systems provide flexible, powerful limit management with excellent UX and developer experience.

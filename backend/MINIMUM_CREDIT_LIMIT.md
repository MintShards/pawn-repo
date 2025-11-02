# Minimum Credit Limit Requirement - $3,000 Floor

## Business Rule

**The Financial Policy default credit limit cannot be set below $3,000.**

This is a hard business rule enforced at multiple layers to ensure customers always have a reasonable minimum credit capacity.

## Implementation

### Backend Validation

**1. Pydantic Schema** (`app/schemas/business_config_schema.py`):
```python
customer_credit_limit: Optional[float] = Field(
    None,
    ge=3000.0,  # Greater than or equal to $3,000
    description="Default customer credit limit (minimum $3,000)"
)
```

**2. Database Model** (`app/models/business_config_model.py`):
```python
customer_credit_limit: Optional[float] = Field(
    None,
    ge=3000.0,  # Enforced at model level
    description="Default customer credit limit (minimum $3,000, None = not configured)"
)
```

### Frontend Validation

**1. Form Validation** (`frontend/src/components/admin/business-config/FinancialPolicyConfig.jsx`):
```javascript
// Validate customer credit limit minimum
if (formData.customer_credit_limit && parseFloat(formData.customer_credit_limit) < 3000) {
  toast.error('Customer credit limit cannot be below $3,000');
  return;
}
```

**2. Input Field**:
```jsx
<Input
  type="number"
  min="3000"  // HTML5 validation
  placeholder="e.g., 5000.00 (min: $3,000)"
/>
<p className="text-xs text-slate-500 mt-1">
  Minimum $3,000. Leave empty to keep current default.
</p>
```

## Validation Layers

1. **HTML5 Input**: `min="3000"` prevents typing values below $3,000
2. **Frontend JS**: Toast error before API call
3. **Backend Schema**: Pydantic validation rejects values < $3,000
4. **Database Model**: Field-level constraint enforces minimum

## Error Messages

### Frontend
```
"Customer credit limit cannot be below $3,000"
```

### Backend (Pydantic Validation Error)
```json
{
  "detail": [
    {
      "loc": ["body", "customer_credit_limit"],
      "msg": "ensure this value is greater than or equal to 3000.0",
      "type": "value_error.number.not_ge"
    }
  ]
}
```

## Why $3,000 Minimum?

1. **Historical Default**: System originally had $3,000 as hardcoded default
2. **Business Risk**: Lower limits may not provide adequate credit capacity for typical transactions
3. **Consistency**: Ensures all customers have meaningful borrowing power
4. **Operational**: Prevents accidental misconfiguration (e.g., typing $300 instead of $3,000)

## Allowed Values

| Range | Validation | Description |
|-------|------------|-------------|
| `null` or empty | ✅ Allowed | No default configured, falls back to $3,000 |
| `< 3000` | ❌ Rejected | Below minimum |
| `3000 - 50000` | ✅ Allowed | Valid range |
| `> 50000` | ❌ Rejected | Above maximum |

## Testing

### Test 1: Try to Set Below Minimum (Frontend)
```
1. Go to Financial Policy settings
2. Set Customer Credit Limit to $2,500
3. Click Save
4. Expected: Error toast "Customer credit limit cannot be below $3,000"
```

### Test 2: Try to Set Below Minimum (API)
```bash
curl -X POST http://localhost:8000/api/v1/business-config/financial-policy \
  -H "Content-Type: application/json" \
  -d '{
    "customer_credit_limit": 2500,
    ...
  }'

# Expected: 422 Validation Error
```

### Test 3: Set to Minimum (Valid)
```
1. Set Customer Credit Limit to $3,000
2. Click Save
3. Expected: Success ✅
```

### Test 4: Set Above Minimum (Valid)
```
1. Set Customer Credit Limit to $5,000
2. Click Save
3. Expected: Success ✅
```

### Test 5: Leave Empty (Valid)
```
1. Leave Customer Credit Limit empty
2. Click Save
3. Expected: Success ✅ (uses existing default or falls back to $3,000)
```

## Impact on Dynamic Credit Limits

The $3,000 minimum ensures that even in the dynamic system:

```
Customer with credit_limit = null:
  → Fetches Financial Policy default
  → Default is always ≥ $3,000
  → Customer always has ≥ $3,000 credit capacity
```

**No Risk**: Customers using system default (`credit_limit = null`) will never have less than $3,000 capacity because the system prevents setting Financial Policy below this minimum.

## Bypassing (NOT Recommended)

If you absolutely need to set a customer below $3,000:

**Option 1: Per-Customer Custom Limit** (Recommended if needed)
```
1. Select specific customer
2. Set custom credit limit (e.g., $1,000)
3. This bypasses Financial Policy for that customer only
```

**Option 2: Code Change** (Not recommended)
```python
# Remove or lower ge=3000.0 constraint in:
# - app/schemas/business_config_schema.py
# - app/models/business_config_model.py
# - frontend validation
```

⚠️ **Warning**: Bypassing this validation removes the safety net against misconfiguration and may allow credit limits that don't meet business requirements.

## Summary

✅ **Enforced Minimum**: $3,000 floor for Financial Policy default
✅ **Multi-Layer Validation**: Frontend, backend schema, database model
✅ **Clear Error Messages**: User-friendly feedback on validation failures
✅ **Documented**: All documentation updated with minimum requirement
✅ **Tested**: Validation works across all entry points

**Result**: The system prevents accidentally setting the default credit limit below $3,000, ensuring all customers have adequate credit capacity while still allowing the flexibility to set higher defaults (e.g., $4,000, $5,000) as business needs change.

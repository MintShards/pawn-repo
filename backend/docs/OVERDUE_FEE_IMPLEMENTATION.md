# Overdue Fee Implementation Documentation

## Overview

Comprehensive backend implementation for manually-entered overdue fees on overdue pawn transactions. Staff/admin users can set custom overdue fees that are automatically included in redemption calculations.

## Implementation Date

**Completed:** 2025-10-06

## Business Rules

1. **Manual Entry**: Overdue fees are manually entered by staff/admin, not automatically calculated
2. **Status Requirement**: Only transactions with `OVERDUE` status can have overdue fees set
3. **Fee Limits**:
   - Minimum: $0
   - Maximum: $10,000
4. **Payment Priority**: Interest → Overdue Fee → Principal
5. **Balance Integration**: Overdue fees are included in all balance calculations and redemption amounts
6. **Audit Trail**: All overdue fee changes create audit entries with full details

## Database Changes

### PawnTransaction Model
**File:** `backend/app/models/pawn_transaction_model.py`

**New Field:**
```python
overdue_fee: int = Field(
    default=0,
    ge=0,
    description="Manually entered overdue fee for overdue transactions (whole dollars)"
)
```

### Audit Entry Model
**File:** `backend/app/models/audit_entry_model.py`

**New Action Types:**
```python
OVERDUE_FEE_SET = "overdue_fee_set"
OVERDUE_FEE_CLEARED = "overdue_fee_cleared"
```

## Service Layer

### OverdueFeeService
**File:** `backend/app/services/overdue_fee_service.py`

**Key Methods:**

1. **`set_overdue_fee()`**
   - Set or update overdue fee on a transaction
   - Validates transaction status (must be OVERDUE)
   - Creates audit trail entry
   - Invalidates caches for real-time updates

2. **`clear_overdue_fee()`**
   - Remove overdue fee from transaction
   - Creates audit trail entry
   - Invalidates caches

3. **`get_overdue_fee_info()`**
   - Get current overdue fee information
   - Returns eligibility, days overdue, etc.

4. **`calculate_total_with_overdue_fee()`**
   - Calculate total redemption amount including overdue fee
   - Provides detailed breakdown

5. **`validate_overdue_fee_amount()`**
   - Validate proposed fee before setting
   - Returns validation errors, warnings, and impact analysis

### InterestCalculationService Updates
**File:** `backend/app/services/interest_calculation_service.py`

**Modified:** `calculate_current_balance()` method

**Changes:**
- Added overdue fee to total due calculation
- Updated payment allocation: Interest → Overdue Fee → Principal
- Added `overdue_fee_paid` and `overdue_fee_balance` tracking

**New Balance Formula:**
```python
total_due = loan_amount + total_interest_due + overdue_fee
```

**Payment Allocation:**
```python
# 1. Pay interest first
interest_paid = min(remaining_payments, total_interest_due)

# 2. Pay overdue fee second
overdue_fee_paid = min(remaining_payments, overdue_fee)

# 3. Pay principal third
principal_paid = min(remaining_payments, loan_amount)
```

## API Endpoints

### Router Registration
**File:** `backend/app/api/api_v1/router.py`

**Base Path:** `/api/v1/overdue-fee`

### Available Endpoints

#### 1. Set Overdue Fee
```
POST /api/v1/overdue-fee/{transaction_id}/set
```

**Request Body:**
```json
{
  "overdue_fee": 75,
  "notes": "Customer is 30 days overdue, standard fee applied"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Overdue fee set to $75",
  "transaction_id": "PW000123",
  "overdue_fee": 75,
  "status": "overdue"
}
```

**Authorization:** Staff or Admin

---

#### 2. Clear Overdue Fee
```
POST /api/v1/overdue-fee/{transaction_id}/clear
```

**Request Body:**
```json
{
  "reason": "Customer discount approved by manager"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Overdue fee cleared",
  "transaction_id": "PW000123",
  "overdue_fee": 0,
  "status": "overdue"
}
```

**Authorization:** Staff or Admin

---

#### 3. Get Overdue Fee Info
```
GET /api/v1/overdue-fee/{transaction_id}/info
```

**Response:**
```json
{
  "transaction_id": "PW000123",
  "status": "overdue",
  "is_overdue": true,
  "is_eligible_for_fee": true,
  "current_overdue_fee": 75,
  "current_overdue_fee_formatted": "$75",
  "has_overdue_fee": true,
  "days_overdue": 15,
  "maturity_date": "2024-12-15T00:00:00Z",
  "can_set_fee": true,
  "can_clear_fee": true
}
```

**Authorization:** Staff or Admin

---

#### 4. Calculate Total with Overdue Fee
```
GET /api/v1/overdue-fee/{transaction_id}/total
```

**Response:**
```json
{
  "transaction_id": "PW000123",
  "base_balance": 550,
  "base_balance_formatted": "$550",
  "overdue_fee": 75,
  "overdue_fee_formatted": "$75",
  "total_redemption_amount": 625,
  "total_redemption_amount_formatted": "$625",
  "has_overdue_fee": true,
  "breakdown": {
    "principal_balance": 400,
    "interest_balance": 100,
    "extension_fees_balance": 50,
    "overdue_fee": 75,
    "total": 625
  }
}
```

**Authorization:** Staff or Admin

---

#### 5. Validate Overdue Fee
```
POST /api/v1/overdue-fee/{transaction_id}/validate
```

**Request Body:**
```json
{
  "proposed_fee": 150
}
```

**Response:**
```json
{
  "transaction_id": "PW000123",
  "is_valid": true,
  "validation_errors": [],
  "warnings": ["Large overdue fee - ensure proper authorization"],
  "proposed_fee": 150,
  "current_fee": 75,
  "fee_difference": 75,
  "current_total_due": 625,
  "new_total_due": 700,
  "impact": "increase",
  "can_proceed": true
}
```

**Authorization:** Staff or Admin

## Schema Updates

### BalanceResponse Schema
**File:** `backend/app/schemas/pawn_transaction_schema.py`

**New Fields:**
```python
overdue_fee_due: int = Field(default=0, description="Manually-entered overdue fee")
overdue_fee_paid: int = Field(default=0, description="Overdue fee payments made")
overdue_fee_balance: int = Field(default=0, description="Remaining overdue fee balance")
```

### New Schemas
**File:** `backend/app/schemas/overdue_fee_schema.py`

**Schemas:**
- `OverdueFeeSetRequest` - Request to set fee
- `OverdueFeeClearRequest` - Request to clear fee
- `OverdueFeeResponse` - Operation response
- `OverdueFeeInfoResponse` - Fee information
- `OverdueFeeTotalResponse` - Total calculation with breakdown
- `OverdueFeeValidationRequest` - Validation request
- `OverdueFeeValidationResponse` - Validation result

## Testing

### Test Script
**File:** `backend/test_overdue_fee.py`

**Test Coverage:**
1. ✅ Set overdue fee with validation
2. ✅ Get overdue fee information
3. ✅ Calculate total redemption amount with fee
4. ✅ Balance calculation integration
5. ✅ Fee amount validation (positive and negative cases)
6. ✅ Clear overdue fee

**Run Tests:**
```bash
cd backend
source env/bin/activate  # Activate virtual environment
python test_overdue_fee.py
```

Or run directly with virtual environment Python:
```bash
cd backend
env/bin/python test_overdue_fee.py
```

**Expected Output:**
- All 6 tests should pass
- Test data automatically created and cleaned up
- Full audit trail verification

## Integration Points

### 1. Balance Calculations
- All balance queries include overdue fees
- Payment allocation automatically applies to overdue fees
- Real-time cache invalidation ensures consistency

### 2. Payment Processing
- Overdue fees included in redemption amount
- Payment priority: Interest → Overdue Fee → Principal
- Proper tracking of overdue fee payments

### 3. Transaction Status
- Only OVERDUE transactions can have fees
- Fees persist through status changes
- Audit trail tracks all fee modifications

### 4. Audit Trail
- All fee operations create audit entries
- Includes staff member, timestamp, and details
- Full history preserved in transaction record

## Usage Examples

### Set Overdue Fee via API

```bash
# Login and get token
curl -X POST http://localhost:8000/api/v1/auth/jwt/login \
  -H "Content-Type: application/json" \
  -d '{"user_id": "02", "pin": "1234"}'

# Set overdue fee
curl -X POST http://localhost:8000/api/v1/overdue-fee/PW000123/set \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"overdue_fee": 75, "notes": "30 days overdue"}'

# Get total redemption amount
curl -X GET http://localhost:8000/api/v1/overdue-fee/PW000123/total \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Use in Service Code

```python
from app.services.overdue_fee_service import OverdueFeeService

# Set overdue fee
transaction = await OverdueFeeService.set_overdue_fee(
    transaction_id="PW000123",
    overdue_fee=75,
    set_by_user_id="02",
    notes="Customer is 30 days overdue"
)

# Get total with overdue fee
total_info = await OverdueFeeService.calculate_total_with_overdue_fee("PW000123")
print(f"Total redemption: ${total_info['total_redemption_amount']}")

# Clear fee
await OverdueFeeService.clear_overdue_fee(
    transaction_id="PW000123",
    cleared_by_user_id="02",
    reason="Manager approval"
)
```

## Error Handling

### Common Errors

1. **Transaction Not Found (404)**
   ```json
   {"detail": "Transaction PW000123 not found"}
   ```

2. **Invalid Status (400)**
   ```json
   {"detail": "Overdue fees can only be set on OVERDUE transactions. Current status: active"}
   ```

3. **Invalid Amount (400)**
   ```json
   {"detail": "Overdue fee cannot exceed $10,000"}
   ```

4. **Staff Validation (403)**
   ```json
   {"detail": "Staff user 02 is not active"}
   ```

5. **No Fee to Clear (400)**
   ```json
   {"detail": "No overdue fee to clear"}
   ```

## Performance Considerations

1. **Cache Invalidation**: All overdue fee operations invalidate transaction caches for real-time updates
2. **Atomic Operations**: Fee updates are atomic with audit trail creation
3. **Index Usage**: Leverages existing transaction_id indexes
4. **Minimal Overhead**: No automatic calculations, only storage and retrieval

## Security

1. **Authentication Required**: All endpoints require JWT authentication
2. **Role-Based Access**: Staff or Admin role required
3. **Audit Trail**: Full audit trail for all fee operations
4. **Validation**: Comprehensive validation prevents invalid data
5. **Amount Limits**: Maximum fee of $10,000 prevents abuse

## Future Enhancements

Potential future improvements:

1. **Configurable Limits**: Make maximum fee configurable per location
2. **Automated Suggestions**: Calculate suggested fees based on days overdue
3. **Bulk Operations**: Set fees on multiple transactions at once
4. **Reporting**: Generate reports on overdue fees collected
5. **Fee Schedules**: Define standard fee schedules by overdue period
6. **Approval Workflow**: Require manager approval for fees above threshold

## Migration Notes

### Database Migration
- No migration required
- New field `overdue_fee` has default value of 0
- Existing transactions will have `overdue_fee = 0`
- No data loss or corruption risk

### Backward Compatibility
- All existing endpoints remain functional
- Balance calculations automatically include overdue fees (0 by default)
- No breaking changes to existing functionality

## Support

For issues or questions:
1. Check test script for usage examples
2. Review API documentation at `/docs`
3. Examine audit trail for fee history
4. Check logs for service errors

## Files Modified/Created

### Created Files:
- `backend/app/services/overdue_fee_service.py`
- `backend/app/api/api_v1/handlers/overdue_fee.py`
- `backend/app/schemas/overdue_fee_schema.py`
- `backend/test_overdue_fee.py`
- `backend/OVERDUE_FEE_IMPLEMENTATION.md`

### Modified Files:
- `backend/app/models/pawn_transaction_model.py`
- `backend/app/models/audit_entry_model.py`
- `backend/app/services/interest_calculation_service.py`
- `backend/app/schemas/pawn_transaction_schema.py`
- `backend/app/api/api_v1/router.py`

## API Documentation

Full API documentation available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- OpenAPI Schema: `http://localhost:8000/openapi.json`

Search for "Overdue Fee Management" tag in the documentation.

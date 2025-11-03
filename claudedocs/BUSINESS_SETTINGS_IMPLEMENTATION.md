# Business Settings Implementation Documentation

## Overview

Complete implementation of 4 business configuration modules for pawnshop operational management. All configurations include admin-only access control, audit trails, and active configuration versioning.

## Architecture

### Backend Structure

```
/backend/app/
├── models/business_config_model.py      # MongoDB document models
├── schemas/business_config_schema.py    # Pydantic validation schemas
├── api/api_v1/handlers/business_config.py  # API endpoints
```

### Frontend Structure

```
/frontend/src/
├── services/businessConfigService.js    # API service layer
├── components/admin/business-config/
│   ├── CompanyInfoConfig.jsx           # Company information UI
│   ├── FinancialPolicyConfig.jsx       # Financial policies UI
│   ├── ForfeitureConfig.jsx            # Forfeiture rules UI
│   └── PrinterConfig.jsx               # Printer configuration UI
└── components/admin/settings/BusinessSettingsTab.jsx  # Main container
```

## Features Implemented

### 1. Company Information Configuration

**Purpose**: Store business contact details for receipts and documents

**Fields**:
- `company_name` (required): Business name
- `address_line1` (required): Street address
- `address_line2` (optional): Suite/unit number
- `city` (required): City name
- `state` (required): State/province
- `zip_code` (required): Postal code
- `phone` (required): Contact phone number
- `email` (optional): Email address
- `website` (optional): Website URL

**API Endpoints**:
- `GET /api/v1/business-config/company` - Get current active configuration
- `POST /api/v1/business-config/company` - Create/update configuration (Admin only)
- `GET /api/v1/business-config/company/history` - View configuration history (Admin only)

**Access**: All authenticated users can view, only admins can modify

### 2. Financial Policy Configuration

**Purpose**: Define interest rates, extension fees, loan limits, and credit policies

**Interest Rate Settings** (Percentage-Based):
- `default_monthly_interest_rate` (required, 0-100%): Default monthly interest percentage
- `min_interest_rate` (0-100%): Minimum allowed interest percentage
- `max_interest_rate` (required, 0-100%): Maximum allowed interest percentage (configurable, currently 50%)

**Extension Fee Settings**:
- ~~`extension_fee_30_days`~~ (removed - managed manually per transaction)
- ~~`extension_fee_60_days`~~ (removed - managed manually per transaction)
- ~~`extension_fee_90_days`~~ (removed - managed manually per transaction)
- ~~`max_extensions_allowed`~~ (removed - managed manually per transaction)

**Loan Limits**:
- `min_loan_amount` (≥0): Minimum loan amount allowed
- `max_loan_amount` (≥0): Maximum loan amount allowed
- `max_active_loans_per_customer` (1-20): Maximum concurrent loans per customer

**Credit Limit Settings**:
- `customer_credit_limit` (optional, ≥0): Customer credit limit amount
- `enforce_credit_limit` (boolean): Whether to enforce credit limit validation

**Audit Requirements**:
- `reason` (required, 5-500 chars): Explanation for configuration change
- `section_updated` (optional): Indicator for which section was modified ("interest_rates", "loan_limit", "credit_limit")

**Section-Specific Timestamps**:
- `interest_rates_updated_at` (optional): Last update time for interest rate settings
- `loan_limit_updated_at` (optional): Last update time for loan limit settings
- `credit_limit_updated_at` (optional): Last update time for credit limit settings

When updating a specific section, only that section's timestamp is updated while preserving timestamps from other sections. This allows administrators to track when each configuration section was last modified independently.

**API Endpoints**:
- `GET /api/v1/business-config/financial-policy` - Get current active configuration
- `POST /api/v1/business-config/financial-policy` - Create/update configuration (Admin only)
- `GET /api/v1/business-config/financial-policy/history` - View configuration history (Admin only)

**Validation Rules**:
- `max_interest_rate` must be ≥ `min_interest_rate`
- `max_loan_amount` must be ≥ `min_loan_amount`

**Validation Architecture**:
- **Model Validation** (`pawn_transaction_model.py`): Technical upper bound of 100% to prevent unreasonable values
- **Business Rules** (`FinancialPolicyConfig`): Configurable maximum (currently 50%) enforced at transaction creation
- **Migration Handling**: Existing transactions with `monthly_interest_percentage` auto-calculated from dollar amounts
- **Backward Compatibility**: Optional percentage field with automatic calculation for legacy transactions

### 3. Forfeiture Configuration

**Purpose**: Define automatic item forfeiture rules and customer notification settings

**Fields**:
- `forfeiture_days` (required, 30-365): Days after loan date before automatic forfeiture
- `grace_period_days` (0-30): Additional days after threshold
- `notification_days_before` (0-30): Days before forfeiture to notify customer
- `enable_notifications` (boolean): Whether to enable customer notifications
- `reason` (required, 5-500 chars): Explanation for configuration change

**API Endpoints**:
- `GET /api/v1/business-config/forfeiture` - Get current active configuration
- `POST /api/v1/business-config/forfeiture` - Create/update configuration (Admin only)
- `GET /api/v1/business-config/forfeiture/history` - View configuration history (Admin only)

**Business Logic**:
- Total forfeiture period = `forfeiture_days` + `grace_period_days`
- Notification sent at: forfeiture date - `notification_days_before`

### 4. Printer Configuration

**Purpose**: Configure printer settings for receipts and reports

**Receipt Printer Settings**:
- `default_receipt_printer` (optional): Printer name (blank = browser default)
- `receipt_paper_size`: Paper size (80mm, A4, Letter)
- `receipt_copies` (1-3): Number of copies to print
- `auto_print_receipts` (boolean): Automatically print after transactions

**Report Printer Settings**:
- `default_report_printer` (optional): Printer name (blank = browser default)
- `report_paper_size`: Paper size (A4, Letter, Legal)
- `print_orientation`: Print orientation (portrait, landscape)

**Print Options**:
- `include_logo` (boolean): Include company logo on printed documents

**API Endpoints**:
- `GET /api/v1/business-config/printer` - Get current active configuration
- `POST /api/v1/business-config/printer` - Create/update configuration (Admin only)
- `GET /api/v1/business-config/printer/history` - View configuration history (Admin only)

## Common Patterns

### Active Configuration Pattern

All configuration models use the **active configuration pattern**:

```python
async def set_as_active(self):
    """Set this configuration as active and deactivate all others"""
    await self.__class__.find(
        self.__class__.is_active == True
    ).update({"$set": {"is_active": False}})
    self.is_active = True
    await self.save()
```

**Benefits**:
- Only one active configuration at a time
- Full history of all configuration changes
- Easy rollback to previous configurations

### Audit Trail

All configurations track:
- `created_at`: Timestamp when configuration was created
- `updated_at`: Timestamp of last update
- `updated_by`: User ID of the admin who made the change
- `is_active`: Whether this is the current active configuration

**Financial Policy Section-Specific Timestamps** (Added Nov 2025):
- `interest_rates_updated_at`: When interest rate settings were last modified
- `loan_limit_updated_at`: When loan limit was last modified
- `credit_limit_updated_at`: When credit limit was last modified

Each configuration section within Financial Policy tracks its own independent update timestamp, allowing administrators to see exactly when each specific setting was last changed.

### Frontend Form Pattern

All configuration components follow consistent patterns:

1. **State Management**:
```javascript
const [loading, setLoading] = useState(false);
const [saving, setSaving] = useState(false);
const [config, setConfig] = useState(null);
const [formData, setFormData] = useState({ /* initial values */ });
```

2. **Data Fetching on Mount**:
```javascript
useEffect(() => {
  fetchConfig();
}, []);

const fetchConfig = async () => {
  try {
    setLoading(true);
    const data = await businessConfigService.getConfig();
    setConfig(data);
    setFormData({ /* populate from data */ });
  } catch (error) {
    if (error.status !== 404) {
      toast.error('Failed to load configuration');
    }
  } finally {
    setLoading(false);
  }
};
```

3. **Form Submission**:
```javascript
const handleSubmit = async (e) => {
  e.preventDefault();

  // Validation
  if (!formData.required_field) {
    toast.error('Please fill in all required fields');
    return;
  }

  // Type conversion
  const payload = {
    ...formData,
    numeric_field: parseFloat(formData.numeric_field),
    integer_field: parseInt(formData.integer_field),
  };

  try {
    setSaving(true);
    await businessConfigService.createConfig(payload);
    toast.success('Configuration saved successfully');
    await fetchConfig();
  } catch (error) {
    toast.error(error.detail || 'Failed to save configuration');
  } finally {
    setSaving(false);
  }
};
```

## Usage Guide

### For Administrators

#### Initial Setup

1. Navigate to **Admin Settings > Business Settings**
2. Fill out each configuration section from top to bottom
3. All fields marked with asterisk (*) are required
4. Click "Save" button for each section

#### Updating Configurations

1. Navigate to desired configuration section
2. Modify fields as needed
3. For Financial Policy and Forfeiture Config: **Must provide a reason for the change**
4. Click "Save" button
5. Previous configuration is automatically archived

#### Viewing Configuration History

History endpoints are available via API for audit purposes:
- `/api/v1/business-config/company/history`
- `/api/v1/business-config/financial-policy/history`
- `/api/v1/business-config/forfeiture/history`
- `/api/v1/business-config/printer/history`

### For Developers

#### Adding New Configuration Type

1. **Create Model** in `business_config_model.py`:
```python
class NewConfig(Document):
    # Fields
    field_name: str = Field(...)

    # Audit trail
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    updated_by: str = Field(...)

    # Use active configuration pattern
    async def set_as_active(self):
        await self.__class__.find(
            self.__class__.is_active == True
        ).update({"$set": {"is_active": False}})
        self.is_active = True
        await self.save()

    class Settings:
        name = "new_configs"
```

2. **Create Schemas** in `business_config_schema.py`:
```python
class NewConfigCreate(BaseModel):
    field_name: str = Field(...)

class NewConfigResponse(BaseModel):
    id: str = Field(..., alias="_id")
    field_name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    updated_by: str
```

3. **Add API Endpoints** in `business_config.py`:
```python
@router.get("/new-config", response_model=NewConfigResponse)
async def get_new_config(current_user: User = Depends(require_login)):
    config = await NewConfig.find_one(NewConfig.is_active == True)
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    return config

@router.post("/new-config", response_model=NewConfigResponse)
async def create_new_config(
    config_data: NewConfigCreate,
    current_user: User = Depends(require_admin)
):
    new_config = NewConfig(**config_data.model_dump(), updated_by=current_user.user_id)
    await new_config.set_as_active()
    return new_config
```

4. **Register Model** in `app.py`:
```python
from app.models.business_config_model import NewConfig

await init_beanie(
    database=db_client,
    document_models=[..., NewConfig]
)
```

5. **Add Service Methods** in `businessConfigService.js`:
```javascript
async getNewConfig() {
  return await authService.apiRequest('/api/v1/business-config/new-config', {
    method: 'GET',
  });
},

async createNewConfig(config) {
  return await authService.apiRequest('/api/v1/business-config/new-config', {
    method: 'POST',
    body: JSON.stringify(config),
  });
},
```

6. **Create React Component** in `components/admin/business-config/NewConfig.jsx`
7. **Add to BusinessSettingsTab.jsx** with lazy loading

## API Reference

### Common Response Codes

- `200 OK`: Successful GET request
- `201 Created`: Successful POST request
- `400 Bad Request`: Validation error
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Insufficient permissions (not admin)
- `404 Not Found`: Configuration not found
- `422 Unprocessable Entity`: Invalid data format

### Authentication

All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

Admin-only endpoints (POST and history) require admin role.

### Request/Response Examples

#### Get Company Configuration

```http
GET /api/v1/business-config/company
Authorization: Bearer <token>
```

Response:
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "company_name": "CashNow Solutions",
  "address_line1": "123 Main St",
  "address_line2": "Suite 100",
  "city": "Springfield",
  "state": "IL",
  "zip_code": "62701",
  "phone": "(555) 123-4567",
  "email": "info@cashnow.com",
  "website": "https://www.cashnow.com",
  "is_active": true,
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-01-15T10:30:00Z",
  "updated_by": "69"
}
```

#### Create Financial Policy Configuration

```http
POST /api/v1/business-config/financial-policy
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "default_monthly_interest_rate": 50.0,
  "min_interest_rate": 10.0,
  "max_interest_rate": 200.0,
  "min_loan_amount": 10.0,
  "max_loan_amount": 10000.0,
  "max_active_loans_per_customer": 8,
  "customer_credit_limit": 5000.0,
  "enforce_credit_limit": false,
  "reason": "Updating interest rates to match market conditions"
}
```

## Testing

### Manual Testing Checklist

#### Company Information
- [ ] Create new company configuration
- [ ] Verify all fields saved correctly
- [ ] Update existing configuration
- [ ] Check last updated timestamp and user ID

#### Financial Policy
- [ ] Create configuration with all required fields
- [ ] Verify validation: max_interest_rate ≥ min_interest_rate
- [ ] Verify validation: max_loan_amount ≥ min_loan_amount
- [ ] Verify validation: reason field (min 5 characters)
- [ ] Test checkbox toggle (enforce_credit_limit)
- [ ] Test optional credit_limit field

#### Forfeiture Configuration
- [ ] Create configuration with valid day ranges
- [ ] Verify validation: forfeiture_days (30-365)
- [ ] Verify validation: grace_period_days (0-30)
- [ ] Verify validation: notification_days_before (0-30)
- [ ] Verify validation: reason field (min 5 characters)
- [ ] Test enable_notifications checkbox

#### Printer Configuration
- [ ] Create configuration with all settings
- [ ] Test paper size dropdowns
- [ ] Test orientation dropdown
- [ ] Test number of copies input (1-3)
- [ ] Test checkbox toggles (auto_print_receipts, include_logo)
- [ ] Verify blank printer name defaults to browser dialog

### API Testing with cURL

```bash
# Login as admin
curl -X POST http://localhost:8000/api/v1/auth/jwt/login \
  -H "Content-Type: application/json" \
  -d '{"user_id": "69", "pin": "6969"}'

# Save access token
export TOKEN="<access_token_from_response>"

# Get company configuration
curl -X GET http://localhost:8000/api/v1/business-config/company \
  -H "Authorization: Bearer $TOKEN"

# Create company configuration
curl -X POST http://localhost:8000/api/v1/business-config/company \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "CashNow Solutions",
    "address_line1": "123 Main St",
    "city": "Springfield",
    "state": "IL",
    "zip_code": "62701",
    "phone": "(555) 123-4567"
  }'
```

## Security Considerations

### Access Control
- All GET endpoints: Require authentication
- All POST endpoints: Require admin role
- History endpoints: Require admin role

### Data Validation
- Pydantic schemas enforce field types and constraints
- Custom validators for business rule validation
- Min/max range validation on numeric fields

### Audit Trail
- All configuration changes tracked with user ID
- Reason field required for financial and forfeiture changes
- Complete history preserved for compliance

## Performance Considerations

### Frontend Optimization
- Lazy loading with React.lazy() and Suspense
- Only one configuration loaded at a time
- Minimal re-renders with proper state management

### Backend Optimization
- Single database query for active configuration
- Indexed queries on is_active field
- Efficient update operations with MongoDB operators

## Future Enhancements

### Potential Features
1. **Configuration Validation**: Cross-field business rule validation
2. **Configuration Templates**: Pre-defined configuration sets
3. **Bulk Configuration Import/Export**: JSON import/export functionality
4. **Configuration Approval Workflow**: Multi-step approval for critical changes
5. **Configuration Comparison**: Diff view between configuration versions
6. **Configuration Scheduling**: Schedule configuration changes for future dates
7. **Integration with Receipt System**: Auto-populate company info in receipts
8. **Integration with Transaction Rules**: Enforce financial policies at transaction level

### Database Migration
Consider creating migration script to set initial default configurations:

```python
# migration_script.py
async def create_default_configs():
    # Create default company config
    company = CompanyConfig(
        company_name="Your Pawn Shop",
        address_line1="123 Main St",
        city="Springfield",
        state="IL",
        zip_code="62701",
        phone="(555) 123-4567",
        updated_by="system"
    )
    await company.set_as_active()

    # Create default financial policy
    financial = FinancialPolicyConfig(
        default_monthly_interest_rate=50.0,
        max_interest_rate=200.0,
        reason="Initial system setup",
        updated_by="system"
    )
    await financial.set_as_active()

    # Create default forfeiture config
    forfeiture = ForfeitureConfig(
        forfeiture_days=97,
        reason="Initial system setup",
        updated_by="system"
    )
    await forfeiture.set_as_active()

    # Create default printer config
    printer = PrinterConfig(
        receipt_paper_size="80mm",
        receipt_copies=1,
        report_paper_size="Letter",
        print_orientation="portrait",
        updated_by="system"
    )
    await printer.set_as_active()
```

## Troubleshooting

### Common Issues

**Issue**: Configuration not appearing after save
- **Solution**: Check browser console for API errors, verify admin authentication

**Issue**: Validation errors on form submission
- **Solution**: Ensure all required fields filled, check numeric field formats

**Issue**: "Configuration not found" error
- **Solution**: No active configuration exists, create initial configuration

**Issue**: Changes not persisting
- **Solution**: Verify `set_as_active()` method called, check MongoDB connection

## Related Documentation

- Main project README: `/pawn-repo/CLAUDE.md`
- API documentation: http://localhost:8000/docs
- Frontend component library: ShadCN UI documentation

## Support

For implementation questions or issues:
1. Check API documentation at `/docs`
2. Review browser console for frontend errors
3. Check backend logs for API errors
4. Verify MongoDB connection and data persistence

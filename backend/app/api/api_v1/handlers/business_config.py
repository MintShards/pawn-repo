"""
Business Configuration API Endpoints

Handles all business settings configuration endpoints including:
- Company information
- Financial policies (with before/after value tracking)
- Forfeiture rules
- Printer configuration
"""

from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File
from typing import List
import os
import uuid
from pathlib import Path

from app.models.business_config_model import (
    CompanyConfig,
    FinancialPolicyConfig,
    ForfeitureConfig,
    PrinterConfig,
    LocationConfig
)
from app.schemas.business_config_schema import (
    CompanyConfigCreate,
    CompanyConfigResponse,
    FinancialPolicyConfigCreate,
    FinancialPolicyConfigResponse,
    ForfeitureConfigCreate,
    ForfeitureConfigResponse,
    PrinterConfigCreate,
    LocationConfigCreate,
    LocationConfigResponse,
    PrinterConfigResponse
)
from app.models.user_model import User
from app.api.deps import get_current_user, require_admin
from app.models.user_activity_log_model import log_user_activity, UserActivityType, ActivitySeverity

router = APIRouter()


# ==================== Company Configuration ====================

@router.get("/company", response_model=CompanyConfigResponse)
async def get_company_config(
    current_user: User = Depends(get_current_user)
):
    """
    Get current company configuration.
    Accessible by all authenticated users.
    """
    config = await CompanyConfig.get_current_config()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company configuration not found. Please create initial configuration."
        )
    return config


@router.post("/company", response_model=CompanyConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_company_config(
    config_data: CompanyConfigCreate,
    current_user: User = Depends(require_admin)
):
    """
    Create or update company configuration.
    Admin only.
    """
    # Get previous config for comparison
    previous_config = await CompanyConfig.get_current_config()

    # Create new configuration
    new_config = CompanyConfig(
        **config_data.model_dump(),
        updated_by=current_user.user_id
    )

    # Set as active (deactivates others)
    await new_config.set_as_active()

    # Log activity with before/after values
    metadata = {
        "config_type": "company",
        "new_company_name": config_data.company_name,
        "has_previous": previous_config is not None
    }

    if previous_config:
        metadata["old_company_name"] = previous_config.company_name
        metadata["old_address"] = f"{previous_config.address_line1}, {previous_config.city}"
        metadata["new_address"] = f"{config_data.address_line1}, {config_data.city}"
        if previous_config.phone != config_data.phone:
            metadata["old_phone"] = previous_config.phone
            metadata["new_phone"] = config_data.phone

    await log_user_activity(
        user_id=current_user.user_id,
        activity_type=UserActivityType.SETTINGS_CHANGED,
        description=f"Updated company configuration: {config_data.company_name}",
        severity=ActivitySeverity.INFO,
        details=f"Updated company settings including name, address, and contact information",
        metadata=metadata
    )

    return new_config


@router.get("/company/history", response_model=List[CompanyConfigResponse])
async def get_company_config_history(
    current_user: User = Depends(require_admin)
):
    """
    Get company configuration history.
    Admin only.
    """
    configs = await CompanyConfig.find().sort("-updated_at").to_list()
    return configs


@router.post("/company/upload-logo")
async def upload_company_logo(
    file: UploadFile = File(...),
    current_user: User = Depends(require_admin)
):
    """
    Upload company logo image.
    Admin only.
    Returns the URL path to use in logo_url field.
    """
    # Validate file type
    allowed_types = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed types: {', '.join(allowed_types)}"
        )

    # Validate file size (max 5MB)
    max_size = 5 * 1024 * 1024  # 5MB in bytes
    file_content = await file.read()
    if len(file_content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds 5MB limit"
        )

    # Create uploads directory if it doesn't exist
    # Use absolute path relative to project root
    project_root = Path(__file__).resolve().parents[5]  # Navigate to project root from handlers
    upload_dir = project_root / "frontend" / "public" / "uploads" / "logos"
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Generate unique filename
    file_extension = Path(file.filename).suffix
    unique_filename = f"logo_{uuid.uuid4().hex[:8]}{file_extension}"
    file_path = upload_dir / unique_filename

    # Save file
    with open(file_path, "wb") as f:
        f.write(file_content)

    # Return URL path (relative to frontend public directory)
    logo_url = f"/uploads/logos/{unique_filename}"

    # Log activity
    await log_user_activity(
        user_id=current_user.user_id,
        activity_type=UserActivityType.SETTINGS_CHANGED,
        description=f"Uploaded company logo: {file.filename}",
        severity=ActivitySeverity.INFO,
        details=f"Uploaded new company logo image ({file.content_type})",
        metadata={
            "config_type": "company_logo",
            "filename": unique_filename,
            "original_filename": file.filename,
            "content_type": file.content_type,
            "file_size_kb": len(file_content) / 1024
        }
    )

    return {
        "logo_url": logo_url,
        "message": "Logo uploaded successfully"
    }


# ==================== Financial Policy Configuration ====================

@router.get("/financial-policy", response_model=FinancialPolicyConfigResponse)
async def get_financial_policy_config(
    current_user: User = Depends(get_current_user)
):
    """
    Get current financial policy configuration.
    Accessible by all authenticated users.
    """
    config = await FinancialPolicyConfig.get_current_config()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial policy configuration not found. Please create initial configuration."
        )
    return config


@router.post("/financial-policy", response_model=FinancialPolicyConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_financial_policy_config(
    config_data: FinancialPolicyConfigCreate,
    current_user: User = Depends(require_admin)
):
    """
    Create or update financial policy configuration.
    Admin only.
    """
    from datetime import datetime

    # Section-Specific Timestamp Implementation (Nov 2025)
    # This implementation allows each configuration section (interest rates, loan limit, credit limit)
    # to track its own independent update timestamp, providing administrators with granular
    # visibility into when specific settings were last modified.

    # Get previous config to preserve section timestamps
    previous_config = await FinancialPolicyConfig.get_current_config()

    # Extract section_updated indicator and prepare data
    # Frontend sends section_updated: "interest_rates" | "loan_limit" | "credit_limit"
    config_dict = config_data.model_dump()
    section_updated = config_dict.pop('section_updated', None)

    # Create new configuration document
    new_config = FinancialPolicyConfig(
        **config_dict,
        updated_by=current_user.user_id
    )

    # Preserve existing section timestamps from previous config
    # This ensures that unmodified sections retain their original update times
    if previous_config:
        new_config.interest_rates_updated_at = previous_config.interest_rates_updated_at
        new_config.loan_limit_updated_at = previous_config.loan_limit_updated_at
        new_config.credit_limit_updated_at = previous_config.credit_limit_updated_at

    # Update only the specific section timestamp that was modified
    # This provides independent timestamp tracking per configuration section
    current_time = datetime.utcnow()
    if section_updated == "interest_rates":
        new_config.interest_rates_updated_at = current_time
    elif section_updated == "loan_limit":
        new_config.loan_limit_updated_at = current_time
    elif section_updated == "credit_limit":
        new_config.credit_limit_updated_at = current_time

    # Set as active (deactivates others)
    await new_config.set_as_active()

    # Log activity with section-specific details and before/after values
    section_name = {
        "interest_rates": "Interest Rates",
        "loan_limit": "Loan Limits",
        "credit_limit": "Credit Limits"
    }.get(section_updated, "Financial Policy")

    # Build metadata with before/after values
    metadata = {
        "config_type": "financial_policy",
        "section_updated": section_updated or "all",
        "has_previous": previous_config is not None,
        "reason": new_config.reason
    }

    # Add section-specific before/after values
    if previous_config and section_updated:
        if section_updated == "interest_rates":
            metadata["old_monthly_interest_rate"] = previous_config.default_monthly_interest_rate
            metadata["new_monthly_interest_rate"] = new_config.default_monthly_interest_rate
        elif section_updated == "loan_limit":
            metadata["old_max_active_loans"] = previous_config.max_active_loans_per_customer
            metadata["new_max_active_loans"] = new_config.max_active_loans_per_customer
        elif section_updated == "credit_limit":
            metadata["old_customer_credit_limit"] = previous_config.customer_credit_limit
            metadata["new_customer_credit_limit"] = new_config.customer_credit_limit

    await log_user_activity(
        user_id=current_user.user_id,
        activity_type=UserActivityType.SETTINGS_CHANGED,
        description=f"Updated financial policy: {section_name}",
        severity=ActivitySeverity.INFO,
        details=f"Modified {section_name.lower()} configuration",
        metadata=metadata
    )

    return new_config


@router.get("/financial-policy/history", response_model=List[FinancialPolicyConfigResponse])
async def get_financial_policy_config_history(
    current_user: User = Depends(require_admin)
):
    """
    Get financial policy configuration history.
    Admin only.
    """
    configs = await FinancialPolicyConfig.find().sort("-updated_at").to_list()
    return configs


# ==================== Forfeiture Configuration ====================

@router.get("/forfeiture", response_model=ForfeitureConfigResponse)
async def get_forfeiture_config(
    current_user: User = Depends(get_current_user)
):
    """
    Get current forfeiture configuration.
    Accessible by all authenticated users.
    """
    config = await ForfeitureConfig.get_current_config()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Forfeiture configuration not found. Please create initial configuration."
        )
    return config


@router.post("/forfeiture", response_model=ForfeitureConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_forfeiture_config(
    config_data: ForfeitureConfigCreate,
    current_user: User = Depends(require_admin)
):
    """
    Create or update forfeiture configuration.
    Admin only.
    """
    # Get previous config for comparison
    previous_config = await ForfeitureConfig.get_current_config()

    # Create new configuration
    new_config = ForfeitureConfig(
        **config_data.model_dump(),
        updated_by=current_user.user_id
    )

    # Set as active (deactivates others)
    await new_config.set_as_active()

    # Log activity with before/after values
    metadata = {
        "config_type": "forfeiture",
        "new_forfeiture_days": config_data.forfeiture_days,
        "has_previous": previous_config is not None,
        "reason": new_config.reason
    }

    if previous_config:
        metadata["old_forfeiture_days"] = previous_config.forfeiture_days

    await log_user_activity(
        user_id=current_user.user_id,
        activity_type=UserActivityType.SETTINGS_CHANGED,
        description=f"Updated forfeiture configuration: {config_data.forfeiture_days} days",
        severity=ActivitySeverity.INFO,
        details=f"Modified forfeiture policy settings",
        metadata=metadata
    )

    return new_config


@router.get("/forfeiture/history", response_model=List[ForfeitureConfigResponse])
async def get_forfeiture_config_history(
    current_user: User = Depends(require_admin)
):
    """
    Get forfeiture configuration history.
    Admin only.
    """
    configs = await ForfeitureConfig.find().sort("-updated_at").to_list()
    return configs


# ==================== Printer Configuration ====================

@router.get("/printer", response_model=PrinterConfigResponse)
async def get_printer_config(
    current_user: User = Depends(get_current_user)
):
    """
    Get current printer configuration.
    Accessible by all authenticated users.
    """
    config = await PrinterConfig.get_current_config()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Printer configuration not found. Please create initial configuration."
        )
    return config


@router.post("/printer", response_model=PrinterConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_printer_config(
    config_data: PrinterConfigCreate,
    current_user: User = Depends(require_admin)
):
    """
    Create or update printer configuration.
    Admin only.
    """
    # Get previous config for comparison
    previous_config = await PrinterConfig.get_current_config()

    # Create new configuration
    new_config = PrinterConfig(
        **config_data.model_dump(),
        updated_by=current_user.user_id
    )

    # Set as active (deactivates others)
    await new_config.set_as_active()

    # Log activity
    await log_user_activity(
        user_id=current_user.user_id,
        activity_type=UserActivityType.SETTINGS_CHANGED,
        description=f"Updated printer configuration",
        severity=ActivitySeverity.INFO,
        details=f"Modified printer settings for receipt printing",
        metadata={
            "config_type": "printer",
            "has_previous": previous_config is not None
        }
    )

    return new_config


@router.get("/printer/history", response_model=List[PrinterConfigResponse])
async def get_printer_config_history(
    current_user: User = Depends(require_admin)
):
    """
    Get printer configuration history.
    Admin only.
    """
    configs = await PrinterConfig.find().sort("-updated_at").to_list()
    return configs


# ==================== Location Configuration ====================

@router.get("/location", response_model=LocationConfigResponse)
async def get_location_config():
    """
    Get current location configuration.
    Public endpoint - no authentication required (used for weather display).
    """
    config = await LocationConfig.get_current_config()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location configuration not found. Please create initial configuration."
        )
    return config


@router.post("/location", response_model=LocationConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_location_config(
    config_data: LocationConfigCreate,
    current_user: User = Depends(require_admin)
):
    """
    Create or update location configuration.
    Admin only.
    """
    # Get previous config for comparison
    previous_config = await LocationConfig.get_current_config()

    # Create new configuration
    new_config = LocationConfig(
        **config_data.model_dump(),
        updated_by=current_user.user_id
    )

    # Set as active (deactivates others)
    await new_config.set_as_active()

    # Log activity
    await log_user_activity(
        user_id=current_user.user_id,
        activity_type=UserActivityType.SETTINGS_CHANGED,
        description=f"Updated location configuration: {config_data.location_name}",
        severity=ActivitySeverity.INFO,
        details=f"Modified business location settings for weather display",
        metadata={
            "config_type": "location",
            "location_name": config_data.location_name,
            "city": config_data.city,
            "coordinates": f"{config_data.latitude}, {config_data.longitude}",
            "has_previous": previous_config is not None
        }
    )

    return new_config


@router.get("/location/history", response_model=List[LocationConfigResponse])
async def get_location_config_history(
    current_user: User = Depends(require_admin)
):
    """
    Get location configuration history.
    Admin only.
    """
    configs = await LocationConfig.find().sort("-updated_at").to_list()
    return configs

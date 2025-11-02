"""
Business Configuration API Endpoints

Handles all business settings configuration endpoints including:
- Company information
- Financial policies
- Forfeiture rules
- Printer configuration
"""

from fastapi import APIRouter, HTTPException, Depends, status
from typing import List

from app.models.business_config_model import (
    CompanyConfig,
    FinancialPolicyConfig,
    ForfeitureConfig,
    PrinterConfig
)
from app.schemas.business_config_schema import (
    CompanyConfigCreate,
    CompanyConfigResponse,
    FinancialPolicyConfigCreate,
    FinancialPolicyConfigResponse,
    ForfeitureConfigCreate,
    ForfeitureConfigResponse,
    PrinterConfigCreate,
    PrinterConfigResponse
)
from app.models.user_model import User
from app.api.deps import get_current_user, require_admin

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
    # Create new configuration
    new_config = CompanyConfig(
        **config_data.model_dump(),
        updated_by=current_user.user_id
    )

    # Set as active (deactivates others)
    await new_config.set_as_active()

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
    # Create new configuration
    new_config = FinancialPolicyConfig(
        **config_data.model_dump(),
        updated_by=current_user.user_id
    )

    # Set as active (deactivates others)
    await new_config.set_as_active()

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
    # Create new configuration
    new_config = ForfeitureConfig(
        **config_data.model_dump(),
        updated_by=current_user.user_id
    )

    # Set as active (deactivates others)
    await new_config.set_as_active()

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
    # Create new configuration
    new_config = PrinterConfig(
        **config_data.model_dump(),
        updated_by=current_user.user_id
    )

    # Set as active (deactivates others)
    await new_config.set_as_active()

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

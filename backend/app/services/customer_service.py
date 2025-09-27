
"""
Customer service layer for business logic and data operations.

This module implements all customer-related business operations including
CRUD operations, search functionality, statistics, and status management.
"""

from datetime import datetime
from typing import Optional
from math import ceil
from decimal import Decimal

from fastapi import HTTPException, status
from pymongo import ASCENDING, DESCENDING
import structlog

from app.models.customer_model import Customer, CustomerStatus
from app.schemas.customer_schema import (
    CustomerCreate, CustomerUpdate, CustomerResponse, CustomerListResponse,
    CustomerStatsResponse, LoanLimitUpdateRequest, LoanLimitResponse
)
from app.core.config import settings
from app.models.loan_config_model import LoanConfig
from app.core.redis_cache import BusinessCache, CacheConfig


class CustomerService:
    """Service class for customer business logic"""
    
    # Initialize logger for this service
    logger = structlog.get_logger(__name__)

    @staticmethod
    async def create_customer(customer_data: CustomerCreate, created_by: str) -> Customer:
        """
        Create a new customer
        
        Args:
            customer_data: Customer creation data
            created_by: User ID who is creating the customer
            
        Returns:
            Created customer document
            
        Raises:
            HTTPException: If phone number already exists or validation fails
        """
        # Check if phone number already exists
        existing_customer = await Customer.find_one(
            Customer.phone_number == customer_data.phone_number
        )
        if existing_customer:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Phone number already exists"
            )
        
        # Create customer document
        customer = Customer(
            **customer_data.model_dump(),
            created_by=created_by
        )
        
        try:
            await customer.insert()
            return customer
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create customer: {str(e)}"
            )

    @staticmethod
    async def get_customer_by_phone(phone_number: str) -> Optional[Customer]:
        """Get customer by phone number with caching"""
        # Check cache first
        cached_customer = await BusinessCache.get_customer(phone_number)
        if cached_customer:
            return Customer.model_validate(cached_customer)
        
        # Fetch from database
        customer = await Customer.find_one(Customer.phone_number == phone_number)
        
        # Cache the result
        if customer:
            await BusinessCache.set_customer(phone_number, customer.model_dump())
        
        return customer

    @staticmethod
    async def update_customer(
        phone_number: str, 
        update_data: CustomerUpdate, 
        updated_by: str,
        is_admin: bool = False
    ) -> Customer:
        """Update customer information with proper validation and audit trail"""
        from app.models.pawn_transaction_model import PawnTransaction, TransactionStatus
        from app.models.audit_entry_model import AuditActionType, create_audit_entry
        from beanie.operators import In
        
        try:
            # Retrieve customer
            customer = await Customer.find_one(Customer.phone_number == phone_number)
            if not customer:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Customer not found"
                )
            
            # Get update data excluding unset fields
            update_dict = update_data.model_dump(exclude_unset=True)
            
            # Handle admin-only fields based on permissions
            admin_only_fields = ["status", "credit_limit", "custom_loan_limit"]
            if not is_admin:
                for field in admin_only_fields:
                    if field in update_dict:
                        del update_dict[field]
            
            # Track audit entries for changes
            audit_entries = []
            
            # Validate credit limit changes
            if "credit_limit" in update_dict and is_admin:
                new_credit_limit = Decimal(str(update_dict["credit_limit"]))
                
                # Calculate current credit usage
                slot_using_statuses = [
                    TransactionStatus.ACTIVE,
                    TransactionStatus.EXTENDED,
                    TransactionStatus.HOLD,
                    TransactionStatus.OVERDUE,
                    TransactionStatus.DAMAGED
                ]
                
                active_transactions = await PawnTransaction.find(
                    PawnTransaction.customer_id == phone_number,
                    In(PawnTransaction.status, slot_using_statuses)
                ).to_list()
                
                credit_used = sum(transaction.loan_amount for transaction in active_transactions)
                
                # Validate new credit limit
                if new_credit_limit < credit_used:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Cannot set credit limit below current usage (${credit_used:,.2f})"
                    )
                
                # Create audit entry for credit limit change
                audit_entries.append(create_audit_entry(
                    action_type=AuditActionType.CUSTOMER_UPDATED,
                    staff_member=updated_by,
                    action_summary="Credit limit updated",
                    details=f"Credit limit changed from ${customer.credit_limit} to ${new_credit_limit}",
                    previous_value=str(customer.credit_limit),
                    new_value=str(new_credit_limit),
                    related_id=phone_number
                ))
            
            # Validate slot limit changes
            if "custom_loan_limit" in update_dict and is_admin:
                new_slot_limit = update_dict["custom_loan_limit"]
                
                # Calculate current slot usage
                slot_using_statuses = [
                    TransactionStatus.ACTIVE,
                    TransactionStatus.EXTENDED,
                    TransactionStatus.HOLD,
                    TransactionStatus.OVERDUE,
                    TransactionStatus.DAMAGED
                ]
                
                active_transactions = await PawnTransaction.find(
                    PawnTransaction.customer_id == phone_number,
                    In(PawnTransaction.status, slot_using_statuses)
                ).to_list()
                
                slots_used = len(active_transactions)
                
                # Validate new slot limit
                if new_slot_limit < slots_used:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Cannot set slot limit below current usage ({slots_used} slots)"
                    )
                
                # Create audit entry for slot limit change
                old_limit = customer.custom_loan_limit or "system default"
                audit_entries.append(create_audit_entry(
                    action_type=AuditActionType.CUSTOMER_UPDATED,
                    staff_member=updated_by,
                    action_summary="Loan slot limit updated",
                    details=f"Slot limit changed from {old_limit} to {new_slot_limit}",
                    previous_value=str(old_limit),
                    new_value=str(new_slot_limit),
                    related_id=phone_number
                ))
                
            # Track if any fields are actually being updated
            if not update_dict:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No fields to update"
                )
            
            # Update fields using Beanie's update method
            update_dict["updated_by"] = updated_by
            update_dict["updated_at"] = datetime.utcnow()
            
            # Use Beanie's update method
            await customer.update({"$set": update_dict})
            
            # Store audit entries if any
            if audit_entries:
                for audit in audit_entries:
                    CustomerService.logger.info(f"Customer update audit: {audit.to_legacy_string()}")
            
            # Immediate cache invalidation and refresh for real-time updates
            await BusinessCache.invalidate_customer(phone_number)
            
            # Reload the customer from database to get updated data
            updated_customer = await Customer.find_one(Customer.phone_number == phone_number)
            
            # Proactively update cache with fresh data for faster subsequent requests
            if updated_customer:
                await BusinessCache.set_customer(phone_number, updated_customer.model_dump())
            
            return updated_customer
            
        except HTTPException:
            # Re-raise HTTP exceptions
            raise
        except Exception as e:
            # Handle unexpected errors
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update customer"
            )

    @staticmethod
    async def get_customers_list(
        status: Optional[CustomerStatus] = None,
        search: Optional[str] = None,
        page: int = 1,
        per_page: int = 10,
        sort_by: str = "created_at",
        sort_order: str = "desc"
    ) -> CustomerListResponse:
        """Get paginated list of customers with efficient database-level filtering"""
        try:
            # Build filters
            filters = {}
            
            # Apply status filter if provided
            if status:
                filters["status"] = status.value
            
            # Apply search filter with improved logic
            if search:
                search = search.strip()
                if not search:
                    # Empty search after stripping, skip search filter
                    pass
                elif search.isdigit() and len(search) >= 10:
                    # Phone number search (exact match)
                    filters["phone_number"] = search
                elif search.isdigit() and len(search) < 10:
                    # Partial phone number search
                    filters["phone_number"] = {"$regex": f".*{search}.*"}
                elif "@" in search:
                    # Email search
                    filters["email"] = {"$regex": search, "$options": "i"}
                elif len(search) == 3 and search.isalpha():
                    # Advanced search: first 3 letters of first or last name
                    regex_pattern = f"^{search}"
                    filters["$or"] = [
                        {"first_name": {"$regex": regex_pattern, "$options": "i"}},
                        {"last_name": {"$regex": regex_pattern, "$options": "i"}}
                    ]
                elif " " in search:
                    # Full name search (first + last)
                    name_parts = search.split()
                    if len(name_parts) == 2:
                        first_name, last_name = name_parts
                        filters["$and"] = [
                            {"first_name": {"$regex": first_name, "$options": "i"}},
                            {"last_name": {"$regex": last_name, "$options": "i"}}
                        ]
                    else:
                        # Multiple words, try text search or fallback to general search
                        try:
                            filters["$text"] = {"$search": search}
                        except:
                            # Text index not available, use general regex search
                            regex_pattern = f".*{search}.*"
                            filters["$or"] = [
                                {"first_name": {"$regex": regex_pattern, "$options": "i"}},
                                {"last_name": {"$regex": regex_pattern, "$options": "i"}}
                            ]
                else:
                    # Single word search - check first name, last name, or use text search
                    try:
                        filters["$text"] = {"$search": search}
                    except:
                        # Text index not available, use general regex search
                        regex_pattern = f".*{search}.*"
                        filters["$or"] = [
                            {"first_name": {"$regex": regex_pattern, "$options": "i"}},
                            {"last_name": {"$regex": regex_pattern, "$options": "i"}}
                        ]
            
            # Create query
            if filters:
                query = Customer.find(filters)
            else:
                query = Customer.find()
            
            # Get total count before pagination
            total = await query.count()
            
            # Apply sorting
            sort_direction = DESCENDING if sort_order == "desc" else ASCENDING
            query = query.sort([(sort_by, sort_direction)])
            
            # Apply pagination with optimized projection
            skip = (page - 1) * per_page
            customers = await query.skip(skip).limit(per_page).to_list()
            
            # Prefetch related data in batches if needed
            # This could include transaction counts or payment history
            
            # Calculate pages
            pages = ceil(total / per_page) if total > 0 else 1
            
            # Convert to response format with computed properties
            customer_responses = []
            for customer in customers:
                customer_dict = customer.model_dump()
                # Add computed properties
                customer_dict["can_borrow_amount"] = customer.can_borrow_amount
                customer_responses.append(CustomerResponse.model_validate(customer_dict))
            
            return CustomerListResponse(
                customers=customer_responses,
                total=total,
                page=page,
                per_page=per_page,
                pages=pages
            )
            
        except Exception as e:
            # Fallback to regex search if text search fails
            if search and ("text index" in str(e) or "$text" in str(e)):
                # Rebuild filters for regex fallback
                filters = {}
                if status:
                    filters["status"] = status.value
                    
                # Apply the same improved search logic but with regex fallback
                if search:
                    search = search.strip()
                    if search.isdigit() and len(search) >= 10:
                        # Phone number search
                        filters["phone_number"] = search
                    elif search.isdigit() and len(search) < 10:
                        # Partial phone number search
                        filters["phone_number"] = {"$regex": f".*{search}.*"}
                    elif "@" in search:
                        # Email search
                        filters["email"] = {"$regex": search, "$options": "i"}
                    elif len(search) == 3 and search.isalpha():
                        # Advanced search: first 3 letters of first or last name
                        regex_pattern = f"^{search}"
                        filters["$or"] = [
                            {"first_name": {"$regex": regex_pattern, "$options": "i"}},
                            {"last_name": {"$regex": regex_pattern, "$options": "i"}}
                        ]
                    elif " " in search:
                        # Full name search
                        name_parts = search.split()
                        if len(name_parts) == 2:
                            first_name, last_name = name_parts
                            filters["$and"] = [
                                {"first_name": {"$regex": first_name, "$options": "i"}},
                                {"last_name": {"$regex": last_name, "$options": "i"}}
                            ]
                        else:
                            # General regex search for multiple words
                            regex_pattern = f".*{search}.*"
                            filters["$or"] = [
                                {"first_name": {"$regex": regex_pattern, "$options": "i"}},
                                {"last_name": {"$regex": regex_pattern, "$options": "i"}},
                                {"phone_number": {"$regex": regex_pattern}}
                            ]
                    else:
                        # Single word - general search
                        regex_pattern = f".*{search}.*"
                        filters["$or"] = [
                            {"first_name": {"$regex": regex_pattern, "$options": "i"}},
                            {"last_name": {"$regex": regex_pattern, "$options": "i"}},
                            {"phone_number": {"$regex": regex_pattern}}
                        ]
                
                query = Customer.find(filters) if filters else Customer.find()
                
                # Continue with same pagination logic
                total = await query.count()
                sort_direction = DESCENDING if sort_order == "desc" else ASCENDING
                query = query.sort([(sort_by, sort_direction)])
                skip = (page - 1) * per_page
                customers = await query.skip(skip).limit(per_page).to_list()
                pages = ceil(total / per_page) if total > 0 else 1
                
                customer_responses = []
                for customer in customers:
                    customer_dict = customer.model_dump()
                    # Add computed properties
                    customer_dict["can_borrow_amount"] = customer.can_borrow_amount
                    customer_responses.append(CustomerResponse.model_validate(customer_dict))
                
                return CustomerListResponse(
                    customers=customer_responses,
                    total=total,
                    page=page,
                    per_page=per_page,
                    pages=pages
                )
            else:
                raise

    @staticmethod
    async def check_loan_limit(phone_number: str) -> bool:
        """
        Check if customer can take additional loan (configurable max active loans)
        
        Args:
            phone_number: Customer's phone number
            
        Returns:
            True if customer can take another loan, False otherwise
            
        Raises:
            HTTPException: If customer not found
        """
        customer = await Customer.find_one(Customer.phone_number == phone_number)
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found"
            )
        
        # Check if customer has reached the maximum loan limit
        # Priority: Customer custom limit > System config > Settings default
        max_loans = customer.custom_loan_limit
        if max_loans is None:
            # No custom limit, use system config
            max_loans = await LoanConfig.get_max_active_loans()
            if max_loans == 8:  # If no database config, use settings
                max_loans = settings.MAX_ACTIVE_LOANS
        
        return customer.active_loans < max_loans

    @staticmethod
    async def validate_loan_eligibility(phone_number: str, loan_amount: float = None) -> dict:
        """
        Comprehensive loan eligibility check with accurate slot and credit calculations
        
        Args:
            phone_number: Customer's phone number
            loan_amount: Optional loan amount to validate against available credit
            
        Returns:
            Dict with eligibility status and details
        """
        from app.models.pawn_transaction_model import PawnTransaction, TransactionStatus
        
        customer = await Customer.find_one(Customer.phone_number == phone_number)
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found"
            )
        
        # Get effective loan limit for this customer
        # Priority: Customer custom limit > System config > Settings default
        max_loans = customer.custom_loan_limit
        if max_loans is None:
            # No custom limit, use system config
            max_loans = await LoanConfig.get_max_active_loans()
            if max_loans == 8:  # If no database config, use settings
                max_loans = settings.MAX_ACTIVE_LOANS
        
        # Define statuses that USE slots and credit
        slot_using_statuses = [
            TransactionStatus.ACTIVE,
            TransactionStatus.EXTENDED, 
            TransactionStatus.HOLD,
            TransactionStatus.OVERDUE,
            TransactionStatus.DAMAGED
        ]
        
        # Get transactions that are using slots
        from beanie.operators import In
        active_transactions = await PawnTransaction.find(
            PawnTransaction.customer_id == phone_number,
            In(PawnTransaction.status, slot_using_statuses)
        ).to_list()
        
        # Calculate actual slots used and credit used
        slots_used = len(active_transactions)
        credit_used = sum(transaction.loan_amount for transaction in active_transactions)
        
        # Calculate available amounts
        slots_available = max_loans - slots_used
        credit_available = float(customer.credit_limit) - credit_used
        
        # Build eligibility response
        eligibility = {
            "eligible": True,
            "reasons": [],
            # Slot information
            "active_loans": slots_used,  # Actual count from transactions
            "max_loans": max_loans,
            "slots_used": slots_used,
            "slots_available": slots_available,
            # Credit information  
            "credit_limit": float(customer.credit_limit),
            "credit_used": credit_used,
            "available_credit": credit_available,
            # Backward compatibility
            "max_loan_amount": float(customer.credit_limit)
        }
        
        # Check account status
        if not customer.can_transact:
            eligibility["eligible"] = False
            eligibility["reasons"].append(f"Account status is {customer.status.value}")
        
        # Check slot availability
        if slots_available <= 0:
            eligibility["eligible"] = False
            eligibility["reasons"].append(f"Maximum active loan limit reached ({max_loans})")
        
        # Check credit availability
        if credit_available <= 0:
            eligibility["eligible"] = False
            eligibility["reasons"].append("No available credit remaining")
        
        # Check specific loan amount if provided
        if loan_amount is not None:
            if loan_amount > credit_available:
                eligibility["eligible"] = False
                if credit_available <= 0:
                    eligibility["reasons"].append("No available credit remaining")
                else:
                    eligibility["reasons"].append(f"Loan amount ${loan_amount:,.2f} exceeds available credit of ${credit_available:,.2f}")
        
        return eligibility
    
    @staticmethod
    async def get_loan_limit_config() -> LoanLimitResponse:
        """Get current loan limit configuration"""
        config = await LoanConfig.get_current_config()
        
        if not config:
            # Return default configuration
            return LoanLimitResponse(
                current_limit=settings.MAX_ACTIVE_LOANS,
                updated_at=datetime.utcnow().isoformat(),
                updated_by="system",
                reason="Default configuration"
            )
        
        return LoanLimitResponse(
            current_limit=config.max_active_loans,
            updated_at=config.updated_at.isoformat(),
            updated_by=config.updated_by,
            reason=config.reason
        )
    
    @staticmethod
    async def update_loan_limit_config(
        request: LoanLimitUpdateRequest,
        admin_user_id: str
    ) -> LoanLimitResponse:
        """Update loan limit configuration (admin only)"""
        
        # Create new configuration
        new_config = LoanConfig(
            max_active_loans=request.max_active_loans,
            updated_by=admin_user_id,
            reason=request.reason,
            is_active=True
        )
        
        # Set as active (deactivates others)
        await new_config.set_as_active()
        
        return LoanLimitResponse(
            current_limit=new_config.max_active_loans,
            updated_at=new_config.updated_at.isoformat(),
            updated_by=new_config.updated_by,
            reason=new_config.reason
        )

    @staticmethod
    async def get_customer_statistics() -> CustomerStatsResponse:
        """Get comprehensive customer statistics for admin dashboard with customer-focused metrics"""
        try:
            # Use simpler direct counting instead of aggregation
            total_customers = await Customer.count()
            active_customers = await Customer.find(Customer.status == "active").count()
            suspended_customers = await Customer.find(Customer.status == "suspended").count()
            archived_customers = await Customer.find(Customer.status == "archived").count()
            
            # Calculate date boundaries for date-based counts
            now = datetime.utcnow()
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            thirty_days_ago = datetime.fromtimestamp(now.timestamp() - (30 * 24 * 60 * 60))
            
            customers_created_today = await Customer.find(Customer.created_at >= today_start).count()
            new_this_month = await Customer.find(Customer.created_at >= thirty_days_ago).count()
            
            # Get unique customer alert count from ServiceAlertService
            from app.services.service_alert_service import ServiceAlertService
            try:
                alert_stats = await ServiceAlertService.get_unique_customer_alert_count()
                service_alerts = alert_stats.get("unique_customer_count", 0)
            except Exception as e:
                service_alerts = 0
            
            return CustomerStatsResponse(
                total_customers=total_customers,
                active_customers=active_customers,
                suspended_customers=suspended_customers,
                archived_customers=archived_customers,
                customers_created_today=customers_created_today,
                avg_transactions_per_customer=0.0,
                new_this_month=new_this_month,
                service_alerts=service_alerts,
                needs_follow_up=0,
                eligible_for_increase=0
            )
        
        except Exception as e:
            # Get unique customer alert count even in error case
            from app.services.service_alert_service import ServiceAlertService
            try:
                alert_stats = await ServiceAlertService.get_unique_customer_alert_count()
                service_alerts = alert_stats.get("unique_customer_count", 0)
            except:
                service_alerts = 0
            
            return CustomerStatsResponse(
                total_customers=0,
                active_customers=0,
                suspended_customers=0,
                archived_customers=0,
                customers_created_today=0,
                avg_transactions_per_customer=0.0,
                new_this_month=0,
                service_alerts=service_alerts,
                needs_follow_up=0,
                eligible_for_increase=0
            )


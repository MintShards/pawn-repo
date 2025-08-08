
"""
Customer service layer for business logic and data operations.

This module implements all customer-related business operations including
CRUD operations, search functionality, statistics, and status management.
"""

from datetime import datetime
from typing import Optional
from math import ceil

from fastapi import HTTPException, status
from pymongo import ASCENDING, DESCENDING

from app.models.customer_model import Customer, CustomerStatus
from app.schemas.customer_schema import (
    CustomerCreate, CustomerUpdate, CustomerResponse, CustomerListResponse,
    CustomerStatsResponse
)


class CustomerService:
    """Service class for customer business logic"""

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
        """Get customer by phone number"""
        return await Customer.find_one(Customer.phone_number == phone_number)

    @staticmethod
    async def update_customer(
        phone_number: str, 
        update_data: CustomerUpdate, 
        updated_by: str,
        is_admin: bool = False
    ) -> Customer:
        """Update customer information with proper error handling"""
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
            admin_only_fields = ["status", "credit_limit", "payment_history_score", "default_count"]
            if not is_admin:
                for field in admin_only_fields:
                    if field in update_dict:
                        del update_dict[field]
                
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
            
            # Reload the customer from database to get updated data
            updated_customer = await Customer.find_one(Customer.phone_number == phone_number)
            
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
            
            # Apply search filter using text search or advanced name search
            if search:
                # Check if search is exactly 3 characters for advanced name search
                if len(search) == 3 and search.isalpha():
                    # Advanced search: first 3 letters of first or last name
                    regex_pattern = f"^{search}"
                    filters["$or"] = [
                        {"first_name": {"$regex": regex_pattern, "$options": "i"}},
                        {"last_name": {"$regex": regex_pattern, "$options": "i"}}
                    ]
                else:
                    # Use MongoDB text search for general searching
                    filters["$text"] = {"$search": search}
            
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
            
            # Apply pagination
            skip = (page - 1) * per_page
            customers = await query.skip(skip).limit(per_page).to_list()
            
            # Calculate pages
            pages = ceil(total / per_page) if total > 0 else 1
            
            # Convert to response format with computed properties
            customer_responses = []
            for customer in customers:
                customer_dict = customer.model_dump()
                # Add computed properties
                customer_dict["risk_level"] = customer.risk_level
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
            # Fallback to simple search if text search fails
            if search and "text index" in str(e):
                # Use regex search as fallback
                filters = {}
                if status:
                    filters["status"] = status.value
                    
                # Build regex query for search
                if search:
                    if len(search) == 3 and search.isalpha():
                        # Advanced search: first 3 letters of first or last name
                        regex_pattern = f"^{search}"
                        filters["$or"] = [
                            {"first_name": {"$regex": regex_pattern, "$options": "i"}},
                            {"last_name": {"$regex": regex_pattern, "$options": "i"}}
                        ]
                    else:
                        # General search across all fields
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
                    customer_dict["risk_level"] = customer.risk_level
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
        Check if customer can take additional loan (max 5 active loans)
        
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
        
        # Check if customer has reached the maximum loan limit (5)
        return customer.active_loans < 5

    @staticmethod
    async def validate_loan_eligibility(phone_number: str, loan_amount: float = None) -> dict:
        """
        Comprehensive loan eligibility check
        
        Args:
            phone_number: Customer's phone number
            loan_amount: Optional loan amount to validate against credit limit
            
        Returns:
            Dict with eligibility status and details
        """
        customer = await Customer.find_one(Customer.phone_number == phone_number)
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found"
            )
        
        eligibility = {
            "eligible": True,
            "reasons": [],
            "active_loans": customer.active_loans,
            "max_loans": 5,
            "credit_limit": float(customer.credit_limit),
            "available_credit": float(customer.can_borrow_amount),
            "risk_level": customer.risk_level
        }
        
        # Check account status
        if not customer.can_transact:
            eligibility["eligible"] = False
            eligibility["reasons"].append(f"Account status is {customer.status.value}")
        
        # Check loan count limit
        if customer.active_loans >= 5:
            eligibility["eligible"] = False
            eligibility["reasons"].append("Maximum active loan limit reached (5)")
        
        # Check loan amount against credit limit
        if loan_amount is not None:
            if loan_amount > float(customer.credit_limit):
                eligibility["eligible"] = False
                eligibility["reasons"].append(f"Loan amount exceeds credit limit of ${customer.credit_limit}")
        
        # Check risk level for high-risk customers
        if customer.risk_level == "high":
            eligibility["reasons"].append("High risk customer - requires additional approval")
        
        return eligibility

    @staticmethod
    async def get_customer_statistics() -> CustomerStatsResponse:
        """Get customer statistics for admin dashboard"""
        total_customers = await Customer.count()
        active_customers = await Customer.find(
            Customer.status == CustomerStatus.ACTIVE
        ).count()
        suspended_customers = await Customer.find(
            Customer.status == CustomerStatus.SUSPENDED
        ).count()
        banned_customers = await Customer.find(
            Customer.status == CustomerStatus.BANNED
        ).count()
        
        # Get customers created today
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        customers_created_today = await Customer.find(
            Customer.created_at >= today_start
        ).count()
        
        # Calculate average transactions per customer
        pipeline = [
            {"$group": {
                "_id": None,
                "avg_transactions": {"$avg": "$total_transactions"}
            }}
        ]
        avg_result = await Customer.aggregate(pipeline).to_list()
        avg_transactions = avg_result[0]["avg_transactions"] if avg_result else 0.0
        
        return CustomerStatsResponse(
            total_customers=total_customers,
            active_customers=active_customers,
            suspended_customers=suspended_customers,
            banned_customers=banned_customers,
            customers_created_today=customers_created_today,
            avg_transactions_per_customer=round(avg_transactions, 2)
        )
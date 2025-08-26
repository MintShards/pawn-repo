
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
            admin_only_fields = ["status", "credit_limit"]
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
            "max_loan_amount": float(customer.credit_limit),  # For backward compatibility
            "available_credit": float(customer.can_borrow_amount)
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
        
        
        return eligibility

    @staticmethod
    async def get_customer_statistics() -> CustomerStatsResponse:
        """Get comprehensive customer statistics for admin dashboard with customer-focused metrics"""
        try:
            # Calculate date boundaries
            now = datetime.utcnow()
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            thirty_days_ago = datetime.fromtimestamp(now.timestamp() - (30 * 24 * 60 * 60))
            
            # Use MongoDB aggregation pipeline for efficient calculation
            pipeline = [
                {
                    "$facet": {
                        # Basic counts
                        "status_counts": [
                        {
                            "$group": {
                                "_id": "$status",
                                "count": {"$sum": 1}
                            }
                        }
                    ],
                    
                    # Today's customers
                    "today_customers": [
                        {
                            "$match": {"created_at": {"$gte": today_start}}
                        },
                        {
                            "$count": "count"
                        }
                    ],
                    
                    # New customers this month (last 30 days)
                    "new_this_month": [
                        {
                            "$match": {"created_at": {"$gte": thirty_days_ago}}
                        },
                        {
                            "$count": "count"
                        }
                    ],
                    
                    # Service alerts (customers requiring service attention)
                    "service_alerts": [
                        {
                            "$match": {
                                "$or": [
                                    {"status": "suspended"},
                                    {"notes": {"$regex": "alert|issue|problem|overdue", "$options": "i"}}
                                ]
                            }
                        },
                        {
                            "$count": "count"
                        }
                    ],
                    
                    # Needs follow-up (flagged notes)
                    "needs_follow_up": [
                        {
                            "$match": {
                                "status": "active",
                                "notes": {"$regex": "follow|contact|call", "$options": "i"}
                            }
                        },
                        {
                            "$count": "count"
                        }
                    ],
                    
                    # Eligible for credit increase (active + available credit)
                    "eligible_for_increase": [
                        {
                            "$match": {
                                "status": "active",
                                "can_borrow_amount": {"$gt": 0}
                            }
                        },
                        {
                            "$count": "count"
                        }
                    ],
                    
                    # Average transactions
                    "avg_transactions": [
                        {
                            "$group": {
                                "_id": None,
                                "avg": {"$avg": "$total_transactions"}
                            }
                        }
                    ]
                }
            }
            ]
            
            # Execute aggregation
            result = await Customer.aggregate(pipeline).to_list()
            data = result[0] if result else {}
            
            # Process status counts
            status_counts = {item["_id"]: item["count"] for item in data.get("status_counts", [])}
            
            # Extract metrics with safe defaults - FIXED: Handle empty arrays
            total_customers = sum(status_counts.values())
            active_customers = status_counts.get("active", 0)
            suspended_customers = status_counts.get("suspended", 0) 
            archived_customers = status_counts.get("archived", 0)
            
            # Safe array access - handle empty arrays from aggregation
            def safe_get_count(data_key):
                """Safely get count from aggregation result that might be empty"""
                result_array = data.get(data_key, [])
                return result_array[0].get("count", 0) if result_array else 0
            
            customers_created_today = safe_get_count("today_customers")
            new_this_month = safe_get_count("new_this_month") 
            service_alerts = safe_get_count("service_alerts")
            needs_follow_up = safe_get_count("needs_follow_up")
            eligible_for_increase = safe_get_count("eligible_for_increase")
            
            # Safe access for average transactions
            avg_transactions_array = data.get("avg_transactions", [])
            avg_transactions = avg_transactions_array[0].get("avg", 0.0) if avg_transactions_array else 0.0
            avg_transactions = avg_transactions or 0.0  # Handle None values
            
            return CustomerStatsResponse(
                total_customers=total_customers,
                active_customers=active_customers,
                suspended_customers=suspended_customers,
                archived_customers=archived_customers,
                customers_created_today=customers_created_today,
                avg_transactions_per_customer=round(avg_transactions, 2),
                new_this_month=new_this_month,
                service_alerts=service_alerts,
                needs_follow_up=needs_follow_up,
                eligible_for_increase=eligible_for_increase
            )
            
        except Exception as e:
            # Log error and return safe defaults if aggregation fails
            # Return safe fallback with zero counts
            return CustomerStatsResponse(
                total_customers=0,
                active_customers=0,
                suspended_customers=0,
                archived_customers=0,
                customers_created_today=0,
                avg_transactions_per_customer=0.0,
                new_this_month=0,
                service_alerts=0,
                needs_follow_up=0,
                eligible_for_increase=0
            )
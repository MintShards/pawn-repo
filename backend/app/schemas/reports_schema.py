"""
Reports API Schemas

Pydantic schemas for reports API request/response validation.
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


# ========== COLLECTIONS ANALYTICS SCHEMAS ==========

class CollectionsSummary(BaseModel):
    """Summary metrics for collections analytics"""
    total_overdue: int = Field(..., description="Total overdue amount in dollars")
    total_overdue_trend: float = Field(..., description="Percentage change vs previous period")
    count: int = Field(..., description="Number of overdue transactions")
    count_trend: int = Field(..., description="Change in count vs previous period")
    avg_days_overdue: float = Field(..., description="Average days overdue")
    avg_days_trend: float = Field(..., description="Change in average days vs previous period")


class AgingBucket(BaseModel):
    """Aging bucket for overdue transactions"""
    range: str = Field(..., description="Age range (e.g., '1-7 days')")
    count: int = Field(..., description="Number of transactions in this range")
    amount: int = Field(..., description="Total amount in this range")
    percentage: float = Field(..., description="Percentage of total overdue")
    trend: int = Field(..., description="Change vs previous period")


class HistoricalDataPoint(BaseModel):
    """Historical trend data point"""
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    amount: int = Field(..., description="Total overdue amount on this date")


class CollectionsAnalyticsResponse(BaseModel):
    """Complete collections analytics response"""
    summary: CollectionsSummary
    aging_buckets: List[AgingBucket]
    historical: List[HistoricalDataPoint]


# ========== TOP CUSTOMERS SCHEMAS ==========

class CustomerRankData(BaseModel):
    """Individual customer ranking data"""
    rank: int = Field(..., description="Customer rank (1-based)")
    phone_number: str = Field(..., description="Customer phone number")
    name: str = Field(..., description="Customer name (formatted as 'J. Alvarez')")
    active_loans: int = Field(..., description="Number of active loans")
    total_loan_value: int = Field(..., description="Total value of active loans")
    total_transactions: int = Field(..., description="Lifetime transaction count")


class CustomerSummary(BaseModel):
    """Summary metrics for customer analytics"""
    total_customers: int = Field(..., description="Total active customers with loans")
    avg_active_loans: float = Field(..., description="Average active loans per customer")
    avg_loan_value: int = Field(..., description="Average loan value")
    total_active_value: int = Field(..., description="Total value of all active loans")


class TopCustomersResponse(BaseModel):
    """Response for top customers by active loans"""
    customers: List[CustomerRankData]
    summary: CustomerSummary


class StaffRankData(BaseModel):
    """Individual staff performance data"""
    rank: int = Field(..., description="Staff rank (1-based)")
    user_id: str = Field(..., description="User ID")
    name: str = Field(..., description="Staff name (formatted as 'Sarah J.')")
    transaction_count: int = Field(..., description="Number of transactions created")
    total_value: int = Field(..., description="Total loan value created")


class TopStaffResponse(BaseModel):
    """Response for top staff by transaction count"""
    staff: List[StaffRankData]


# ========== INVENTORY SNAPSHOT SCHEMAS ==========

class InventorySummary(BaseModel):
    """Summary metrics for inventory snapshot"""
    total_items: int = Field(..., description="Total number of items in storage")
    total_loan_value: int = Field(..., description="Total value of all loans")
    avg_storage_days: int = Field(..., description="Average days items have been in storage")


class StatusBreakdown(BaseModel):
    """Breakdown by loan status"""
    status: str = Field(..., description="Loan status (Active, Overdue, Extended, Forfeited)")
    item_count: int = Field(..., description="Number of items with this status")
    loan_value: int = Field(..., description="Total loan value for this status")
    percentage: float = Field(..., description="Percentage of total items")
    avg_days_in_storage: int = Field(..., description="Average days in storage for this status")


class AgeBreakdown(BaseModel):
    """Breakdown by storage age"""
    age_range: str = Field(..., description="Age range (e.g., '0-30 days')")
    item_count: int = Field(..., description="Number of items in this age range")
    loan_value: int = Field(..., description="Total loan value for this age range")
    percentage: float = Field(..., description="Percentage of total value")
    alert: Optional[bool] = Field(None, description="Alert flag for aged items (90+)")


class HighestValueItem(BaseModel):
    """Highest value item details"""
    amount: int = Field(..., description="Loan amount")
    description: str = Field(..., description="Item description")
    days_in_storage: int = Field(..., description="Days in storage")


class HighValueAlert(BaseModel):
    """High-value items alert"""
    count: int = Field(..., description="Number of high-value transactions (>$5,000)")
    total_value: int = Field(..., description="Total value of high-value transactions")
    highest: Optional[HighestValueItem] = Field(None, description="Highest value transaction details")


class InventorySnapshotResponse(BaseModel):
    """Complete inventory snapshot response"""
    summary: InventorySummary
    by_status: List[StatusBreakdown]
    by_age: List[AgeBreakdown]
    high_value_alert: HighValueAlert

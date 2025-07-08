from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.models.item_model import ItemStatus

class ItemBase(BaseModel):
    description: str = Field(..., min_length=1, max_length=500, description="What is this item?")
    loan_amount: float = Field(..., gt=0, description="Amount loaned for this item")
    notes: Optional[str] = Field(None, max_length=1000, description="Notes about the item")

class ItemCreate(ItemBase):
    customer_id: UUID = Field(..., description="Customer who owns this item")

class ItemUpdate(BaseModel):
    description: Optional[str] = Field(None, min_length=1, max_length=500)
    loan_amount: Optional[float] = Field(None, gt=0)
    status: Optional[ItemStatus] = None
    notes: Optional[str] = Field(None, max_length=1000)

class ItemOut(ItemBase):
    item_id: UUID
    status: ItemStatus
    customer_id: UUID
    display_description: str
    created_at: datetime
    updated_at: datetime
    created_by: UUID

    class Config:
        from_attributes = True

class ItemSearch(BaseModel):
    description: Optional[str] = None
    status: Optional[ItemStatus] = None
    customer_id: Optional[UUID] = None

# For customer receipts
class ItemReceipt(BaseModel):
    description: str
    loan_amount: float
    
    class Config:
        from_attributes = True
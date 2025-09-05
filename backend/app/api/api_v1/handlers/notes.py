"""
Notes API handlers for the new separate notes architecture.

This module provides endpoints for managing manual staff notes and system audit logs
separately, preventing truncation issues with the legacy internal_notes field.
"""

# Standard library imports
from typing import Optional, List, Dict, Any
from datetime import datetime, UTC

# Third-party imports
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
import structlog

# Local imports
from app.api.deps.user_deps import get_current_user, get_staff_or_admin_user
from app.api.deps.timezone_deps import get_client_timezone
from app.models.user_model import User
from app.models.pawn_transaction_model import PawnTransaction
from app.models.audit_entry_model import AuditActionType
from app.services.notes_service import NotesService, notes_service
from app.core.exceptions import ValidationError, TransactionNotFoundError

# Configure logger
notes_logger = structlog.get_logger("notes_api")

# Create router
notes_router = APIRouter()


# Pydantic schemas for API requests/responses
from pydantic import BaseModel, Field


class ManualNoteRequest(BaseModel):
    """Request model for adding manual notes."""
    note: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="Manual note text"
    )


class SystemAuditRequest(BaseModel):
    """Request model for adding system audit entries."""
    action_type: AuditActionType = Field(
        ...,
        description="Type of audit action"
    )
    action_summary: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Brief summary of the action"
    )
    details: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Additional details"
    )
    amount: Optional[int] = Field(
        default=None,
        ge=0,
        description="Monetary amount"
    )
    previous_value: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Previous value for updates"
    )
    new_value: Optional[str] = Field(
        default=None,
        max_length=500,
        description="New value for updates"
    )
    related_id: Optional[str] = Field(
        default=None,
        description="Related record ID"
    )


class NotesDisplayResponse(BaseModel):
    """Response model for notes display data."""
    transaction_id: str
    manual_notes: str
    system_audit_summary: List[str]
    audit_entry_count: int
    legacy_notes: Optional[str]
    combined_display: str


class ManualNoteResponse(BaseModel):
    """Response model for manual note operations."""
    transaction_id: str
    note_added: str
    total_manual_notes_length: int
    timestamp: datetime


class SystemAuditResponse(BaseModel):
    """Response model for system audit operations."""
    transaction_id: str
    audit_entry: Dict[str, Any]
    audit_entry_count: int
    timestamp: datetime


class MigrationStatusResponse(BaseModel):
    """Response model for migration status."""
    transaction_id: str
    is_migrated: bool
    has_legacy_notes: bool
    has_manual_notes: bool
    has_system_audit: bool
    audit_count: int
    migration_needed: bool


@notes_router.get(
    "/transaction/{transaction_id}/display",
    response_model=NotesDisplayResponse,
    summary="Get notes display data",
    description="Get structured notes data for UI display with manual notes and system audit separated"
)
async def get_notes_display(
    transaction_id: str = Path(..., description="Transaction ID"),
    current_user: User = Depends(get_staff_or_admin_user)
) -> NotesDisplayResponse:
    """Get structured notes data for display in the UI."""
    
    try:
        # Find transaction
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        
        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Transaction {transaction_id} not found"
            )
        
        # Get display data
        display_data = notes_service.get_notes_display_data(transaction)
        
        await notes_logger.ainfo(
            "Notes display data retrieved",
            transaction_id=transaction_id,
            user_id=current_user.user_id,
            audit_count=display_data['audit_entry_count']
        )
        
        return NotesDisplayResponse(
            transaction_id=transaction_id,
            manual_notes=display_data['manual_notes'],
            system_audit_summary=display_data['system_audit_summary'],
            audit_entry_count=display_data['audit_entry_count'],
            legacy_notes=display_data['legacy_notes'],
            combined_display=display_data['combined_display']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        await notes_logger.aerror(
            "Failed to retrieve notes display data",
            transaction_id=transaction_id,
            user_id=current_user.user_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve notes display data"
        )


@notes_router.post(
    "/transaction/{transaction_id}/manual-note",
    response_model=ManualNoteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add manual note",
    description="Add a manual staff note to a transaction (preserved indefinitely, high character limit)"
)
async def add_manual_note(
    note_request: ManualNoteRequest,
    transaction_id: str = Path(..., description="Transaction ID"),
    current_user: User = Depends(get_staff_or_admin_user)
) -> ManualNoteResponse:
    """Add a manual staff note to a transaction."""
    
    try:
        # Find transaction
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        
        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Transaction {transaction_id} not found"
            )
        
        # Add manual note
        await notes_service.add_manual_note(
            transaction=transaction,
            note=note_request.note,
            staff_member=current_user.user_id,
            save_immediately=True
        )
        
        await notes_logger.ainfo(
            "Manual note added to transaction",
            transaction_id=transaction_id,
            user_id=current_user.user_id,
            note_length=len(note_request.note)
        )
        
        return ManualNoteResponse(
            transaction_id=transaction_id,
            note_added=note_request.note,
            total_manual_notes_length=len(transaction.manual_notes or ""),
            timestamp=datetime.now(UTC)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        await notes_logger.aerror(
            "Failed to add manual note",
            transaction_id=transaction_id,
            user_id=current_user.user_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add manual note"
        )


@notes_router.post(
    "/transaction/{transaction_id}/system-audit",
    response_model=SystemAuditResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add system audit entry",
    description="Add a system audit entry to track system events and operations"
)
async def add_system_audit(
    audit_request: SystemAuditRequest,
    transaction_id: str = Path(..., description="Transaction ID"),
    current_user: User = Depends(get_staff_or_admin_user)
) -> SystemAuditResponse:
    """Add a system audit entry to a transaction."""
    
    try:
        # Find transaction
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        
        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Transaction {transaction_id} not found"
            )
        
        # Add system audit entry
        audit_entry = await notes_service.add_system_audit(
            transaction=transaction,
            action_type=audit_request.action_type,
            staff_member=current_user.user_id,
            action_summary=audit_request.action_summary,
            details=audit_request.details,
            amount=audit_request.amount,
            previous_value=audit_request.previous_value,
            new_value=audit_request.new_value,
            related_id=audit_request.related_id,
            save_immediately=True
        )
        
        await notes_logger.ainfo(
            "System audit entry added to transaction",
            transaction_id=transaction_id,
            user_id=current_user.user_id,
            action_type=audit_request.action_type.value,
            amount=audit_request.amount
        )
        
        return SystemAuditResponse(
            transaction_id=transaction_id,
            audit_entry=audit_entry.dict(),
            audit_entry_count=transaction.count_audit_entries(),
            timestamp=audit_entry.timestamp
        )
        
    except HTTPException:
        raise
    except Exception as e:
        await notes_logger.aerror(
            "Failed to add system audit entry",
            transaction_id=transaction_id,
            user_id=current_user.user_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add system audit entry"
        )


@notes_router.get(
    "/transaction/{transaction_id}/manual-notes",
    response_model=str,
    summary="Get manual notes only",
    description="Get only the manual staff notes without system entries"
)
async def get_manual_notes_only(
    transaction_id: str = Path(..., description="Transaction ID"),
    current_user: User = Depends(get_staff_or_admin_user)
) -> str:
    """Get only the manual staff notes for a transaction."""
    
    try:
        # Find transaction
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        
        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Transaction {transaction_id} not found"
            )
        
        return transaction.get_manual_notes_only()
        
    except HTTPException:
        raise
    except Exception as e:
        await notes_logger.aerror(
            "Failed to retrieve manual notes",
            transaction_id=transaction_id,
            user_id=current_user.user_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve manual notes"
        )


@notes_router.get(
    "/transaction/{transaction_id}/audit-log",
    response_model=List[str],
    summary="Get system audit log",
    description="Get system audit log entries formatted as strings"
)
async def get_system_audit_log(
    transaction_id: str = Path(..., description="Transaction ID"),
    limit: int = Query(default=20, ge=1, le=100, description="Maximum entries to return"),
    current_user: User = Depends(get_staff_or_admin_user)
) -> List[str]:
    """Get system audit log entries for a transaction."""
    
    try:
        # Find transaction
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        
        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Transaction {transaction_id} not found"
            )
        
        return transaction.get_system_audit_summary(limit=limit)
        
    except HTTPException:
        raise
    except Exception as e:
        await notes_logger.aerror(
            "Failed to retrieve audit log",
            transaction_id=transaction_id,
            user_id=current_user.user_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve audit log"
        )


@notes_router.get(
    "/transaction/{transaction_id}/migration-status",
    response_model=MigrationStatusResponse,
    summary="Check migration status",
    description="Check if transaction notes have been migrated to new architecture"
)
async def check_migration_status(
    transaction_id: str = Path(..., description="Transaction ID"),
    current_user: User = Depends(get_staff_or_admin_user)
) -> MigrationStatusResponse:
    """Check migration status for a transaction."""
    
    try:
        # Find transaction
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        
        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Transaction {transaction_id} not found"
            )
        
        # Validate migration status
        validation_result = notes_service.validate_notes_migration(transaction)
        
        return MigrationStatusResponse(
            transaction_id=transaction_id,
            is_migrated=validation_result['is_migrated'],
            has_legacy_notes=validation_result['has_legacy_notes'],
            has_manual_notes=validation_result['has_manual_notes'],
            has_system_audit=validation_result['has_system_audit'],
            audit_count=validation_result['audit_count'],
            migration_needed=validation_result['migration_needed']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        await notes_logger.aerror(
            "Failed to check migration status",
            transaction_id=transaction_id,
            user_id=current_user.user_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check migration status"
        )


@notes_router.post(
    "/transaction/{transaction_id}/migrate",
    response_model=MigrationStatusResponse,
    summary="Migrate transaction notes",
    description="Migrate legacy internal_notes to new separate architecture"
)
async def migrate_transaction_notes(
    transaction_id: str = Path(..., description="Transaction ID"),
    current_user: User = Depends(get_staff_or_admin_user)
) -> MigrationStatusResponse:
    """Migrate a transaction's notes to the new architecture."""
    
    try:
        # Find transaction
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        
        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Transaction {transaction_id} not found"
            )
        
        # Perform migration
        success = await notes_service.migrate_transaction_notes(transaction)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to migrate transaction notes"
            )
        
        # Get updated validation status
        validation_result = notes_service.validate_notes_migration(transaction)
        
        await notes_logger.ainfo(
            "Transaction notes migrated successfully",
            transaction_id=transaction_id,
            user_id=current_user.user_id,
            audit_count=validation_result['audit_count']
        )
        
        return MigrationStatusResponse(
            transaction_id=transaction_id,
            is_migrated=validation_result['is_migrated'],
            has_legacy_notes=validation_result['has_legacy_notes'],
            has_manual_notes=validation_result['has_manual_notes'],
            has_system_audit=validation_result['has_system_audit'],
            audit_count=validation_result['audit_count'],
            migration_needed=validation_result['migration_needed']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        await notes_logger.aerror(
            "Failed to migrate transaction notes",
            transaction_id=transaction_id,
            user_id=current_user.user_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to migrate transaction notes"
        )


@notes_router.delete(
    "/transaction/{transaction_id}/clear",
    response_model=dict,
    summary="Clear all notes",
    description="Clear all manual notes for a transaction (admin only)"
)
async def clear_transaction_notes(
    transaction_id: str = Path(..., description="Transaction ID"),
    current_user: User = Depends(get_staff_or_admin_user)
) -> dict:
    """Clear all manual notes for a transaction."""
    
    try:
        # Find transaction
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        
        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Transaction {transaction_id} not found"
            )
        
        # Clear manual notes
        transaction.manual_notes = None
        transaction.internal_notes = None  # Also clear legacy notes
        transaction._update_legacy_internal_notes()  # Update legacy field
        await transaction.save()
        
        await notes_logger.ainfo(
            "Transaction notes cleared",
            transaction_id=transaction_id,
            user_id=current_user.user_id
        )
        
        return {"message": "Notes cleared successfully", "transaction_id": transaction_id}
        
    except HTTPException:
        raise
    except Exception as e:
        await notes_logger.aerror(
            "Failed to clear transaction notes",
            transaction_id=transaction_id,
            user_id=current_user.user_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to clear transaction notes"
        )
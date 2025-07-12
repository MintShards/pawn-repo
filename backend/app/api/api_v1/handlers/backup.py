"""
Backup Management API

Handles backup and restore operations for the pawnshop system.
"""
from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
from fastapi.responses import FileResponse
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

from app.services.backup_service import backup_service
from app.api.deps.user_deps import get_current_admin
from app.models.user_model import User

logger = logging.getLogger(__name__)
backup_router = APIRouter()


@backup_router.post("/create", summary="Create manual backup")
async def create_manual_backup(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_admin)
) -> Dict[str, Any]:
    """
    Create a manual backup of the entire database.
    Requires admin privileges.
    """
    try:
        logger.info(f"Manual backup initiated by user {current_user.user_id}")
        
        # Run backup in background
        background_tasks.add_task(
            backup_service.create_full_backup,
            "manual"
        )
        
        return {
            "message": "Backup process started",
            "initiated_by": f"{current_user.first_name} {current_user.last_name}",
            "initiated_at": datetime.utcnow().isoformat(),
            "status": "in_progress"
        }
        
    except Exception as e:
        logger.error(f"Failed to initiate manual backup: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start backup process"
        )


@backup_router.get("/list", summary="List available backups")
async def list_backups(
    current_user: User = Depends(get_current_admin)
) -> Dict[str, Any]:
    """
    Get list of all available backup files.
    Requires admin privileges.
    """
    try:
        backups = backup_service.get_backup_list()
        
        return {
            "backups": backups,
            "total_backups": len(backups),
            "retrieved_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to list backups: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve backup list"
        )


@backup_router.post("/verify/{backup_filename}", summary="Verify backup integrity")
async def verify_backup(
    backup_filename: str,
    current_user: User = Depends(get_current_admin)
) -> Dict[str, Any]:
    """
    Verify the integrity of a backup file.
    Requires admin privileges.
    """
    try:
        backup_path = backup_service.backup_dir / backup_filename
        
        if not backup_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Backup file not found"
            )
        
        verification_result = await backup_service.verify_backup_integrity(str(backup_path))
        
        return {
            "backup_filename": backup_filename,
            "verification_result": verification_result,
            "verified_at": datetime.utcnow().isoformat(),
            "verified_by": f"{current_user.first_name} {current_user.last_name}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to verify backup {backup_filename}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify backup file"
        )


@backup_router.get("/download/{backup_filename}", summary="Download backup file")
async def download_backup(
    backup_filename: str,
    current_user: User = Depends(get_current_admin)
):
    """
    Download a backup file.
    Requires admin privileges.
    """
    try:
        backup_path = backup_service.backup_dir / backup_filename
        
        if not backup_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Backup file not found"
            )
        
        logger.info(f"Backup download requested by user {current_user.user_id}: {backup_filename}")
        
        return FileResponse(
            path=str(backup_path),
            filename=backup_filename,
            media_type='application/gzip'
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to download backup {backup_filename}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to download backup file"
        )


@backup_router.post("/restore", summary="Restore from backup")
async def restore_from_backup(
    backup_filename: str,
    collections: Optional[List[str]] = None,
    confirm_restore: bool = False,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_admin)
) -> Dict[str, Any]:
    """
    Restore data from a backup file.
    
    WARNING: This operation will replace existing data!
    Requires admin privileges and explicit confirmation.
    
    Args:
        backup_filename: Name of backup file to restore from
        collections: List of collections to restore (None for all)
        confirm_restore: Must be True to proceed with restoration
    """
    try:
        if not confirm_restore:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Restoration requires explicit confirmation (confirm_restore=True)"
            )
        
        backup_path = backup_service.backup_dir / backup_filename
        
        if not backup_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Backup file not found"
            )
        
        logger.warning(f"Database restoration initiated by user {current_user.user_id} from {backup_filename}")
        
        # Verify backup before restoration
        verification_result = await backup_service.verify_backup_integrity(str(backup_path))
        if not verification_result.get("valid", False):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Backup verification failed: {verification_result.get('error', 'Unknown error')}"
            )
        
        # Run restoration in background
        background_tasks.add_task(
            backup_service.restore_from_backup,
            str(backup_path),
            collections
        )
        
        return {
            "message": "Restoration process started",
            "backup_filename": backup_filename,
            "collections_to_restore": collections or "all",
            "initiated_by": f"{current_user.first_name} {current_user.last_name}",
            "initiated_at": datetime.utcnow().isoformat(),
            "status": "in_progress",
            "warning": "This operation will replace existing data!"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to initiate restoration from {backup_filename}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start restoration process"
        )


@backup_router.delete("/delete/{backup_filename}", summary="Delete backup file")
async def delete_backup(
    backup_filename: str,
    confirm_delete: bool = False,
    current_user: User = Depends(get_current_admin)
) -> Dict[str, Any]:
    """
    Delete a backup file.
    Requires admin privileges and explicit confirmation.
    """
    try:
        if not confirm_delete:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Deletion requires explicit confirmation (confirm_delete=True)"
            )
        
        backup_path = backup_service.backup_dir / backup_filename
        
        if not backup_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Backup file not found"
            )
        
        # Get file size before deletion
        file_size_mb = round(backup_path.stat().st_size / (1024 * 1024), 2)
        
        # Delete the file
        backup_path.unlink()
        
        logger.info(f"Backup deleted by user {current_user.user_id}: {backup_filename}")
        
        return {
            "message": "Backup file deleted successfully",
            "backup_filename": backup_filename,
            "file_size_mb": file_size_mb,
            "deleted_by": f"{current_user.first_name} {current_user.last_name}",
            "deleted_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete backup {backup_filename}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete backup file"
        )


@backup_router.get("/status", summary="Get backup system status")
async def get_backup_status(
    current_user: User = Depends(get_current_admin)
) -> Dict[str, Any]:
    """
    Get current backup system status and statistics.
    Requires admin privileges.
    """
    try:
        backups = backup_service.get_backup_list()
        
        # Calculate statistics
        total_size_mb = sum(backup["file_size_mb"] for backup in backups)
        backup_types = {}
        
        for backup in backups:
            backup_type = backup["backup_type"]
            if backup_type not in backup_types:
                backup_types[backup_type] = {"count": 0, "size_mb": 0}
            backup_types[backup_type]["count"] += 1
            backup_types[backup_type]["size_mb"] += backup["file_size_mb"]
        
        latest_backup = backups[0] if backups else None
        
        return {
            "backup_directory": str(backup_service.backup_dir),
            "total_backups": len(backups),
            "total_size_mb": round(total_size_mb, 2),
            "backup_types": backup_types,
            "latest_backup": latest_backup,
            "retention_policy": {
                "daily_backups_days": backup_service.retain_daily_days,
                "weekly_backups_weeks": backup_service.retain_weekly_weeks,
                "monthly_backups_months": backup_service.retain_monthly_months
            },
            "status_retrieved_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get backup status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve backup status"
        )
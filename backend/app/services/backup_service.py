"""
Automated Backup Service

Handles automated database backups and data archiving for the pawnshop system.
"""
import os
import json
import asyncio
import gzip
import shutil
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from pathlib import Path
import logging

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.models.customer_model import Customer
from app.models.transaction_model import Transaction
from app.models.item_model import Item
from app.models.user_model import User

logger = logging.getLogger(__name__)


class BackupService:
    """Service for automated database backups and data management"""
    
    def __init__(self):
        self.backup_dir = Path(settings.BACKUP_DIRECTORY or "./backups")
        self.backup_dir.mkdir(exist_ok=True)
        
        # Backup retention settings
        self.retain_daily_days = 30     # Keep daily backups for 30 days
        self.retain_weekly_weeks = 12   # Keep weekly backups for 12 weeks
        self.retain_monthly_months = 12 # Keep monthly backups for 12 months
        
    async def create_full_backup(self, backup_type: str = "manual") -> Dict[str, Any]:
        """
        Create a complete backup of all collections.
        
        Args:
            backup_type: Type of backup ("manual", "daily", "weekly", "monthly")
            
        Returns:
            Dict with backup information
        """
        try:
            timestamp = datetime.utcnow()
            backup_name = f"backup_{backup_type}_{timestamp.strftime('%Y%m%d_%H%M%S')}"
            backup_path = self.backup_dir / backup_name
            backup_path.mkdir(exist_ok=True)
            
            logger.info(f"Starting {backup_type} backup: {backup_name}")
            
            # Backup metadata
            backup_info = {
                "backup_name": backup_name,
                "backup_type": backup_type,
                "timestamp": timestamp.isoformat(),
                "collections": {},
                "total_documents": 0,
                "backup_size_mb": 0
            }
            
            # Backup each collection
            collections_to_backup = [
                ("users", User),
                ("customers", Customer),
                ("transactions", Transaction),
                ("items", Item)
            ]
            
            for collection_name, model_class in collections_to_backup:
                collection_info = await self._backup_collection(
                    collection_name, model_class, backup_path
                )
                backup_info["collections"][collection_name] = collection_info
                backup_info["total_documents"] += collection_info["document_count"]
            
            # Save backup metadata
            metadata_file = backup_path / "backup_info.json"
            with open(metadata_file, 'w') as f:
                json.dump(backup_info, f, indent=2, default=str)
            
            # Compress backup directory
            compressed_backup = await self._compress_backup(backup_path)
            
            # Calculate final size
            if compressed_backup.exists():
                backup_info["backup_size_mb"] = round(compressed_backup.stat().st_size / (1024 * 1024), 2)
                # Remove uncompressed directory
                shutil.rmtree(backup_path)
            
            logger.info(f"Backup completed: {backup_name} ({backup_info['backup_size_mb']} MB)")
            
            return backup_info
            
        except Exception as e:
            logger.error(f"Backup failed: {str(e)}")
            raise
    
    async def _backup_collection(self, collection_name: str, model_class, backup_path: Path) -> Dict[str, Any]:
        """Backup a specific collection to JSON file"""
        try:
            # Get all documents
            documents = await model_class.find_all().to_list()
            
            # Convert to JSON-serializable format
            json_data = []
            for doc in documents:
                doc_dict = doc.model_dump()
                # Convert any datetime objects to ISO strings
                doc_dict = self._serialize_document(doc_dict)
                json_data.append(doc_dict)
            
            # Save to file
            collection_file = backup_path / f"{collection_name}.json"
            with open(collection_file, 'w') as f:
                json.dump(json_data, f, indent=2, default=str)
            
            collection_info = {
                "document_count": len(documents),
                "file_size_mb": round(collection_file.stat().st_size / (1024 * 1024), 2),
                "backup_time": datetime.utcnow().isoformat()
            }
            
            logger.info(f"Backed up {collection_name}: {len(documents)} documents")
            return collection_info
            
        except Exception as e:
            logger.error(f"Failed to backup collection {collection_name}: {str(e)}")
            raise
    
    def _serialize_document(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        """Convert document to JSON-serializable format"""
        if isinstance(doc, dict):
            return {key: self._serialize_document(value) for key, value in doc.items()}
        elif isinstance(doc, list):
            return [self._serialize_document(item) for item in doc]
        elif isinstance(doc, datetime):
            return doc.isoformat()
        else:
            return doc
    
    async def _compress_backup(self, backup_path: Path) -> Path:
        """Compress backup directory to .tar.gz file"""
        try:
            compressed_path = backup_path.with_suffix('.tar.gz')
            
            # Create compressed archive
            shutil.make_archive(
                str(backup_path),
                'gztar',
                str(backup_path.parent),
                str(backup_path.name)
            )
            
            return compressed_path
            
        except Exception as e:
            logger.error(f"Failed to compress backup: {str(e)}")
            raise
    
    async def restore_from_backup(self, backup_file: str, collections: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Restore data from a backup file.
        
        Args:
            backup_file: Path to backup file
            collections: List of collections to restore (None for all)
            
        Returns:
            Dict with restoration information
        """
        try:
            backup_path = Path(backup_file)
            if not backup_path.exists():
                raise FileNotFoundError(f"Backup file not found: {backup_file}")
            
            logger.info(f"Starting restoration from: {backup_file}")
            
            # Extract backup if compressed
            if backup_path.suffix == '.gz':
                extract_path = backup_path.parent / backup_path.stem.replace('.tar', '')
                shutil.unpack_archive(str(backup_path), str(extract_path.parent))
                backup_dir = extract_path
            else:
                backup_dir = backup_path
            
            # Read backup metadata
            metadata_file = backup_dir / "backup_info.json"
            if metadata_file.exists():
                with open(metadata_file, 'r') as f:
                    backup_info = json.load(f)
            else:
                backup_info = {"collections": {}}
            
            restoration_info = {
                "backup_file": backup_file,
                "restoration_time": datetime.utcnow().isoformat(),
                "collections_restored": {},
                "total_documents_restored": 0
            }
            
            # Define collection mappings
            collection_mappings = {
                "users": User,
                "customers": Customer,
                "transactions": Transaction,
                "items": Item
            }
            
            # Restore collections
            for collection_name, model_class in collection_mappings.items():
                if collections and collection_name not in collections:
                    continue
                    
                collection_file = backup_dir / f"{collection_name}.json"
                if collection_file.exists():
                    restored_count = await self._restore_collection(
                        collection_name, model_class, collection_file
                    )
                    restoration_info["collections_restored"][collection_name] = restored_count
                    restoration_info["total_documents_restored"] += restored_count
            
            # Cleanup extracted files if needed
            if backup_path.suffix == '.gz' and extract_path.exists():
                shutil.rmtree(extract_path)
            
            logger.info(f"Restoration completed: {restoration_info['total_documents_restored']} documents")
            
            return restoration_info
            
        except Exception as e:
            logger.error(f"Restoration failed: {str(e)}")
            raise
    
    async def _restore_collection(self, collection_name: str, model_class, collection_file: Path) -> int:
        """Restore a specific collection from JSON file"""
        try:
            with open(collection_file, 'r') as f:
                documents = json.load(f)
            
            if not documents:
                return 0
            
            # Clear existing collection (WARNING: This deletes all current data)
            await model_class.delete_all()
            
            # Insert documents
            restored_count = 0
            for doc_data in documents:
                try:
                    # Convert ISO strings back to datetime objects
                    doc_data = self._deserialize_document(doc_data)
                    
                    # Create and insert document
                    document = model_class(**doc_data)
                    await document.insert()
                    restored_count += 1
                    
                except Exception as e:
                    logger.warning(f"Failed to restore document in {collection_name}: {str(e)}")
                    continue
            
            logger.info(f"Restored {collection_name}: {restored_count} documents")
            return restored_count
            
        except Exception as e:
            logger.error(f"Failed to restore collection {collection_name}: {str(e)}")
            raise
    
    def _deserialize_document(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        """Convert document from JSON format back to proper types"""
        # This is a simplified version - in production you'd want more robust type conversion
        if isinstance(doc, dict):
            result = {}
            for key, value in doc.items():
                if isinstance(value, str) and key.endswith(('_at', '_date')):
                    try:
                        result[key] = datetime.fromisoformat(value.replace('Z', '+00:00'))
                    except ValueError:
                        result[key] = value
                else:
                    result[key] = self._deserialize_document(value)
            return result
        elif isinstance(doc, list):
            return [self._deserialize_document(item) for item in doc]
        else:
            return doc
    
    async def schedule_automatic_backups(self):
        """Start automated backup scheduler"""
        logger.info("Starting automated backup scheduler")
        
        while True:
            try:
                now = datetime.utcnow()
                
                # Daily backup at 2 AM
                if now.hour == 2 and now.minute == 0:
                    await self.create_full_backup("daily")
                    await self._cleanup_old_backups("daily")
                
                # Weekly backup on Sunday at 3 AM
                if now.weekday() == 6 and now.hour == 3 and now.minute == 0:
                    await self.create_full_backup("weekly")
                    await self._cleanup_old_backups("weekly")
                
                # Monthly backup on 1st of month at 4 AM
                if now.day == 1 and now.hour == 4 and now.minute == 0:
                    await self.create_full_backup("monthly")
                    await self._cleanup_old_backups("monthly")
                
                # Sleep for 1 minute before checking again
                await asyncio.sleep(60)
                
            except Exception as e:
                logger.error(f"Error in backup scheduler: {str(e)}")
                await asyncio.sleep(300)  # Wait 5 minutes on error
    
    async def _cleanup_old_backups(self, backup_type: str):
        """Remove old backups based on retention policy"""
        try:
            now = datetime.utcnow()
            
            # Define retention periods
            retention_days = {
                "daily": self.retain_daily_days,
                "weekly": self.retain_weekly_weeks * 7,
                "monthly": self.retain_monthly_months * 30
            }
            
            cutoff_date = now - timedelta(days=retention_days.get(backup_type, 30))
            
            # Find and remove old backups
            removed_count = 0
            for backup_file in self.backup_dir.glob(f"backup_{backup_type}_*.tar.gz"):
                try:
                    # Extract timestamp from filename
                    timestamp_str = backup_file.stem.split('_')[-2:]  # date_time
                    timestamp_str = '_'.join(timestamp_str)
                    backup_date = datetime.strptime(timestamp_str, '%Y%m%d_%H%M%S')
                    
                    if backup_date < cutoff_date:
                        backup_file.unlink()
                        removed_count += 1
                        logger.info(f"Removed old backup: {backup_file.name}")
                        
                except (ValueError, IndexError) as e:
                    logger.warning(f"Could not parse backup date from {backup_file.name}: {e}")
                    continue
            
            if removed_count > 0:
                logger.info(f"Cleaned up {removed_count} old {backup_type} backups")
                
        except Exception as e:
            logger.error(f"Error cleaning up {backup_type} backups: {str(e)}")
    
    def get_backup_list(self) -> List[Dict[str, Any]]:
        """Get list of available backups"""
        backups = []
        
        for backup_file in self.backup_dir.glob("backup_*.tar.gz"):
            try:
                # Parse backup info from filename
                parts = backup_file.stem.split('_')
                backup_type = parts[1]
                timestamp_str = '_'.join(parts[2:4])
                backup_date = datetime.strptime(timestamp_str, '%Y%m%d_%H%M%S')
                
                backup_info = {
                    "filename": backup_file.name,
                    "backup_type": backup_type,
                    "backup_date": backup_date.isoformat(),
                    "file_size_mb": round(backup_file.stat().st_size / (1024 * 1024), 2),
                    "file_path": str(backup_file)
                }
                
                backups.append(backup_info)
                
            except (ValueError, IndexError) as e:
                logger.warning(f"Could not parse backup info from {backup_file.name}: {e}")
                continue
        
        # Sort by date (newest first)
        backups.sort(key=lambda x: x["backup_date"], reverse=True)
        
        return backups
    
    async def verify_backup_integrity(self, backup_file: str) -> Dict[str, Any]:
        """Verify backup file integrity"""
        try:
            backup_path = Path(backup_file)
            if not backup_path.exists():
                return {"valid": False, "error": "Backup file not found"}
            
            # Extract and verify contents
            extract_path = backup_path.parent / f"verify_{backup_path.stem}"
            
            try:
                shutil.unpack_archive(str(backup_path), str(extract_path))
                
                # Check metadata file
                metadata_file = extract_path / "backup_info.json"
                if not metadata_file.exists():
                    return {"valid": False, "error": "Backup metadata missing"}
                
                with open(metadata_file, 'r') as f:
                    metadata = json.load(f)
                
                # Verify collection files
                verification_results = {
                    "valid": True,
                    "metadata": metadata,
                    "collections": {}
                }
                
                for collection_name in metadata.get("collections", {}):
                    collection_file = extract_path / f"{collection_name}.json"
                    if collection_file.exists():
                        with open(collection_file, 'r') as f:
                            try:
                                documents = json.load(f)
                                verification_results["collections"][collection_name] = {
                                    "valid": True,
                                    "document_count": len(documents)
                                }
                            except json.JSONDecodeError:
                                verification_results["collections"][collection_name] = {
                                    "valid": False,
                                    "error": "Invalid JSON format"
                                }
                                verification_results["valid"] = False
                    else:
                        verification_results["collections"][collection_name] = {
                            "valid": False,
                            "error": "Collection file missing"
                        }
                        verification_results["valid"] = False
                
                return verification_results
                
            finally:
                # Cleanup extracted files
                if extract_path.exists():
                    shutil.rmtree(extract_path)
                
        except Exception as e:
            return {"valid": False, "error": str(e)}


# Global backup service instance
backup_service = BackupService()
"""
Database Index Management

Defines and manages database indexes for optimal query performance.
Based on the codebase analysis recommendations for frequently queried fields.
"""

from pymongo import IndexModel, ASCENDING, DESCENDING, TEXT
import structlog

# Configure logger
index_logger = structlog.get_logger("database_indexes")


class DatabaseIndexes:
    """Database index definitions for all collections"""
    
    @staticmethod
    def get_user_indexes():
        """Index definitions for User collection"""
        return [
            # Primary lookup by user_id (unique)
            IndexModel([("user_id", ASCENDING)], unique=True, name="idx_user_id"),
            
            # Authentication queries
            IndexModel([("status", ASCENDING)], name="idx_user_status"),
            IndexModel([("role", ASCENDING)], name="idx_user_role"),
            
            # Query by status and role combination
            IndexModel([("status", ASCENDING), ("role", ASCENDING)], name="idx_user_status_role"),
            
            # Search operations (name, email)
            IndexModel([("first_name", TEXT), ("last_name", TEXT), ("email", TEXT)], name="idx_user_search"),
            
            # Sorting and pagination
            IndexModel([("created_at", DESCENDING)], name="idx_user_created_desc"),
            IndexModel([("updated_at", DESCENDING)], name="idx_user_updated_desc"),
            
            # Security - failed login attempts
            IndexModel([("locked_until", ASCENDING)], sparse=True, name="idx_user_locked_until"),
            IndexModel([("failed_login_attempts", ASCENDING)], name="idx_user_failed_attempts"),
        ]
    
    @staticmethod
    def get_customer_indexes():
        """Index definitions for Customer collection"""
        return [
            # Primary lookup by phone number (unique)
            IndexModel([("phone_number", ASCENDING)], unique=True, name="idx_customer_phone"),
            
            # Status queries
            IndexModel([("status", ASCENDING)], name="idx_customer_status"),
            
            # Search operations
            IndexModel([("first_name", TEXT), ("last_name", TEXT), ("email", TEXT)], name="idx_customer_search"),
            
            # Customer analytics
            IndexModel([("status", ASCENDING), ("active_loans", ASCENDING)], name="idx_customer_status_loans"),
            IndexModel([("payment_history_score", DESCENDING)], name="idx_customer_payment_score"),
            IndexModel([("total_transactions", DESCENDING)], name="idx_customer_total_transactions"),
            
            # Sorting and pagination
            IndexModel([("created_at", DESCENDING)], name="idx_customer_created_desc"),
            IndexModel([("last_transaction_date", DESCENDING)], sparse=True, name="idx_customer_last_transaction"),
            
            # Business queries
            IndexModel([("active_loans", ASCENDING)], name="idx_customer_active_loans"),
            IndexModel([("default_count", ASCENDING)], name="idx_customer_defaults"),
        ]
    
    @staticmethod
    def get_transaction_indexes():
        """Index definitions for PawnTransaction collection"""
        return [
            # Primary lookup by transaction_id (unique)
            IndexModel([("transaction_id", ASCENDING)], unique=True, name="idx_transaction_id"),
            
            # Customer queries
            IndexModel([("customer_id", ASCENDING)], name="idx_transaction_customer"),
            IndexModel([("customer_id", ASCENDING), ("status", ASCENDING)], name="idx_transaction_customer_status"),
            
            # Status queries
            IndexModel([("status", ASCENDING)], name="idx_transaction_status"),
            IndexModel([("status", ASCENDING), ("pawn_date", DESCENDING)], name="idx_transaction_status_date"),
            
            # Date-based queries (critical for business operations)
            IndexModel([("pawn_date", DESCENDING)], name="idx_transaction_pawn_date"),
            IndexModel([("maturity_date", ASCENDING)], name="idx_transaction_maturity"),
            IndexModel([("grace_period_end", ASCENDING)], name="idx_transaction_grace_period"),
            
            # Overdue and forfeiture queries
            IndexModel([
                ("status", ASCENDING), 
                ("maturity_date", ASCENDING), 
                ("grace_period_end", ASCENDING)
            ], name="idx_transaction_overdue_check"),
            
            # Financial queries
            IndexModel([("loan_amount", ASCENDING)], name="idx_transaction_loan_amount"),
            IndexModel([("loan_amount", ASCENDING), ("status", ASCENDING)], name="idx_transaction_amount_status"),
            
            # Staff/audit queries
            IndexModel([("created_by_user_id", ASCENDING)], name="idx_transaction_created_by"),
            IndexModel([("created_by_user_id", ASCENDING), ("pawn_date", DESCENDING)], name="idx_transaction_staff_date"),
            
            # Storage and operations
            IndexModel([("storage_location", ASCENDING)], name="idx_transaction_storage"),
            
            # Compound queries for business logic
            IndexModel([
                ("status", ASCENDING),
                ("customer_id", ASCENDING),
                ("pawn_date", DESCENDING)
            ], name="idx_transaction_business_logic"),
        ]
    
    @staticmethod
    def get_payment_indexes():
        """Index definitions for Payment collection"""
        return [
            # Primary lookup by payment_id (unique)
            IndexModel([("payment_id", ASCENDING)], unique=True, name="idx_payment_id"),
            
            # Transaction queries
            IndexModel([("transaction_id", ASCENDING)], name="idx_payment_transaction"),
            IndexModel([("transaction_id", ASCENDING), ("payment_date", DESCENDING)], name="idx_payment_transaction_date"),
            
            # Void status queries (critical for financial integrity)
            IndexModel([("is_voided", ASCENDING)], name="idx_payment_voided"),
            IndexModel([("transaction_id", ASCENDING), ("is_voided", ASCENDING)], name="idx_payment_transaction_voided"),
            
            # Date-based queries
            IndexModel([("payment_date", DESCENDING)], name="idx_payment_date"),
            IndexModel([("payment_date", ASCENDING), ("is_voided", ASCENDING)], name="idx_payment_date_voided"),
            
            # Staff/audit queries
            IndexModel([("processed_by_user_id", ASCENDING)], name="idx_payment_processed_by"),
            IndexModel([("processed_by_user_id", ASCENDING), ("payment_date", DESCENDING)], name="idx_payment_staff_date"),
            
            # Void operations (admin oversight)
            IndexModel([("voided_by_user_id", ASCENDING)], sparse=True, name="idx_payment_voided_by"),
            IndexModel([("voided_date", DESCENDING)], sparse=True, name="idx_payment_voided_date"),
            
            # Financial reporting
            IndexModel([("payment_amount", DESCENDING)], name="idx_payment_amount"),
            IndexModel([("payment_method", ASCENDING)], name="idx_payment_method"),
        ]
    
    @staticmethod
    def get_extension_indexes():
        """Index definitions for Extension collection"""
        return [
            # Primary lookup by extension_id (unique)
            IndexModel([("extension_id", ASCENDING)], unique=True, name="idx_extension_id"),
            
            # Transaction queries
            IndexModel([("transaction_id", ASCENDING)], name="idx_extension_transaction"),
            IndexModel([("transaction_id", ASCENDING), ("extension_date", DESCENDING)], name="idx_extension_transaction_date"),
            
            # Date-based queries
            IndexModel([("extension_date", DESCENDING)], name="idx_extension_date"),
            IndexModel([("original_maturity_date", ASCENDING)], name="idx_extension_original_maturity"),
            IndexModel([("new_maturity_date", ASCENDING)], name="idx_extension_new_maturity"),
            
            # Staff queries
            IndexModel([("processed_by_user_id", ASCENDING)], name="idx_extension_processed_by"),
            
            # Cancellation tracking
            IndexModel([("is_cancelled", ASCENDING)], name="idx_extension_cancelled"),
            IndexModel([("cancelled_by_user_id", ASCENDING)], sparse=True, name="idx_extension_cancelled_by"),
            
            # Business analytics
            IndexModel([("extension_months", ASCENDING)], name="idx_extension_months"),
            IndexModel([("total_extension_fee", DESCENDING)], name="idx_extension_fee"),
        ]
    
    @staticmethod
    def get_item_indexes():
        """Index definitions for PawnItem collection"""
        return [
            # Transaction queries (most frequent)
            IndexModel([("transaction_id", ASCENDING)], name="idx_item_transaction"),
            IndexModel([("transaction_id", ASCENDING), ("item_number", ASCENDING)], name="idx_item_transaction_number"),
            
            # Search queries
            IndexModel([("description", TEXT)], name="idx_item_description_search"),
            IndexModel([("serial_number", ASCENDING)], sparse=True, name="idx_item_serial_number"),
            
            # Inventory management
            IndexModel([("item_number", ASCENDING)], name="idx_item_number"),
        ]


async def create_database_indexes(db_client):
    """
    Create all database indexes for optimal performance.
    Handles existing indexes gracefully to avoid conflicts.
    
    Args:
        db_client: MongoDB database client
    """
    collections_and_indexes = [
        ("users", DatabaseIndexes.get_user_indexes()),
        ("customers", DatabaseIndexes.get_customer_indexes()),
        ("pawntransactions", DatabaseIndexes.get_transaction_indexes()),
        ("payments", DatabaseIndexes.get_payment_indexes()),
        ("extensions", DatabaseIndexes.get_extension_indexes()),
        ("pawnitems", DatabaseIndexes.get_item_indexes()),
    ]
    
    created_count = 0
    error_count = 0
    skipped_count = 0
    
    for collection_name, index_definitions in collections_and_indexes:
        try:
            collection = db_client[collection_name]
            
            if not index_definitions:
                continue
            
            # Get existing indexes first
            existing_indexes = {}
            try:
                existing_index_list = await collection.list_indexes().to_list(None)
                for idx in existing_index_list:
                    existing_indexes[idx['name']] = idx
            except Exception as e:
                index_logger.warning(
                    "Could not list existing indexes",
                    collection=collection_name,
                    error=str(e)
                )
            
            # Create indexes one by one to handle conflicts gracefully
            for index_def in index_definitions:
                try:
                    index_name = index_def.document.get('name', 'unnamed_index')
                    
                    # Check if index already exists
                    if index_name in existing_indexes:
                        skipped_count += 1
                        index_logger.debug(
                            "Index already exists, skipping",
                            collection=collection_name,
                            index_name=index_name
                        )
                        continue
                    
                    # Create individual index
                    result = await collection.create_indexes([index_def])
                    if result:
                        created_count += 1
                        index_logger.debug(
                            "Created index",
                            collection=collection_name,
                            index_name=index_name
                        )
                        
                except Exception as index_error:
                    error_str = str(index_error)
                    
                    # Handle specific index conflict errors gracefully
                    if "already exists" in error_str or "IndexOptionsConflict" in error_str:
                        skipped_count += 1
                        index_logger.debug(
                            "Index exists with different options, skipping",
                            collection=collection_name,
                            index_name=index_name,
                            error=error_str
                        )
                    else:
                        error_count += 1
                        index_logger.error(
                            "Failed to create specific index",
                            collection=collection_name,
                            index_name=index_name,
                            error=error_str
                        )
                
            index_logger.info(
                "Processed indexes for collection",
                collection=collection_name,
                total_indexes=len(index_definitions)
            )
            
        except Exception as e:
            error_count += 1
            index_logger.error(
                "Failed to process collection indexes",
                collection=collection_name,
                error=str(e),
                error_type=type(e).__name__
            )
    
    index_logger.info(
        "Database index creation completed",
        total_created=created_count,
        skipped_existing=skipped_count,
        errors=error_count,
        collections_processed=len(collections_and_indexes)
    )
    
    return created_count, error_count


async def drop_database_indexes(db_client, collection_name: str = None):
    """
    Drop database indexes (for maintenance or recreation).
    
    Args:
        db_client: MongoDB database client
        collection_name: Optional specific collection name
    """
    collections = [collection_name] if collection_name else [
        "users", "customers", "pawntransactions", "payments", "extensions", "pawnitems"
    ]
    
    for collection in collections:
        try:
            db_collection = db_client[collection]
            
            # Get existing indexes (except _id index)
            existing_indexes = await db_collection.list_indexes().to_list(None)
            custom_indexes = [idx for idx in existing_indexes if idx['name'] != '_id_']
            
            # Drop custom indexes
            for index_info in custom_indexes:
                await db_collection.drop_index(index_info['name'])
                index_logger.info(
                    "Dropped index",
                    collection=collection,
                    index_name=index_info['name']
                )
                
        except Exception as e:
            index_logger.error(
                "Failed to drop indexes for collection",
                collection=collection,
                error=str(e)
            )


async def analyze_index_usage(db_client):
    """
    Analyze index usage statistics for optimization.
    
    Args:
        db_client: MongoDB database client
        
    Returns:
        Dictionary with index usage statistics
    """
    usage_stats = {}
    collections = ["users", "customers", "pawntransactions", "payments", "extensions", "pawnitems"]
    
    for collection_name in collections:
        try:
            collection = db_client[collection_name]
            
            # Get index stats
            index_stats = await collection.aggregate([
                {"$indexStats": {}}
            ]).to_list(None)
            
            usage_stats[collection_name] = {
                "total_indexes": len(index_stats),
                "index_details": index_stats
            }
            
        except Exception as e:
            index_logger.error(
                "Failed to get index stats for collection",
                collection=collection_name,
                error=str(e)
            )
            usage_stats[collection_name] = {"error": str(e)}
    
    return usage_stats
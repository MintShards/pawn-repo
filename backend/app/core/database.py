"""
Database Transaction Support and Connection Management

Provides MongoDB transaction sessions for atomic operations and connection management
for the pawnshop operations system with emphasis on financial data integrity.
"""

# Standard library imports
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, List, Callable
import structlog
from datetime import datetime, UTC

# Third-party imports
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase, AsyncIOMotorClientSession
from pymongo.errors import (
    ConnectionFailure, 
    OperationFailure, 
    DuplicateKeyError
)

# Local imports
from app.core.config import settings

# Configure logger
logger = structlog.get_logger("database")

# Global database client and connection
db_client: Optional[AsyncIOMotorDatabase] = None
motor_client: Optional[AsyncIOMotorClient] = None


def get_database() -> AsyncIOMotorDatabase:
    """
    Get the current database instance.
    
    Returns:
        AsyncIOMotorDatabase: Current database instance
        
    Raises:
        RuntimeError: If database not initialized
    """
    global db_client
    if db_client is None:
        raise RuntimeError("Database not initialized. Call initialize_database() first.")
    return db_client


def get_motor_client() -> AsyncIOMotorClient:
    """
    Get the current Motor client instance.
    
    Returns:
        AsyncIOMotorClient: Current Motor client instance
        
    Raises:
        RuntimeError: If client not initialized
    """
    global motor_client
    if motor_client is None:
        raise RuntimeError("Motor client not initialized. Call initialize_database() first.")
    return motor_client


async def initialize_database():
    """
    Initialize the database connection and client.
    
    Should be called during application startup.
    """
    global db_client, motor_client
    
    # Create Motor client with optimized connection pool settings
    motor_client = AsyncIOMotorClient(
        settings.MONGO_CONNECTION_STRING,
        maxPoolSize=20,          # Maximum connections in pool
        minPoolSize=5,           # Minimum connections to maintain
        connectTimeoutMS=5000,   # Connection timeout (5s)
        serverSelectionTimeoutMS=5000,  # Server selection timeout
        waitQueueTimeoutMS=5000, # Wait queue timeout
        retryReads=True,         # Retry read operations
        retryWrites=True         # Retry write operations
    )
    
    # Get default database
    db_client = motor_client.get_default_database()
    
    logger.info("Database connection initialized successfully")


async def close_database():
    """
    Close the database connection.
    
    Should be called during application shutdown.
    """
    global motor_client
    if motor_client:
        motor_client.close()
        logger.info("Database connection closed")


class DatabaseTransactionError(Exception):
    """Base exception for database transaction operations"""
    pass


class TransactionRetryError(DatabaseTransactionError):
    """Transaction retry exceeded maximum attempts"""
    pass


class ConcurrentModificationError(DatabaseTransactionError):
    """Document was modified by another operation"""
    pass


@asynccontextmanager
async def transaction_session(max_retries: int = 3):
    """
    Context manager for MongoDB transaction sessions with retry logic.
    
    Provides atomic operations with automatic retry on transient failures.
    
    Args:
        max_retries: Maximum number of retry attempts for transient errors
        
    Yields:
        AsyncIOMotorClientSession: MongoDB session for transaction operations
        
    Raises:
        DatabaseTransactionError: If transaction fails
        TransactionRetryError: If max retries exceeded
        
    Example:
        async with transaction_session() as session:
            await session.start_transaction()
            try:
                # Perform atomic operations
                payment = await create_payment(data, session=session)
                transaction = await update_transaction(data, session=session)
                await session.commit_transaction()
                return {"payment": payment, "transaction": transaction}
            except Exception as e:
                await session.abort_transaction()
                raise
    """
    client = get_motor_client()
    
    for attempt in range(max_retries + 1):
        session = None
        try:
            session = await client.start_session()
            
            logger.debug(
                "Transaction session started",
                attempt=attempt + 1,
                max_retries=max_retries
            )
            
            yield session
            
            # If we reach here without exception, transaction was successful
            logger.debug("Transaction session completed successfully")
            return
            
        except OperationFailure as e:
            # Check if it's a transient transaction error by error code
            if hasattr(e, 'code') and e.code in [112, 251]:  # Common transient error codes
                logger.warning(
                    "Transient transaction error, retrying",
                    attempt=attempt + 1,
                    max_retries=max_retries,
                    error=str(e)
                )
                if attempt >= max_retries:
                    raise TransactionRetryError(
                        f"Transaction failed after {max_retries} retries: {str(e)}"
                    )
                # Continue to next retry attempt
            else:
                # Non-transient OperationFailure, don't retry
                raise DatabaseTransactionError(f"Transaction failed: {str(e)}")
            
        except ConnectionFailure as e:
            logger.error(
                "Database connection failed",
                attempt=attempt + 1,
                error=str(e)
            )
            if attempt >= max_retries:
                raise DatabaseTransactionError(
                    f"Database connection failed after {max_retries} retries: {str(e)}"
                )
            # Continue to next retry attempt
            
        except Exception as e:
            # For non-transient errors, don't retry
            logger.error(
                "Non-retryable transaction error",
                attempt=attempt + 1,
                error=str(e),
                error_type=type(e).__name__
            )
            raise DatabaseTransactionError(f"Transaction failed: {str(e)}")
            
        finally:
            if session:
                await session.end_session()
                logger.debug("Transaction session ended")


async def execute_transaction(
    operations: Callable[[AsyncIOMotorClientSession], Any],
    max_retries: int = 3
) -> Any:
    """
    Execute operations within a MongoDB transaction with retry logic.
    
    Args:
        operations: Async function that takes a session and performs operations
        max_retries: Maximum number of retry attempts
        
    Returns:
        Result of the operations function
        
    Raises:
        DatabaseTransactionError: If transaction fails
        TransactionRetryError: If max retries exceeded
        
    Example:
        async def payment_operations(session):
            payment = await create_payment(payment_data, session=session)
            transaction = await update_transaction_balance(payment, session=session)
            return {"payment": payment, "transaction": transaction}
        
        result = await execute_transaction(payment_operations)
    """
    async with transaction_session(max_retries=max_retries) as session:
        session.start_transaction()
        
        try:
            result = await operations(session)
            session.commit_transaction()
            
            logger.info(
                "Transaction committed successfully",
                operation_type=operations.__name__ if hasattr(operations, '__name__') else 'anonymous'
            )
            
            return result
            
        except Exception as e:
            session.abort_transaction()
            
            logger.error(
                "Transaction aborted due to error",
                error=str(e),
                error_type=type(e).__name__,
                operation_type=operations.__name__ if hasattr(operations, '__name__') else 'anonymous'
            )
            
            raise


async def with_retry(
    operation: Callable,
    max_retries: int = 3,
    retry_on: tuple = (ConnectionFailure, OperationFailure)
) -> Any:
    """
    Execute an operation with retry logic for transient errors.
    
    Args:
        operation: Async function to execute
        max_retries: Maximum number of retry attempts
        retry_on: Tuple of exception types to retry on
        
    Returns:
        Result of the operation
        
    Raises:
        Exception: Last exception after all retries exhausted
    """
    last_exception = None
    
    for attempt in range(max_retries + 1):
        try:
            return await operation()
            
        except retry_on as e:
            last_exception = e
            logger.warning(
                "Operation failed, retrying",
                attempt=attempt + 1,
                max_retries=max_retries,
                error=str(e),
                error_type=type(e).__name__
            )
            
            if attempt >= max_retries:
                break
            
        except Exception as e:
            # Don't retry for non-transient errors
            logger.error(
                "Non-retryable operation error",
                attempt=attempt + 1,
                error=str(e),
                error_type=type(e).__name__
            )
            raise
    
    # If we get here, all retries were exhausted
    raise TransactionRetryError(
        f"Operation failed after {max_retries} retries: {str(last_exception)}"
    )


class OptimisticLockingMixin:
    """
    Mixin to add optimistic locking support to Beanie documents.
    
    Provides version-based concurrent modification detection.
    """
    
    version: Optional[int] = 1
    
    async def save_with_version_check(self, session: Optional[AsyncIOMotorClientSession] = None):
        """
        Save document with optimistic locking version check.
        
        Args:
            session: Optional MongoDB session for transaction
            
        Raises:
            ConcurrentModificationError: If document was modified by another operation
        """
        if self.id is None:
            # New document - regular save
            self.version = 1
            await self.save(session=session)
            return
        
        # Existing document - check version
        current_version = self.version
        next_version = current_version + 1
        
        # Update with version check
        update_result = await self.find_one(
            {
                "_id": self.id,
                "version": current_version
            }
        ).update(
            {
                "$set": {**self.dict(exclude={"id", "version"}), "version": next_version},
                "$currentDate": {"updated_at": True}
            },
            session=session
        )
        
        if update_result.modified_count == 0:
            raise ConcurrentModificationError(
                f"Document {self.id} was modified by another operation. "
                f"Expected version: {current_version}"
            )
        
        # Update local version
        self.version = next_version


def get_collection_with_session(collection_name: str, session: Optional[AsyncIOMotorClientSession] = None):
    """
    Get a collection with optional session support.
    
    Args:
        collection_name: Name of the collection
        session: Optional MongoDB session
        
    Returns:
        Collection object with session context if provided
    """
    db = get_database()
    collection = db[collection_name]
    
    if session:
        # Return collection bound to session
        return collection.with_options(session=session)
    
    return collection


async def health_check() -> Dict[str, Any]:
    """
    Perform database health check.
    
    Returns:
        Dictionary with health check results
    """
    try:
        client = get_motor_client()
        
        # Test basic connection
        await client.admin.command('ping')
        
        # Test database access
        db = get_database()
        collections = await db.list_collection_names()
        
        # Test transaction support
        try:
            async with transaction_session() as session:
                await session.start_transaction()
                await session.abort_transaction()
            transaction_support = True
        except Exception as e:
            logger.warning("Transaction support test failed", error=str(e))
            transaction_support = False
        
        return {
            "status": "healthy",
            "timestamp": datetime.now(UTC).isoformat(),
            "connection": "active",
            "database": db.name,
            "collections_count": len(collections),
            "transaction_support": transaction_support,
            "client_info": {
                "max_pool_size": client.options.max_pool_size,
                "min_pool_size": client.options.min_pool_size
            }
        }
        
    except Exception as e:
        return {
            "status": "unhealthy",
            "timestamp": datetime.now(UTC).isoformat(),
            "error": str(e),
            "error_type": type(e).__name__
        }


# Performance monitoring utilities
async def get_connection_stats() -> Dict[str, Any]:
    """
    Get database connection statistics.
    
    Returns:
        Dictionary with connection statistics
    """
    try:
        client = get_motor_client()
        
        # Get server status
        db = get_database()
        server_status = await db.command('serverStatus')
        
        return {
            "timestamp": datetime.now(UTC).isoformat(),
            "connections": {
                "current": server_status.get("connections", {}).get("current", 0),
                "available": server_status.get("connections", {}).get("available", 0),
                "total_created": server_status.get("connections", {}).get("totalCreated", 0)
            },
            "client_pool": {
                "max_pool_size": client.options.max_pool_size,
                "min_pool_size": client.options.min_pool_size,
                "connect_timeout": client.options.connect_timeout,
                "server_selection_timeout": client.options.server_selection_timeout
            }
        }
        
    except Exception as e:
        logger.error("Failed to get connection stats", error=str(e))
        return {
            "error": str(e),
            "timestamp": datetime.now(UTC).isoformat()
        }
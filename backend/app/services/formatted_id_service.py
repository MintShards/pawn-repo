"""
Formatted ID Service

Manages the generation and assignment of display-friendly transaction IDs
like PW000105 based on chronological order.
"""

from typing import Optional
from app.models.pawn_transaction_model import PawnTransaction
from app.models.extension_model import Extension
import structlog

logger = structlog.get_logger()


class FormattedIdService:
    """Service for managing formatted transaction IDs"""
    
    
    @staticmethod
    async def get_next_formatted_id() -> str:
        """
        Get the next formatted ID for a new transaction.
        
        Returns:
            Next formatted ID like PW000123
        """
        # Find the highest existing formatted ID
        highest_transaction = await PawnTransaction.find(
            PawnTransaction.formatted_id != None
        ).sort([("formatted_id", -1)]).first_or_none()
        
        if highest_transaction and highest_transaction.formatted_id:
            # Extract number and increment
            highest_num = int(highest_transaction.formatted_id[2:])
            next_number = highest_num + 1
        else:
            # First transaction
            next_number = 1
        
        formatted_id = f"PW{next_number:06d}"
        logger.debug(f"🏷️ FORMATTED ID: Generated new ID {formatted_id}")
        return formatted_id
    
    @staticmethod
    async def find_by_formatted_id(formatted_id: str) -> Optional[PawnTransaction]:
        """
        Find a transaction by its formatted ID.
        
        Args:
            formatted_id: The formatted ID like PW000105
            
        Returns:
            Transaction if found, None otherwise
        """
        # Normalize the formatted ID (uppercase, strip whitespace)
        normalized_id = formatted_id.upper().strip()
        
        logger.debug(f"🔍 FORMATTED ID: Searching for transaction with ID {normalized_id}")
        
        transaction = await PawnTransaction.find_one(
            PawnTransaction.formatted_id == normalized_id
        )
        
        if transaction:
            logger.debug(f"✅ FORMATTED ID: Found transaction {transaction.transaction_id[:8]}... for ID {normalized_id}")
        else:
            logger.debug(f"❌ FORMATTED ID: No transaction found for ID {normalized_id}")
        
        return transaction
    
    @staticmethod
    async def search_by_prefix(prefix: str, limit: int = 10) -> list[PawnTransaction]:
        """
        Search transactions by formatted ID prefix for autocomplete.
        
        Args:
            prefix: The prefix to search for (e.g., "PW00")
            limit: Maximum number of results to return
            
        Returns:
            List of matching transactions
        """
        # Normalize prefix (uppercase, strip whitespace)
        normalized_prefix = prefix.upper().strip()
        
        logger.debug(f"🔍 FORMATTED ID: Searching for transactions with prefix {normalized_prefix}")
        
        # Use regex for prefix matching (works with index)
        transactions = await PawnTransaction.find({
            "formatted_id": {"$regex": f"^{normalized_prefix}"}
        }).sort([("formatted_id", 1)]).limit(limit).to_list()
        
        logger.debug(f"✅ FORMATTED ID: Found {len(transactions)} transactions matching prefix {normalized_prefix}")
        
        return transactions
    
    # Extension Formatted ID Methods
    
    
    @staticmethod
    async def get_next_extension_formatted_id() -> str:
        """
        Get the next formatted ID for a new extension.
        
        Returns:
            Next formatted ID like EX000123
        """
        # Find the highest existing formatted ID
        highest_extension = await Extension.find(
            Extension.formatted_id != None
        ).sort([("formatted_id", -1)]).first_or_none()
        
        if highest_extension and highest_extension.formatted_id:
            # Extract number and increment
            highest_num = int(highest_extension.formatted_id[2:])
            next_number = highest_num + 1
        else:
            # First extension
            next_number = 1
        
        formatted_id = f"EX{next_number:06d}"
        logger.debug(f"🏷️ EXTENSION FORMATTED ID: Generated new ID {formatted_id}")
        return formatted_id
    
    @staticmethod
    async def find_extension_by_formatted_id(formatted_id: str) -> Optional[Extension]:
        """
        Find an extension by its formatted ID.
        
        Args:
            formatted_id: The formatted ID like EX000001
            
        Returns:
            Extension if found, None otherwise
        """
        # Normalize the formatted ID (uppercase, strip whitespace)
        normalized_id = formatted_id.upper().strip()
        
        logger.debug(f"🔍 EXTENSION FORMATTED ID: Searching for extension with ID {normalized_id}")
        
        extension = await Extension.find_one(
            Extension.formatted_id == normalized_id
        )
        
        if extension:
            logger.debug(f"✅ EXTENSION FORMATTED ID: Found extension {extension.extension_id[:8]}... for ID {normalized_id}")
        else:
            logger.debug(f"❌ EXTENSION FORMATTED ID: No extension found for ID {normalized_id}")
        
        return extension
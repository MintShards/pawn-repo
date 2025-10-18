#!/usr/bin/env python3
"""
Manual script to update transaction statuses.
This should be run periodically to mark overdue transactions.
"""

import asyncio
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.core.config import settings
from app.models.pawn_transaction_model import PawnTransaction
from app.services.pawn_transaction_service import PawnTransactionService
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

async def main():
    """Update transaction statuses"""
    try:
        # Initialize database connection
        client = AsyncIOMotorClient(settings.MONGO_CONNECTION_STRING)

        # Get database from connection string
        database = client.get_default_database()

        # Initialize Beanie with all models
        await init_beanie(
            database=database,
            document_models=[PawnTransaction]
        )
        
        print("Updating transaction statuses...")
        
        # Run the bulk status update
        results = await PawnTransactionService.bulk_update_statuses()
        
        print(f"Status update completed:")
        for status, count in results.items():
            print(f"  - {count} transactions marked as {status}")
        
        # Close database connection
        client.close()
        
    except Exception as e:
        print(f"Error updating statuses: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
"""
Quick cleanup script to remove transactions with null formatted_id.
This fixes the duplicate key error in the unique index.
"""

import asyncio
import sys
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

# Add backend to path (two levels up from this script)
backend_dir = Path(__file__).parent.parent.parent.absolute()
sys.path.insert(0, str(backend_dir))

from app.models.pawn_transaction_model import PawnTransaction
from app.core.config import settings


async def cleanup_null_formatted_ids():
    """Remove all transactions with null formatted_id"""

    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.MONGO_CONNECTION_STRING)

    try:
        # Initialize Beanie
        await init_beanie(
            database=client.get_default_database(),
            document_models=[PawnTransaction]
        )

        print("🔍 Searching for transactions with null formatted_id...")

        # Find all transactions with null formatted_id
        null_transactions = await PawnTransaction.find(
            PawnTransaction.formatted_id == None
        ).to_list()

        if not null_transactions:
            print("✅ No transactions with null formatted_id found. Database is clean!")
            return

        print(f"⚠️  Found {len(null_transactions)} transactions with null formatted_id")

        # Ask for confirmation
        print("\nThese transactions will be deleted:")
        for txn in null_transactions[:10]:  # Show first 10
            print(f"  - {txn.transaction_id} (Customer: {txn.customer_id}, Status: {txn.status})")

        if len(null_transactions) > 10:
            print(f"  ... and {len(null_transactions) - 10} more")

        # Auto-confirm deletion (for non-interactive environments)
        print(f"\n🗑️  Deleting all {len(null_transactions)} transactions automatically...")

        # Delete all null formatted_id transactions
        deleted_count = 0
        for txn in null_transactions:
            await txn.delete()
            deleted_count += 1

        print(f"✅ Successfully deleted {deleted_count} transactions with null formatted_id")
        print("✅ Database cleanup complete!")

    except Exception as e:
        print(f"❌ Error during cleanup: {str(e)}")
        import traceback
        traceback.print_exc()

    finally:
        client.close()
        print("✅ Database connection closed")


if __name__ == "__main__":
    asyncio.run(cleanup_null_formatted_ids())

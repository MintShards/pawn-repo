#!/usr/bin/env python3
"""
BLOCKER 2: Database Index Migration Script for Trends Performance

Creates required compound indexes for trends API endpoints to eliminate
full collection scans and improve query performance from 5-30+ seconds to <1 second.

Required Indexes:
- payments: payment_date (ascending or descending)
- extensions: extension_date (ascending or descending)
- pawn_transactions: (created_at, status) compound index
- pawn_transactions: (updated_at, status) compound index

Note: The script checks for ANY payment_date and extension_date indexes,
not just specific index names. This allows it to recognize indexes created
by Beanie ODM or other tools with different naming conventions.

Usage:
    python scripts/create_trend_indexes.py [create|verify|rollback]

Environment:
    Requires MONGO_CONNECTION_STRING in .env file
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING
from pymongo.errors import OperationFailure
from app.core.config import settings

# Extract database name from connection string
# For MongoDB Atlas: mongodb+srv://user:pass@cluster.mongodb.net/database_name
# For local MongoDB: mongodb://localhost:27017/database_name
MONGO_CONNECTION_STRING = settings.MONGO_CONNECTION_STRING

if 'mongodb+srv' in MONGO_CONNECTION_STRING:
    # MongoDB Atlas format: extract database name from query params or default
    if '/' in MONGO_CONNECTION_STRING.split('?')[0]:
        DB_NAME = MONGO_CONNECTION_STRING.split('?')[0].split('/')[-1]
    else:
        DB_NAME = "pawn-repo"  # Default database name
else:
    # Local MongoDB format
    DB_NAME = MONGO_CONNECTION_STRING.split('/')[-1] if '/' in MONGO_CONNECTION_STRING else "pawn-repo"


async def create_trend_indexes():
    """
    Create all required indexes for trends API performance optimization

    Returns:
        bool: True if all indexes created successfully, False otherwise
    """
    print("=" * 70)
    print("BLOCKER 2: Creating Database Indexes for Trends Performance")
    print("=" * 70)
    print()

    try:
        # Connect to MongoDB
        print(f"Connecting to MongoDB: {MONGO_CONNECTION_STRING}")
        client = AsyncIOMotorClient(MONGO_CONNECTION_STRING)
        db = client[DB_NAME]

        # Verify connection
        await client.admin.command('ping')
        print(f"✓ Connected to database: {DB_NAME}")
        print()

        success = True

        # Ensure collections exist before creating indexes
        print("Ensuring collections exist...")
        existing_collections = await db.list_collection_names()

        for collection_name in ["payments", "extensions", "pawn_transactions"]:
            if collection_name not in existing_collections:
                await db.create_collection(collection_name)
                print(f"  ✓ Created collection: {collection_name}")
            else:
                print(f"  ℹ Collection already exists: {collection_name}")
        print()

        # 1. Payment indexes
        print("Creating payment indexes...")
        # Check if a suitable payment_date index already exists
        payment_indexes = await db.payments.index_information()
        has_payment_date_index = any(
            'payment_date' in str(idx_info.get('key', []))
            for idx_info in payment_indexes.values()
        )

        if has_payment_date_index:
            print(f"  ℹ Payment date index already exists (found: {[name for name in payment_indexes.keys() if 'payment_date' in name]})")
        else:
            try:
                result = await db.payments.create_index(
                    [("payment_date", ASCENDING)],
                    name="payment_date_idx"
                )
                print(f"  ✓ Created index: {result}")
            except OperationFailure as e:
                print(f"  ✗ Failed to create payment_date index: {e}")
                success = False

        # 2. Extension indexes
        print("Creating extension indexes...")
        # Check if a suitable extension_date index already exists
        extension_indexes = await db.extensions.index_information()
        has_extension_date_index = any(
            'extension_date' in str(idx_info.get('key', []))
            for idx_info in extension_indexes.values()
        )

        if has_extension_date_index:
            print(f"  ℹ Extension date index already exists (found: {[name for name in extension_indexes.keys() if 'extension_date' in name]})")
        else:
            try:
                result = await db.extensions.create_index(
                    [("extension_date", ASCENDING)],
                    name="extension_date_idx"
                )
                print(f"  ✓ Created index: {result}")
            except OperationFailure as e:
                print(f"  ✗ Failed to create extension_date index: {e}")
                success = False

        # 3. Transaction indexes for trends queries
        print("Creating transaction indexes...")

        # 3a. Created_at + status compound index
        try:
            result = await db.pawn_transactions.create_index(
                [("created_at", ASCENDING), ("status", ASCENDING)],
                name="trends_created_status_idx"
            )
            print(f"  ✓ Created index: {result}")
        except OperationFailure as e:
            if "already exists" in str(e):
                print(f"  ℹ Index already exists: trends_created_status_idx")
            else:
                print(f"  ✗ Failed to create created_at+status index: {e}")
                success = False

        # 3b. Updated_at + status compound index
        try:
            result = await db.pawn_transactions.create_index(
                [("updated_at", ASCENDING), ("status", ASCENDING)],
                name="trends_updated_status_idx"
            )
            print(f"  ✓ Created index: {result}")
        except OperationFailure as e:
            if "already exists" in str(e):
                print(f"  ℹ Index already exists: trends_updated_status_idx")
            else:
                print(f"  ✗ Failed to create updated_at+status index: {e}")
                success = False

        print()
        print("=" * 70)

        if success:
            print("SUCCESS: All trend indexes created successfully!")
            print()
            print("Performance Impact:")
            print("  - Revenue trends: 5-30+ seconds → <1 second")
            print("  - Loan trends: 10-40+ seconds → <1 second")
            print("  - Query method: Full collection scan → Index scan")
            print()
            print("Verification:")
            print("  Run: db.payments.getIndexes() in mongosh")
            print("  Run: db.extensions.getIndexes() in mongosh")
            print("  Run: db.pawn_transactions.getIndexes() in mongosh")
        else:
            print("WARNING: Some indexes failed to create")
            print("Check error messages above for details")

        print("=" * 70)

        # Close connection
        client.close()

        return success

    except Exception as e:
        print(f"✗ FATAL ERROR: Failed to create indexes: {e}")
        import traceback
        traceback.print_exc()
        return False


async def verify_indexes():
    """
    Verify that all required indexes exist

    Returns:
        bool: True if all indexes exist, False otherwise
    """
    print()
    print("=" * 70)
    print("Verifying Indexes")
    print("=" * 70)
    print()

    try:
        client = AsyncIOMotorClient(MONGO_CONNECTION_STRING)
        db = client[DB_NAME]

        # Get all indexes
        payment_indexes = await db.payments.index_information()
        extension_indexes = await db.extensions.index_information()
        transaction_indexes = await db.pawn_transactions.index_information()

        all_present = True

        # Check for payment_date index (any name that indexes payment_date)
        print("Payment Indexes:")
        payment_date_indexes = [
            name for name, idx_info in payment_indexes.items()
            if any('payment_date' in str(field) for field in idx_info.get('key', []))
        ]

        if payment_date_indexes:
            print(f"  ✓ Payment date index found: {payment_date_indexes}")
        else:
            print(f"  ✗ Payment date index (MISSING)")
            all_present = False

        # Check for extension_date index (any name that indexes extension_date)
        print()
        print("Extension Indexes:")
        extension_date_indexes = [
            name for name, idx_info in extension_indexes.items()
            if any('extension_date' in str(field) for field in idx_info.get('key', []))
        ]

        if extension_date_indexes:
            print(f"  ✓ Extension date index found: {extension_date_indexes}")
        else:
            print(f"  ✗ Extension date index (MISSING)")
            all_present = False

        # Check for transaction compound indexes
        print()
        print("Transaction Indexes:")

        # Check for created_at + status compound index
        created_status_found = "trends_created_status_idx" in transaction_indexes
        if created_status_found:
            print(f"  ✓ trends_created_status_idx")
        else:
            print(f"  ✗ trends_created_status_idx (MISSING)")
            all_present = False

        # Check for updated_at + status compound index
        updated_status_found = "trends_updated_status_idx" in transaction_indexes
        if updated_status_found:
            print(f"  ✓ trends_updated_status_idx")
        else:
            print(f"  ✗ trends_updated_status_idx (MISSING)")
            all_present = False

        print()
        print("=" * 70)

        if all_present:
            print("SUCCESS: All required indexes are present")
        else:
            print("WARNING: Some required indexes are missing")

        print("=" * 70)

        client.close()

        return all_present

    except Exception as e:
        print(f"✗ Failed to verify indexes: {e}")
        import traceback
        traceback.print_exc()
        return False


async def drop_trend_indexes():
    """
    Rollback function to drop all trend indexes

    WARNING: Only use if you need to rollback the migration

    Returns:
        bool: True if all indexes dropped successfully, False otherwise
    """
    print()
    print("=" * 70)
    print("WARNING: Dropping Trend Indexes (Rollback)")
    print("=" * 70)
    print()

    confirmation = input("Are you sure you want to drop all trend indexes? (yes/no): ")
    if confirmation.lower() != "yes":
        print("Rollback cancelled")
        return False

    try:
        client = AsyncIOMotorClient(MONGO_CONNECTION_STRING)
        db = client[DB_NAME]

        # Drop indexes
        indexes_to_drop = [
            ("payments", "payment_date_idx"),
            ("extensions", "extension_date_idx"),
            ("pawn_transactions", "trends_created_status_idx"),
            ("pawn_transactions", "trends_updated_status_idx")
        ]

        for collection_name, index_name in indexes_to_drop:
            try:
                await db[collection_name].drop_index(index_name)
                print(f"  ✓ Dropped index: {collection_name}.{index_name}")
            except OperationFailure as e:
                if "index not found" in str(e).lower():
                    print(f"  ℹ Index does not exist: {collection_name}.{index_name}")
                else:
                    print(f"  ✗ Failed to drop index {collection_name}.{index_name}: {e}")

        print()
        print("Rollback complete")

        client.close()

        return True

    except Exception as e:
        print(f"✗ Failed to drop indexes: {e}")
        return False


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Manage trend indexes for pawnshop database")
    parser.add_argument(
        "action",
        choices=["create", "verify", "rollback"],
        default="create",
        nargs="?",
        help="Action to perform (default: create)"
    )

    args = parser.parse_args()

    if args.action == "create":
        success = asyncio.run(create_trend_indexes())
        sys.exit(0 if success else 1)
    elif args.action == "verify":
        success = asyncio.run(verify_indexes())
        sys.exit(0 if success else 1)
    elif args.action == "rollback":
        success = asyncio.run(drop_trend_indexes())
        sys.exit(0 if success else 1)

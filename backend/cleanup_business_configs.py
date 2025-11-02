"""
Database cleanup script for business configuration collections.

This script ensures that only ONE document per config type has is_active=True.
It keeps the newest document active and deactivates all others.

Run this if you ever suspect multiple active configs exist.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_CONNECTION_STRING")
DB_NAME = "pawn-repo"

COLLECTIONS = [
    "company_config",
    "financial_policy_config",
    "forfeiture_config",
    "printer_config"
]


async def cleanup_collection(db, collection_name):
    """Ensure only the newest document in a collection is active"""
    collection = db[collection_name]

    # Get all documents sorted by updated_at descending
    all_docs = await collection.find({}).sort("updated_at", -1).to_list(length=1000)

    if not all_docs:
        print(f"  ✓ {collection_name}: No documents found")
        return

    # Count active documents
    active_count = sum(1 for doc in all_docs if doc.get("is_active", False))

    if active_count == 0:
        # No active documents - activate the newest one
        newest_id = all_docs[0]["_id"]
        await collection.update_one(
            {"_id": newest_id},
            {"$set": {"is_active": True, "updated_at": datetime.utcnow()}}
        )
        print(f"  ✓ {collection_name}: Activated newest document (was 0 active)")
        return

    if active_count == 1 and all_docs[0].get("is_active", False):
        # Perfect state - newest is active, others are not
        print(f"  ✓ {collection_name}: Already clean (1 active, newest)")
        return

    # Multiple active or wrong one active - fix it
    newest_id = all_docs[0]["_id"]

    # Deactivate all documents
    await collection.update_many(
        {},
        {"$set": {"is_active": False}}
    )

    # Activate only the newest one
    await collection.update_one(
        {"_id": newest_id},
        {"$set": {"is_active": True, "updated_at": datetime.utcnow()}}
    )

    print(f"  ✓ {collection_name}: Fixed! Deactivated {active_count} active docs, activated newest")


async def main():
    """Main cleanup function"""
    print("🧹 Starting business config cleanup...\n")

    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    try:
        for collection_name in COLLECTIONS:
            print(f"Checking {collection_name}...")
            await cleanup_collection(db, collection_name)

        print("\n✅ Cleanup complete!")

    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())

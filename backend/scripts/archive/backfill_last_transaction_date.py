"""
Backfill last_transaction_date for all customers based on their most recent transaction.
This script updates customers who have transactions but missing last_transaction_date.
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from decouple import config

# MongoDB connection
MONGO_CONNECTION_STRING = config("MONGO_CONNECTION_STRING")


async def backfill_last_transaction_dates():
    """Backfill last_transaction_date for all customers"""

    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_CONNECTION_STRING)
    db = client.get_default_database()

    print("🔄 Starting backfill of last_transaction_date...")
    print("=" * 60)

    # Aggregation pipeline to find customers with transactions
    pipeline = [
        {
            "$lookup": {
                "from": "pawn_transactions",
                "localField": "phone_number",
                "foreignField": "customer_id",
                "as": "transactions"
            }
        },
        {
            "$match": {
                "transactions": {"$ne": []}
            }
        },
        {
            "$project": {
                "phone_number": 1,
                "first_name": 1,
                "last_name": 1,
                "last_transaction_date": 1,
                "transactions": {
                    "$map": {
                        "input": "$transactions",
                        "as": "t",
                        "in": {
                            "pawn_date": "$$t.pawn_date",
                            "transaction_id": "$$t.transaction_id"
                        }
                    }
                }
            }
        }
    ]

    customers_cursor = db.customers.aggregate(pipeline)
    customers = await customers_cursor.to_list(None)

    print(f"📊 Found {len(customers)} customers with transactions")
    print()

    updated_count = 0
    already_correct_count = 0

    for customer in customers:
        phone = customer["phone_number"]
        name = f"{customer['first_name']} {customer['last_name']}"
        current_last_date = customer.get("last_transaction_date")

        # Find most recent transaction date
        transactions = customer["transactions"]
        if not transactions:
            continue

        # Sort by pawn_date descending to get most recent
        sorted_transactions = sorted(
            transactions,
            key=lambda x: x["pawn_date"],
            reverse=True
        )
        most_recent_date = sorted_transactions[0]["pawn_date"]

        # Check if update needed
        if current_last_date != most_recent_date:
            # Update customer
            await db.customers.update_one(
                {"phone_number": phone},
                {"$set": {"last_transaction_date": most_recent_date}}
            )
            updated_count += 1
            print(f"✅ Updated {name} ({phone})")
            print(f"   Old: {current_last_date}")
            print(f"   New: {most_recent_date}")
        else:
            already_correct_count += 1

    print()
    print("=" * 60)
    print(f"✅ Backfill complete!")
    print(f"   Updated: {updated_count} customers")
    print(f"   Already correct: {already_correct_count} customers")
    print(f"   Total processed: {len(customers)} customers")

    # Verify results
    print()
    print("🔍 Verification:")
    with_date = await db.customers.count_documents(
        {"last_transaction_date": {"$exists": True, "$ne": None}}
    )
    without_date = await db.customers.count_documents(
        {"last_transaction_date": {"$exists": False}}
    ) + await db.customers.count_documents(
        {"last_transaction_date": None}
    )

    print(f"   Customers with last_transaction_date: {with_date}")
    print(f"   Customers without last_transaction_date: {without_date}")

    client.close()


if __name__ == "__main__":
    asyncio.run(backfill_last_transaction_dates())

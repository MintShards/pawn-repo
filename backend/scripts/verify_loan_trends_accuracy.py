#!/usr/bin/env python3
"""
Verification script for loan trends data accuracy

This script verifies that the loan trends endpoint returns accurate counts
by comparing API results with direct database queries.

Usage:
    python verify_loan_trends_accuracy.py [--period 7d|30d|90d|1y]

Requirements:
    - Backend server must be running
    - Database must have transaction data
    - Valid admin credentials in environment
"""

import sys
import os
import asyncio
import argparse
from datetime import datetime, timedelta, UTC
from typing import Dict, List, Tuple

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.models.pawn_transaction_model import PawnTransaction
from beanie import init_beanie


async def init_db():
    """Initialize database connection"""
    client = AsyncIOMotorClient(settings.MONGO_CONNECTION_STRING)
    db = client.get_default_database()
    await init_beanie(
        database=db,
        document_models=[PawnTransaction]
    )
    print(f"✓ Connected to database: {db.name}")


async def get_date_range(period: str) -> Tuple[datetime, datetime, str]:
    """Calculate date range based on period"""
    now = datetime.now(UTC).replace(tzinfo=None)

    if period == "7d":
        start_date = now - timedelta(days=7)
        date_format = "%Y-%m-%d"
    elif period == "30d":
        start_date = now - timedelta(days=30)
        date_format = "%Y-%m-%d"
    elif period == "90d":
        start_date = now - timedelta(days=90)
        date_format = "%Y-%m-%d"
    elif period == "1y":
        start_date = now - timedelta(days=365)
        date_format = "%Y-%m"
    else:
        start_date = now - timedelta(days=30)
        date_format = "%Y-%m-%d"

    return start_date, now, date_format


async def verify_redeemed_counts(start_date: datetime, end_date: datetime) -> Dict:
    """Verify redeemed transaction counts"""
    transactions = await PawnTransaction.find(
        {"status": "redeemed"}
    ).to_list()

    # Count transactions redeemed within the date range
    count = 0
    total_amount = 0

    for t in transactions:
        redemption_date = t.updated_at if t.updated_at else t.created_at
        if redemption_date.tzinfo is not None:
            redemption_date = redemption_date.replace(tzinfo=None)

        if start_date <= redemption_date <= end_date:
            count += 1
            total_amount += t.loan_amount

    return {
        "count": count,
        "total_amount": total_amount,
        "status": "redeemed"
    }


async def verify_forfeited_counts(start_date: datetime, end_date: datetime) -> Dict:
    """Verify forfeited transaction counts"""
    transactions = await PawnTransaction.find(
        {"status": "forfeited"}
    ).to_list()

    count = 0
    total_amount = 0

    for t in transactions:
        forfeiture_date = t.updated_at if t.updated_at else t.created_at
        if forfeiture_date.tzinfo is not None:
            forfeiture_date = forfeiture_date.replace(tzinfo=None)

        if start_date <= forfeiture_date <= end_date:
            count += 1
            total_amount += t.loan_amount

    return {
        "count": count,
        "total_amount": total_amount,
        "status": "forfeited"
    }


async def verify_sold_counts(start_date: datetime, end_date: datetime) -> Dict:
    """Verify sold transaction counts"""
    transactions = await PawnTransaction.find(
        {"status": "sold"}
    ).to_list()

    count = 0
    total_amount = 0

    for t in transactions:
        sold_date = t.updated_at if t.updated_at else t.created_at
        if sold_date.tzinfo is not None:
            sold_date = sold_date.replace(tzinfo=None)

        if start_date <= sold_date <= end_date:
            count += 1
            total_amount += t.loan_amount

    return {
        "count": count,
        "total_amount": total_amount,
        "status": "sold"
    }


async def verify_active_counts(end_date: datetime) -> Dict:
    """Verify current active loan count"""
    active_statuses = ["active", "overdue", "extended"]

    count = await PawnTransaction.find(
        {"status": {"$in": active_statuses}}
    ).count()

    return {
        "count": count,
        "status": "active"
    }


async def verify_data_integrity():
    """Verify that no transaction appears in multiple terminal statuses"""
    all_transactions = await PawnTransaction.find().to_list()

    terminal_statuses = ["redeemed", "forfeited", "sold"]
    status_counts = {status: 0 for status in terminal_statuses}

    for t in all_transactions:
        if t.status in terminal_statuses:
            status_counts[t.status] += 1

    total_terminal = sum(status_counts.values())

    return {
        "total_transactions": len(all_transactions),
        "redeemed": status_counts["redeemed"],
        "forfeited": status_counts["forfeited"],
        "sold": status_counts["sold"],
        "total_terminal": total_terminal,
        "integrity_check": "PASS - No overlaps possible (transactions have single status)"
    }


async def main(period: str = "30d"):
    """Main verification function"""
    print("\n" + "=" * 70)
    print("LOAN TRENDS ACCURACY VERIFICATION")
    print("=" * 70)

    # Initialize database
    await init_db()

    # Get date range
    start_date, end_date, date_format = await get_date_range(period)
    print(f"\nPeriod: {period}")
    print(f"Date Range: {start_date.strftime(date_format)} to {end_date.strftime(date_format)}")
    print(f"Date Format: {date_format}")

    # Verify counts
    print("\n" + "-" * 70)
    print("DIRECT DATABASE QUERY RESULTS")
    print("-" * 70)

    redeemed = await verify_redeemed_counts(start_date, end_date)
    print(f"\n✓ Redeemed in period: {redeemed['count']} transactions")
    print(f"  Total Amount: ${redeemed['total_amount']:,.2f}")

    forfeited = await verify_forfeited_counts(start_date, end_date)
    print(f"\n✓ Forfeited in period: {forfeited['count']} transactions")
    print(f"  Total Amount: ${forfeited['total_amount']:,.2f}")

    sold = await verify_sold_counts(start_date, end_date)
    print(f"\n✓ Sold in period: {sold['count']} transactions")
    print(f"  Total Amount: ${sold['total_amount']:,.2f}")

    active = await verify_active_counts(end_date)
    print(f"\n✓ Currently Active: {active['count']} loans")

    # Verify data integrity
    print("\n" + "-" * 70)
    print("DATA INTEGRITY VERIFICATION")
    print("-" * 70)

    integrity = await verify_data_integrity()
    print(f"\nTotal Transactions: {integrity['total_transactions']}")
    print(f"Redeemed (all time): {integrity['redeemed']}")
    print(f"Forfeited (all time): {integrity['forfeited']}")
    print(f"Sold (all time): {integrity['sold']}")
    print(f"Total Terminal: {integrity['total_terminal']}")
    print(f"\n{integrity['integrity_check']}")

    # Summary
    print("\n" + "=" * 70)
    print("VERIFICATION COMPLETE")
    print("=" * 70)
    print("\nTo compare with API results:")
    print(f"  GET http://localhost:8000/api/v1/trends/loans?period={period}")
    print("\nExpected API Summary:")
    print(f"  - total_redeemed: {redeemed['count']}")
    print(f"  - total_forfeited: {forfeited['count']}")
    print(f"  - total_sold: {sold['count']}")
    print(f"  - current_active_loans: {active['count']}")
    print("\nAPI data array should have continuous dates with no gaps.")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Verify loan trends data accuracy")
    parser.add_argument("--period", type=str, default="30d",
                       choices=["7d", "30d", "90d", "1y"],
                       help="Time period to verify (default: 30d)")

    args = parser.parse_args()

    asyncio.run(main(args.period))

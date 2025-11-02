"""
Credit Limit Migration Script - Convert to Dynamic System Default

This script migrates existing customers from hardcoded $3,000 credit limits
to the new dynamic system where credit_limit = None means "use Financial
Policy system default".

IMPORTANT: Run this AFTER deploying the code changes that support null credit_limit.

Usage:
    python migrate_credit_limits_to_dynamic.py [--dry-run] [--default-value 3000]

Options:
    --dry-run: Show what would be changed without making actual changes
    --default-value: Specify which credit limit value to convert to None (default: 3000)
"""

import asyncio
import sys
from decimal import Decimal
from typing import List
import argparse

# Add parent directory to path for imports
sys.path.insert(0, '.')

from app.core.database import init_db
from app.models.customer_model import Customer
from app.models.business_config_model import FinancialPolicyConfig


async def get_current_financial_policy_default() -> Decimal:
    """Get the current Financial Policy default credit limit."""
    try:
        financial_config = await FinancialPolicyConfig.get_current_config()
        if financial_config and financial_config.customer_credit_limit:
            return Decimal(str(financial_config.customer_credit_limit))
    except Exception as e:
        print(f"⚠️  Warning: Could not fetch Financial Policy config: {e}")

    return Decimal("3000.00")  # Fallback


async def find_customers_to_migrate(target_value: Decimal) -> List[Customer]:
    """
    Find customers with credit_limit matching the target value.

    Args:
        target_value: Credit limit value to search for (e.g., 3000.00)

    Returns:
        List of customers with matching credit limit
    """
    customers = await Customer.find(
        Customer.credit_limit == target_value
    ).to_list()

    return customers


async def migrate_customer_credit_limits(
    dry_run: bool = False,
    target_value: Decimal = Decimal("3000.00")
) -> dict:
    """
    Migrate customers from hardcoded credit limit to dynamic system default.

    Args:
        dry_run: If True, show what would be changed without making changes
        target_value: Credit limit value to convert to None

    Returns:
        Dictionary with migration statistics
    """
    stats = {
        "total_customers": 0,
        "customers_to_migrate": 0,
        "migrated": 0,
        "skipped": 0,
        "errors": 0
    }

    print("\n" + "=" * 80)
    print("CREDIT LIMIT MIGRATION - Convert to Dynamic System Default")
    print("=" * 80)

    # Get current Financial Policy default
    financial_default = await get_current_financial_policy_default()
    print(f"\n📋 Current Financial Policy Default: ${financial_default:,.2f}")

    if dry_run:
        print("\n🔍 DRY RUN MODE - No changes will be made")

    # Get total customer count
    stats["total_customers"] = await Customer.count()
    print(f"📊 Total Customers: {stats['total_customers']:,}")

    # Find customers to migrate
    print(f"\n🔎 Searching for customers with credit_limit = ${target_value:,.2f}...")
    customers_to_migrate = await find_customers_to_migrate(target_value)
    stats["customers_to_migrate"] = len(customers_to_migrate)

    if stats["customers_to_migrate"] == 0:
        print(f"✅ No customers found with credit_limit = ${target_value:,.2f}")
        print("   All customers are either using custom limits or already migrated.")
        return stats

    print(f"📦 Found {stats['customers_to_migrate']:,} customers to migrate")
    print(f"\n   Converting credit_limit from ${target_value:,.2f} → None (system default)")

    if not dry_run:
        confirm = input(f"\n⚠️  This will update {stats['customers_to_migrate']:,} customer records. Continue? (yes/no): ")
        if confirm.lower() != 'yes':
            print("❌ Migration cancelled by user")
            return stats

    print("\n🔄 Migration Progress:")
    print("-" * 80)

    for i, customer in enumerate(customers_to_migrate, 1):
        try:
            customer_name = f"{customer.first_name} {customer.last_name}"
            phone = customer.phone_number

            if dry_run:
                print(f"[{i:4d}/{stats['customers_to_migrate']:4d}] Would migrate: {customer_name} ({phone})")
                stats["migrated"] += 1
            else:
                # Set credit_limit to None to use system default
                customer.credit_limit = None
                await customer.save()

                stats["migrated"] += 1
                if i % 10 == 0 or i == stats["customers_to_migrate"]:
                    print(f"[{i:4d}/{stats['customers_to_migrate']:4d}] Migrated: {customer_name} ({phone})")

        except Exception as e:
            stats["errors"] += 1
            print(f"❌ Error migrating {customer.phone_number}: {str(e)}")

    print("-" * 80)
    print("\n✅ Migration Complete!")
    print(f"\n📊 Migration Statistics:")
    print(f"   Total Customers: {stats['total_customers']:,}")
    print(f"   Customers to Migrate: {stats['customers_to_migrate']:,}")
    print(f"   Successfully Migrated: {stats['migrated']:,}")
    print(f"   Errors: {stats['errors']:,}")

    if not dry_run and stats["migrated"] > 0:
        print(f"\n🎯 Result:")
        print(f"   {stats['migrated']:,} customers now use dynamic system default (${financial_default:,.2f})")
        print(f"   Updating Financial Policy default will now affect these customers")

    if dry_run:
        print(f"\n💡 To apply these changes, run without --dry-run flag")

    return stats


async def verify_migration():
    """Verify migration results."""
    print("\n" + "=" * 80)
    print("MIGRATION VERIFICATION")
    print("=" * 80)

    # Count customers using system default (credit_limit = None)
    system_default_count = await Customer.find(
        Customer.credit_limit == None  # noqa: E711
    ).count()

    # Count customers with custom limits
    custom_limit_count = await Customer.find(
        Customer.credit_limit != None  # noqa: E711
    ).count()

    total_count = await Customer.count()

    print(f"\n📊 Current State:")
    print(f"   Total Customers: {total_count:,}")
    print(f"   Using System Default (credit_limit = None): {system_default_count:,}")
    print(f"   Using Custom Limits: {custom_limit_count:,}")

    if system_default_count > 0:
        financial_default = await get_current_financial_policy_default()
        print(f"\n✅ {system_default_count:,} customers will dynamically use ${financial_default:,.2f}")
        print(f"   (from Financial Policy configuration)")

    print("\n" + "=" * 80)


async def main():
    """Main migration function."""
    parser = argparse.ArgumentParser(
        description="Migrate customer credit limits to dynamic system default"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be changed without making actual changes"
    )
    parser.add_argument(
        "--default-value",
        type=float,
        default=3000.0,
        help="Credit limit value to convert to None (default: 3000)"
    )
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Only verify current state without migrating"
    )

    args = parser.parse_args()

    # Initialize database connection
    print("🔌 Connecting to database...")
    await init_db()
    print("✅ Database connected")

    if args.verify_only:
        await verify_migration()
        return

    # Run migration
    target_value = Decimal(str(args.default_value))
    stats = await migrate_customer_credit_limits(
        dry_run=args.dry_run,
        target_value=target_value
    )

    # Verify results if migration was successful
    if not args.dry_run and stats["migrated"] > 0:
        await verify_migration()


if __name__ == "__main__":
    asyncio.run(main())

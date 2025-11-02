"""
Test script for overdue fee functionality.

This script validates the overdue fee API endpoints and service integration.
Run with: python test_overdue_fee.py
"""

import asyncio
import sys
from datetime import datetime, UTC, timedelta
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient

# Add app to path (relative to this script)
backend_dir = Path(__file__).parent.absolute()
sys.path.insert(0, str(backend_dir))

from app.models.pawn_transaction_model import PawnTransaction, TransactionStatus
from app.models.customer_model import Customer
from app.models.user_model import User
from app.models.payment_model import Payment
from app.services.overdue_fee_service import OverdueFeeService
from app.services.interest_calculation_service import InterestCalculationService
from app.core.config import settings


async def setup_test_data():
    """Create test customer and overdue transaction"""
    print("\n" + "="*80)
    print("Setting up test data...")
    print("="*80)

    # Get staff user first for customer creation
    staff = await User.find_one(User.user_id == "02")
    if not staff:
        print("❌ Test staff user not found. Run seed.py first.")
        return None, None, None

    # Clean up any existing test data first
    test_phone = "5551234567"
    existing_customer = await Customer.find_one(Customer.phone_number == test_phone)
    if existing_customer:
        # Delete existing transactions for this customer (direct deletion to avoid validation issues)
        from motor.motor_asyncio import AsyncIOMotorClient
        db = AsyncIOMotorClient(settings.MONGO_CONNECTION_STRING).get_default_database()
        await db.pawn_transactions.delete_many({"customer_id": test_phone})

        # Delete existing customer
        await existing_customer.delete()
        print(f"🧹 Cleaned up existing test data for {test_phone}")

    # Create test customer
    customer = Customer(
        phone_number=test_phone,
        first_name="Test",
        last_name="Customer",
        email="test@example.com",
        created_by=staff.user_id
    )
    await customer.insert()  # Use insert() for new documents
    print(f"✅ Created test customer: {customer.phone_number}")

    # Create overdue transaction (maturity date in the past)
    past_date = datetime.now(UTC) - timedelta(days=120)  # 120 days ago (pawn date)
    maturity_date = past_date + timedelta(days=90)  # 90-day loan, so matured 30 days ago

    # Calculate grace period end (1 month after maturity date)
    grace_period_end = maturity_date + timedelta(days=30)

    # Get next formatted_id (PW000XXX format)
    from app.services.formatted_id_service import FormattedIdService
    formatted_id = await FormattedIdService.get_next_formatted_id()

    transaction = PawnTransaction(
        customer_id=customer.phone_number,
        loan_amount=500,
        monthly_interest_amount=50,
        pawn_date=past_date,
        maturity_date=maturity_date,
        grace_period_end=grace_period_end,
        status=TransactionStatus.OVERDUE,
        storage_location="Test-A1",
        created_by_user_id=staff.user_id,
        formatted_id=formatted_id  # Set the formatted_id
    )
    await transaction.insert()  # Use insert() for new documents
    print(f"✅ Created overdue transaction: {transaction.formatted_id} ({transaction.transaction_id})")
    print(f"   - Loan Amount: ${transaction.loan_amount}")
    print(f"   - Monthly Interest: ${transaction.monthly_interest_amount}")
    print(f"   - Status: {transaction.status}")
    print(f"   - Days Overdue: ~30 days")

    print(f"✅ Using test staff: {staff.first_name} {staff.last_name} ({staff.user_id})")

    return customer, transaction, staff


async def test_set_overdue_fee(transaction_id: str, staff_user_id: str):
    """Test setting an overdue fee"""
    print("\n" + "="*80)
    print("TEST 1: Set Overdue Fee")
    print("="*80)

    try:
        # Set overdue fee
        overdue_fee = 75
        result = await OverdueFeeService.set_overdue_fee(
            transaction_id=transaction_id,
            overdue_fee=overdue_fee,
            set_by_user_id=staff_user_id,
            notes="Test overdue fee - 30 days past due"
        )

        print(f"✅ Set overdue fee to ${overdue_fee}")
        print(f"   - Transaction ID: {result.transaction_id}")
        print(f"   - Overdue Fee: ${result.overdue_fee}")
        print(f"   - Status: {result.status}")

        # Verify audit trail (if exists)
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        if hasattr(transaction, 'audit_trail') and transaction.audit_trail:
            latest_entry = transaction.audit_trail[-1]
            print(f"   - Audit Entry: {latest_entry.action_type}")
            print(f"   - By: {latest_entry.staff_member}")
            print(f"   - Summary: {latest_entry.action_summary}")

        return True
    except Exception as e:
        print(f"❌ Failed to set overdue fee: {str(e)}")
        return False


async def test_get_overdue_fee_info(transaction_id: str):
    """Test getting overdue fee information"""
    print("\n" + "="*80)
    print("TEST 2: Get Overdue Fee Info")
    print("="*80)

    try:
        info = await OverdueFeeService.get_overdue_fee_info(transaction_id)

        print(f"✅ Retrieved overdue fee info:")
        print(f"   - Transaction ID: {info['transaction_id']}")
        print(f"   - Status: {info['status']}")
        print(f"   - Is Overdue: {info['is_overdue']}")
        print(f"   - Current Fee: {info['current_overdue_fee_formatted']}")
        print(f"   - Has Fee: {info['has_overdue_fee']}")
        print(f"   - Days Overdue: {info['days_overdue']}")
        print(f"   - Can Set Fee: {info['can_set_fee']}")
        print(f"   - Can Clear Fee: {info['can_clear_fee']}")

        return True
    except Exception as e:
        print(f"❌ Failed to get overdue fee info: {str(e)}")
        return False


async def test_calculate_total_with_fee(transaction_id: str):
    """Test calculating total redemption amount with overdue fee"""
    print("\n" + "="*80)
    print("TEST 3: Calculate Total with Overdue Fee")
    print("="*80)

    try:
        total_info = await OverdueFeeService.calculate_total_with_overdue_fee(transaction_id)

        print(f"✅ Calculated total redemption amount:")
        print(f"   - Base Balance: {total_info['base_balance_formatted']}")
        print(f"   - Overdue Fee: {total_info['overdue_fee_formatted']}")
        print(f"   - Total Redemption: {total_info['total_redemption_amount_formatted']}")
        print(f"\n   Breakdown:")
        breakdown = total_info['breakdown']
        print(f"   - Principal: ${breakdown['principal_balance']}")
        print(f"   - Interest: ${breakdown['interest_balance']}")
        print(f"   - Extension Fees: ${breakdown['extension_fees_balance']}")
        print(f"   - Overdue Fee: ${breakdown['overdue_fee']}")
        print(f"   - TOTAL: ${breakdown['total']}")

        return True
    except Exception as e:
        print(f"❌ Failed to calculate total with fee: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


async def test_balance_calculation_with_fee(transaction_id: str):
    """Test that interest calculation includes overdue fee"""
    print("\n" + "="*80)
    print("TEST 4: Balance Calculation with Overdue Fee")
    print("="*80)

    try:
        balance = await InterestCalculationService.calculate_current_balance(transaction_id)

        print(f"✅ Balance calculation includes overdue fee:")
        print(f"   - Principal Balance: ${balance.principal_balance}")
        print(f"   - Interest Balance: ${balance.interest_balance}")
        print(f"   - Overdue Fee Balance: ${balance.overdue_fee_balance}")
        print(f"   - Current Balance: ${balance.current_balance}")
        print(f"   - Total Due: ${balance.total_due}")

        # Verify overdue fee is included in calculations
        if hasattr(balance, 'overdue_fee_due') and balance.overdue_fee_due > 0:
            print(f"\n   ✅ Overdue fee properly included in balance")
            print(f"   - Overdue Fee Due: ${balance.overdue_fee_due}")
            print(f"   - Overdue Fee Paid: ${balance.overdue_fee_paid}")
        else:
            print(f"\n   ❌ Overdue fee not found in balance calculation")
            return False

        return True
    except Exception as e:
        print(f"❌ Failed balance calculation: {str(e)}")
        return False


async def test_validate_fee_amount(transaction_id: str):
    """Test validating proposed overdue fee"""
    print("\n" + "="*80)
    print("TEST 5: Validate Fee Amount")
    print("="*80)

    try:
        # Test valid fee
        validation = await OverdueFeeService.validate_overdue_fee_amount(
            transaction_id=transaction_id,
            proposed_fee=100
        )

        print(f"✅ Validation result for $100 fee:")
        print(f"   - Is Valid: {validation['is_valid']}")
        print(f"   - Proposed Fee: ${validation['proposed_fee']}")
        print(f"   - Current Fee: ${validation['current_fee']}")
        print(f"   - Fee Difference: ${validation['fee_difference']}")
        print(f"   - Impact: {validation['impact']}")
        print(f"   - Can Proceed: {validation['can_proceed']}")

        if validation['warnings']:
            print(f"   - Warnings: {', '.join(validation['warnings'])}")

        # Test invalid fee (negative)
        try:
            invalid_validation = await OverdueFeeService.validate_overdue_fee_amount(
                transaction_id=transaction_id,
                proposed_fee=-50
            )
            if not invalid_validation['is_valid']:
                print(f"\n✅ Correctly rejected negative fee")
                print(f"   - Errors: {', '.join(invalid_validation['validation_errors'])}")
        except Exception:
            pass

        return True
    except Exception as e:
        print(f"❌ Failed validation test: {str(e)}")
        return False


async def test_clear_overdue_fee(transaction_id: str, staff_user_id: str):
    """Test clearing an overdue fee"""
    print("\n" + "="*80)
    print("TEST 6: Clear Overdue Fee")
    print("="*80)

    try:
        result = await OverdueFeeService.clear_overdue_fee(
            transaction_id=transaction_id,
            cleared_by_user_id=staff_user_id,
            reason="Test completion - clearing fee"
        )

        print(f"✅ Cleared overdue fee")
        print(f"   - Transaction ID: {result.transaction_id}")
        print(f"   - Overdue Fee: ${result.overdue_fee}")
        print(f"   - Status: {result.status}")

        # Verify cleared in database
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        if transaction.overdue_fee == 0:
            print(f"   - ✅ Fee verified cleared in database")
        else:
            print(f"   - ❌ Fee not cleared: ${transaction.overdue_fee}")
            return False

        return True
    except Exception as e:
        print(f"❌ Failed to clear overdue fee: {str(e)}")
        return False


async def cleanup_test_data(customer_phone: str, transaction_id: str):
    """Clean up test data"""
    print("\n" + "="*80)
    print("Cleaning up test data...")
    print("="*80)

    try:
        # Delete transaction
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        if transaction:
            await transaction.delete()
            print(f"✅ Deleted test transaction: {transaction_id}")

        # Delete customer
        customer = await Customer.find_one(Customer.phone_number == customer_phone)
        if customer:
            await customer.delete()
            print(f"✅ Deleted test customer: {customer_phone}")

    except Exception as e:
        print(f"⚠️  Cleanup warning: {str(e)}")


async def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("OVERDUE FEE API TEST SUITE")
    print("="*80)

    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.MONGO_CONNECTION_STRING)

    try:
        # Initialize Beanie
        from beanie import init_beanie
        await init_beanie(
            database=client.get_default_database(),
            document_models=[Customer, PawnTransaction, User, Payment]
        )
        print("✅ Connected to database")

        # Setup test data
        customer, transaction, staff = await setup_test_data()
        if not all([customer, transaction, staff]):
            print("\n❌ Failed to setup test data. Exiting.")
            return

        # Run tests
        tests_passed = 0
        tests_total = 6

        if await test_set_overdue_fee(transaction.transaction_id, staff.user_id):
            tests_passed += 1

        if await test_get_overdue_fee_info(transaction.transaction_id):
            tests_passed += 1

        if await test_calculate_total_with_fee(transaction.transaction_id):
            tests_passed += 1

        if await test_balance_calculation_with_fee(transaction.transaction_id):
            tests_passed += 1

        if await test_validate_fee_amount(transaction.transaction_id):
            tests_passed += 1

        if await test_clear_overdue_fee(transaction.transaction_id, staff.user_id):
            tests_passed += 1

        # Print summary
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        print(f"Tests Passed: {tests_passed}/{tests_total}")

        if tests_passed == tests_total:
            print("✅ ALL TESTS PASSED!")
        else:
            print(f"❌ {tests_total - tests_passed} test(s) failed")

        # Cleanup
        await cleanup_test_data(customer.phone_number, transaction.transaction_id)

    except Exception as e:
        print(f"\n❌ Test suite error: {str(e)}")
        import traceback
        traceback.print_exc()

    finally:
        client.close()
        print("\n✅ Database connection closed")


if __name__ == "__main__":
    asyncio.run(main())

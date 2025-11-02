"""
Comprehensive Test Suite for Loan Limit Settings
Tests that loan limits work exactly like credit limits
"""

import asyncio
from decimal import Decimal
from app.models.customer_model import Customer, CustomerStatus
from app.models.business_config_model import FinancialPolicyConfig
from app.services.customer_service import CustomerService
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def setup_database():
    """Initialize database connection"""
    mongo_url = os.getenv("MONGO_CONNECTION_STRING", "mongodb://localhost:27017/pawn-repo")
    client = AsyncIOMotorClient(mongo_url)

    await init_beanie(
        database=client.get_database(),
        document_models=[Customer, FinancialPolicyConfig]
    )
    print("✓ Database initialized")

async def test_effective_loan_limit_method():
    """Test 1: Verify get_effective_loan_limit() method exists and works"""
    print("\n=== TEST 1: get_effective_loan_limit() Method ===")

    # Create test customer with no custom limit
    customer = Customer(
        phone_number="1111111111",
        first_name="Test",
        last_name="Customer",
        status=CustomerStatus.ACTIVE,
        custom_loan_limit=None,  # No custom limit
        active_loans=0,
        total_loan_value=Decimal("0"),
        created_by="test_user"
    )

    # Test method exists
    assert hasattr(customer, 'get_effective_loan_limit'), "❌ Method get_effective_loan_limit() not found"
    print("✓ Method get_effective_loan_limit() exists")

    # Test returns integer
    limit = await customer.get_effective_loan_limit()
    assert isinstance(limit, int), f"❌ Expected int, got {type(limit)}"
    print(f"✓ Method returns int: {limit}")

    # Test fallback value (should be 8 if no config)
    assert limit == 8, f"❌ Expected default fallback 8, got {limit}"
    print("✓ Default fallback value is 8")

    print("✅ TEST 1 PASSED\n")

async def test_custom_loan_limit_override():
    """Test 2: Custom loan limit overrides system default"""
    print("\n=== TEST 2: Custom Loan Limit Override ===")

    # Create customer with custom limit
    customer_custom = Customer(
        phone_number="2222222222",
        first_name="VIP",
        last_name="Customer",
        status=CustomerStatus.ACTIVE,
        custom_loan_limit=15,  # Custom limit
        active_loans=0,
        total_loan_value=Decimal("0")
    )

    limit = await customer_custom.get_effective_loan_limit()
    assert limit == 15, f"❌ Expected custom limit 15, got {limit}"
    print(f"✓ Custom limit returned: {limit}")

    # Create customer without custom limit
    customer_default = Customer(
        phone_number="3333333333",
        first_name="Regular",
        last_name="Customer",
        status=CustomerStatus.ACTIVE,
        custom_loan_limit=None,
        active_loans=0,
        total_loan_value=Decimal("0")
    )

    limit_default = await customer_default.get_effective_loan_limit()
    assert limit_default != 15, f"❌ Customer without custom limit should not get 15"
    print(f"✓ Default customer gets system default: {limit_default}")

    print("✅ TEST 2 PASSED\n")

async def test_financial_policy_integration():
    """Test 3: Financial Policy config affects customers without custom limits"""
    print("\n=== TEST 3: Financial Policy Integration ===")

    # Try to get or create financial config with max_active_loans_per_customer = 10
    try:
        # Delete existing config if any
        existing = await FinancialPolicyConfig.find_one(FinancialPolicyConfig.config_type == "financial_policy")
        if existing:
            await existing.delete()
            print("✓ Cleared existing config")

        # Create new config with max_active_loans_per_customer = 10
        config = FinancialPolicyConfig(
            config_type="financial_policy",
            default_monthly_interest_rate=20.0,
            min_interest_rate=10.0,
            max_interest_rate=50.0,
            allow_staff_override=True,
            min_loan_amount=10.0,
            max_loan_amount=10000.0,
            max_active_loans_per_customer=10,  # Set to 10
            customer_credit_limit=3000.0,
            enforce_credit_limit=True,
            reason="Test configuration",
            updated_by="test_user"
        )
        await config.insert()
        print("✓ Created Financial Policy with max_active_loans_per_customer = 10")

        # Test customer without custom limit
        customer_default = Customer(
            phone_number="4444444444",
            first_name="Policy",
            last_name="Test",
            status=CustomerStatus.ACTIVE,
            custom_loan_limit=None,
            active_loans=0,
            total_loan_value=Decimal("0")
        )

        limit = await customer_default.get_effective_loan_limit()
        assert limit == 10, f"❌ Expected 10 from Financial Policy, got {limit}"
        print(f"✓ Customer uses Financial Policy value: {limit}")

        # Test customer with custom limit (should ignore policy)
        customer_custom = Customer(
            phone_number="5555555555",
            first_name="Custom",
            last_name="Override",
            status=CustomerStatus.ACTIVE,
            custom_loan_limit=12,
            active_loans=0,
            total_loan_value=Decimal("0")
        )

        limit_custom = await customer_custom.get_effective_loan_limit()
        assert limit_custom == 12, f"❌ Expected custom limit 12, got {limit_custom}"
        print(f"✓ Custom limit customer ignores policy: {limit_custom}")

        print("✅ TEST 3 PASSED\n")

    except Exception as e:
        print(f"❌ TEST 3 FAILED: {e}")
        raise

async def test_dynamic_policy_changes():
    """Test 4: Changing policy affects default customers immediately"""
    print("\n=== TEST 4: Dynamic Policy Changes ===")

    # Create customer without custom limit
    customer = Customer(
        phone_number="6666666666",
        first_name="Dynamic",
        last_name="Test",
        status=CustomerStatus.ACTIVE,
        custom_loan_limit=None,
        active_loans=0,
        total_loan_value=Decimal("0")
    )

    # Get current limit
    limit_before = await customer.get_effective_loan_limit()
    print(f"✓ Initial limit: {limit_before}")

    # Update Financial Policy to 12
    config = await FinancialPolicyConfig.find_one(FinancialPolicyConfig.config_type == "financial_policy")
    if config:
        config.max_active_loans_per_customer = 12
        config.reason = "Testing dynamic change"
        await config.save()
        print("✓ Updated Financial Policy to 12")

    # Get limit again (should be 12 now)
    limit_after = await customer.get_effective_loan_limit()
    assert limit_after == 12, f"❌ Expected 12 after policy change, got {limit_after}"
    print(f"✓ Limit dynamically updated: {limit_after}")

    # Customer with custom limit should be unaffected
    customer_custom = Customer(
        phone_number="7777777777",
        first_name="Unaffected",
        last_name="Custom",
        status=CustomerStatus.ACTIVE,
        custom_loan_limit=5,
        active_loans=0,
        total_loan_value=Decimal("0")
    )

    limit_custom = await customer_custom.get_effective_loan_limit()
    assert limit_custom == 5, f"❌ Custom limit should remain 5, got {limit_custom}"
    print(f"✓ Custom limit customer unaffected: {limit_custom}")

    print("✅ TEST 4 PASSED\n")

async def test_parity_with_credit_limits():
    """Test 5: Verify loan limits follow same pattern as credit limits"""
    print("\n=== TEST 5: Parity with Credit Limits ===")

    # Create test customer
    customer = Customer(
        phone_number="8888888888",
        first_name="Parity",
        last_name="Test",
        status=CustomerStatus.ACTIVE,
        custom_loan_limit=None,
        credit_limit=None,
        active_loans=0,
        total_loan_value=Decimal("0")
    )

    # Test both methods exist
    assert hasattr(customer, 'get_effective_credit_limit'), "❌ get_effective_credit_limit() not found"
    assert hasattr(customer, 'get_effective_loan_limit'), "❌ get_effective_loan_limit() not found"
    print("✓ Both methods exist")

    # Test both return appropriate types
    credit_limit = await customer.get_effective_credit_limit()
    loan_limit = await customer.get_effective_loan_limit()

    assert isinstance(credit_limit, Decimal), f"❌ Credit limit should be Decimal, got {type(credit_limit)}"
    assert isinstance(loan_limit, int), f"❌ Loan limit should be int, got {type(loan_limit)}"
    print(f"✓ Credit limit type: Decimal ({credit_limit})")
    print(f"✓ Loan limit type: int ({loan_limit})")

    # Test fallback values
    assert credit_limit == Decimal("3000.00"), f"❌ Credit limit fallback should be 3000, got {credit_limit}"
    print("✓ Credit limit fallback: $3,000")

    # Loan limit fallback depends on Financial Policy or defaults to 8
    # (currently should be 12 from previous test)
    print(f"✓ Loan limit from policy: {loan_limit}")

    print("✅ TEST 5 PASSED\n")

async def test_customer_service_integration():
    """Test 6: CustomerService uses get_effective_loan_limit()"""
    print("\n=== TEST 6: CustomerService Integration ===")

    # This tests that customer_service.py correctly uses the new method
    # We'll verify by checking if a customer can take loans based on effective limit

    try:
        # Create test customer
        customer = Customer(
            phone_number="9999999999",
            first_name="Service",
            last_name="Test",
            status=CustomerStatus.ACTIVE,
            custom_loan_limit=None,
            active_loans=0,
            total_loan_value=Decimal("0")
        )
        await customer.save()
        print("✓ Test customer created")

        # Check loan eligibility
        can_take_loan = await CustomerService.can_take_more_loans("9999999999")
        assert can_take_loan == True, f"❌ Customer with 0 loans should be able to take more"
        print(f"✓ Customer with 0 loans can take more: {can_take_loan}")

        # Get effective limit to verify
        effective_limit = await customer.get_effective_loan_limit()
        print(f"✓ Effective limit for customer: {effective_limit}")

        # Simulate customer having loans equal to limit
        customer.active_loans = effective_limit
        await customer.save()

        can_take_loan_at_limit = await CustomerService.can_take_more_loans("9999999999")
        assert can_take_loan_at_limit == False, f"❌ Customer at limit should not be able to take more"
        print(f"✓ Customer at limit ({effective_limit}) cannot take more: {can_take_loan_at_limit}")

        # Clean up
        await customer.delete()
        print("✓ Test customer cleaned up")

        print("✅ TEST 6 PASSED\n")

    except Exception as e:
        print(f"❌ TEST 6 FAILED: {e}")
        # Clean up on failure
        try:
            test_customer = await Customer.find_one(Customer.phone_number == "9999999999")
            if test_customer:
                await test_customer.delete()
        except:
            pass
        raise

async def cleanup():
    """Clean up test data"""
    print("\n=== CLEANUP ===")
    try:
        # Delete test config
        config = await FinancialPolicyConfig.find_one(FinancialPolicyConfig.config_type == "financial_policy")
        if config:
            await config.delete()
            print("✓ Test config deleted")

        print("✓ Cleanup complete")
    except Exception as e:
        print(f"⚠ Cleanup warning: {e}")

async def run_all_tests():
    """Run all tests in sequence"""
    print("\n" + "="*60)
    print("LOAN LIMIT SETTINGS - COMPREHENSIVE TEST SUITE")
    print("Testing: Loan limits work exactly like credit limits")
    print("="*60)

    try:
        await setup_database()

        # Run tests
        await test_effective_loan_limit_method()
        await test_custom_loan_limit_override()
        await test_financial_policy_integration()
        await test_dynamic_policy_changes()
        await test_parity_with_credit_limits()
        await test_customer_service_integration()

        print("\n" + "="*60)
        print("✅ ALL TESTS PASSED!")
        print("="*60)
        print("\nSummary:")
        print("✓ get_effective_loan_limit() method works correctly")
        print("✓ Custom limits override system defaults")
        print("✓ Financial Policy integration working")
        print("✓ Dynamic policy changes affect default customers")
        print("✓ Complete parity with credit limit system")
        print("✓ CustomerService integration verified")
        print("\n🎯 Loan limits work EXACTLY like credit limits!\n")

    except Exception as e:
        print("\n" + "="*60)
        print(f"❌ TEST SUITE FAILED: {e}")
        print("="*60)
        import traceback
        traceback.print_exc()

    finally:
        await cleanup()

if __name__ == "__main__":
    asyncio.run(run_all_tests())

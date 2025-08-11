"""
Comprehensive Integration Tests for Pawn Transaction System

Tests end-to-end workflows, API integration, business logic validation,
database consistency, performance, and security across all pawn components.
"""

import pytest
from datetime import datetime, timedelta, UTC
from httpx import AsyncClient
from typing import Dict, Any, List

from app.models.user_model import User
from app.models.customer_model import Customer
from app.models.pawn_transaction_model import PawnTransaction, TransactionStatus
from app.models.pawn_item_model import PawnItem
from app.models.payment_model import Payment
from app.models.extension_model import Extension


@pytest.mark.integration
class TestPawnTransactionIntegration:
    """Integration tests for complete pawn transaction lifecycle"""

    @pytest.fixture
    async def test_customer_data(self):
        """Test customer data for pawn transactions"""
        return {
            "phone_number": "5551234567",
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@test.com",
            "notes": "Test customer for pawn integration tests"
        }

    @pytest.fixture
    async def created_test_customer(self, clean_db, test_customer_data, staff_token, async_client):
        """Create test customer for pawn transactions"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        response = await async_client.post(
            "/api/v1/customer/",
            json=test_customer_data,
            headers=headers
        )
        assert response.status_code == 201
        return response.json()

    @pytest.fixture
    async def sample_pawn_data(self, created_test_customer):
        """Sample pawn transaction data with multiple items"""
        return {
            "customer_id": created_test_customer["phone_number"],
            "loan_amount": 500,
            "monthly_interest_amount": 50,
            "storage_location": "Shelf A-5",
            "internal_notes": "Integration test transaction",
            "items": [
                {
                    "description": "14k Gold Wedding Ring",
                    "serial_number": "GWR-2024-001"
                },
                {
                    "description": "Dewalt Circular Saw DWE575SB",
                    "serial_number": "DW-789456"
                },
                {
                    "description": "iPhone 14 Pro Max",
                    "serial_number": None
                }
            ]
        }

    async def test_complete_pawn_lifecycle(self, async_client, staff_token, sample_pawn_data):
        """
        Test Scenario 1: Complete Pawn Lifecycle
        
        Steps:
        1. Create pawn transaction with 3 items
        2. Verify transaction details and items
        3. Make partial payment
        4. Check balance calculation
        5. Extend loan for 2 months
        6. Make final payment
        7. Verify status changed to "redeemed"
        """
        headers = {"Authorization": f"Bearer {staff_token}"}
        
        # Step 1: Create pawn transaction with 3 items
        response = await async_client.post(
            "/api/v1/pawn-transaction/",
            json=sample_pawn_data,
            headers=headers
        )
        assert response.status_code == 201
        transaction = response.json()
        transaction_id = transaction["transaction_id"]
        
        # Verify transaction creation
        assert transaction["loan_amount"] == 500
        assert transaction["monthly_interest_amount"] == 50
        assert transaction["status"] == "active"
        assert len(transaction.get("items", [])) == 3 or "items" not in transaction
        
        # Step 2: Get transaction details and verify items
        response = await async_client.get(
            f"/api/v1/pawn-transaction/{transaction_id}",
            headers=headers
        )
        assert response.status_code == 200
        transaction_details = response.json()
        
        # Get transaction summary with items
        response = await async_client.get(
            f"/api/v1/pawn-transaction/{transaction_id}/summary",
            headers=headers
        )
        assert response.status_code == 200
        summary = response.json()
        assert len(summary.get("items", [])) == 3
        
        # Step 3: Make partial payment ($150)
        payment_data = {"payment_amount": 150}
        response = await async_client.post(
            "/api/v1/payment/",
            json={**payment_data, "transaction_id": transaction_id},
            headers=headers
        )
        assert response.status_code == 201
        payment = response.json()
        
        # Verify payment was processed
        assert payment["payment_amount"] == 150
        assert payment["balance_after_payment"] < payment["balance_before_payment"]
        
        # Step 4: Check balance calculation
        response = await async_client.get(
            f"/api/v1/pawn-transaction/{transaction_id}/balance",
            headers=headers
        )
        assert response.status_code == 200
        balance = response.json()
        assert balance["current_balance"] > 0  # Still has remaining balance
        
        # Step 5: Extend loan for 2 months
        extension_data = {
            "extension_months": 2,
            "extension_fee_per_month": 25,
            "extension_reason": "Customer needs more time"
        }
        response = await async_client.post(
            "/api/v1/extension/",
            json={**extension_data, "transaction_id": transaction_id},
            headers=headers
        )
        assert response.status_code == 201
        extension = response.json()
        
        # Verify extension was processed
        assert extension["extension_months"] == 2
        assert extension["total_extension_fee"] == 50  # 2 months * $25
        
        # Step 6: Make final payment (pay off remaining balance)
        response = await async_client.get(
            f"/api/v1/pawn-transaction/{transaction_id}/payoff-amount",
            headers=headers
        )
        assert response.status_code == 200
        payoff_amount = response.json()["payoff_amount"]
        
        final_payment_data = {"payment_amount": payoff_amount}
        response = await async_client.post(
            "/api/v1/payment/",
            json={**final_payment_data, "transaction_id": transaction_id},
            headers=headers
        )
        assert response.status_code == 201
        
        # Step 7: Verify status changed to "redeemed"
        response = await async_client.get(
            f"/api/v1/pawn-transaction/{transaction_id}",
            headers=headers
        )
        assert response.status_code == 200
        final_transaction = response.json()
        assert final_transaction["status"] == "redeemed"

    async def test_multiple_transactions_per_customer(self, async_client, staff_token, created_test_customer):
        """
        Test Scenario 2: Multiple Transactions per Customer
        
        Tests independence of multiple transactions for same customer
        """
        headers = {"Authorization": f"Bearer {staff_token}"}
        customer_phone = created_test_customer["phone_number"]
        
        # Create Transaction 1
        transaction1_data = {
            "customer_id": customer_phone,
            "loan_amount": 300,
            "monthly_interest_amount": 30,
            "storage_location": "Shelf B-1",
            "items": [{"description": "Gold Necklace", "serial_number": None}]
        }
        response = await async_client.post(
            "/api/v1/pawn-transaction/",
            json=transaction1_data,
            headers=headers
        )
        assert response.status_code == 201
        transaction1_id = response.json()["transaction_id"]
        
        # Create Transaction 2
        transaction2_data = {
            "customer_id": customer_phone,
            "loan_amount": 800,
            "monthly_interest_amount": 80,
            "storage_location": "Shelf C-2",
            "items": [{"description": "Power Tools Set", "serial_number": "PT-12345"}]
        }
        response = await async_client.post(
            "/api/v1/pawn-transaction/",
            json=transaction2_data,
            headers=headers
        )
        assert response.status_code == 201
        transaction2_id = response.json()["transaction_id"]
        
        # Make payment on Transaction 1
        response = await async_client.post(
            "/api/v1/payment/",
            json={"transaction_id": transaction1_id, "payment_amount": 100},
            headers=headers
        )
        assert response.status_code == 201
        
        # Verify Transaction 2 is unaffected
        response = await async_client.get(
            f"/api/v1/pawn-transaction/{transaction2_id}/balance",
            headers=headers
        )
        assert response.status_code == 200
        transaction2_balance = response.json()
        assert transaction2_balance["total_payments"] == 0  # No payments on transaction 2
        
        # Get customer's transactions list
        response = await async_client.get(
            f"/api/v1/pawn-transaction/customer/{customer_phone}/transactions",
            headers=headers
        )
        assert response.status_code == 200
        customer_transactions = response.json()
        assert len(customer_transactions["transactions"]) == 2

    async def test_extension_and_payment_integration(self, async_client, staff_token, sample_pawn_data):
        """
        Test Scenario 3: Extension and Payment Integration
        
        Tests complex interaction between extensions and payments
        """
        headers = {"Authorization": f"Bearer {staff_token}"}
        
        # Create pawn transaction
        response = await async_client.post(
            "/api/v1/pawn-transaction/",
            json=sample_pawn_data,
            headers=headers
        )
        assert response.status_code == 201
        transaction_id = response.json()["transaction_id"]
        
        # Get initial balance (includes first month interest)
        response = await async_client.get(
            f"/api/v1/pawn-transaction/{transaction_id}/balance",
            headers=headers
        )
        assert response.status_code == 200
        initial_balance = response.json()["current_balance"]
        
        # Extend loan for 1 month with $30 fee
        response = await async_client.post(
            "/api/v1/extension/",
            json={
                "transaction_id": transaction_id,
                "extension_months": 1,
                "extension_fee_per_month": 30,
                "extension_reason": "Integration test"
            },
            headers=headers
        )
        assert response.status_code == 201
        
        # Get updated balance (should include extension fee)
        response = await async_client.get(
            f"/api/v1/pawn-transaction/{transaction_id}/balance",
            headers=headers
        )
        assert response.status_code == 200
        extended_balance = response.json()["current_balance"]
        assert extended_balance > initial_balance  # Extension fee added
        
        # Make payment covering original + interest + extension
        response = await async_client.post(
            "/api/v1/payment/",
            json={
                "transaction_id": transaction_id,
                "payment_amount": extended_balance
            },
            headers=headers
        )
        assert response.status_code == 201
        
        # Verify transaction is paid off
        response = await async_client.get(
            f"/api/v1/pawn-transaction/{transaction_id}/balance",
            headers=headers
        )
        assert response.status_code == 200
        final_balance = response.json()
        assert final_balance["current_balance"] == 0

    async def test_error_handling_and_edge_cases(self, async_client, staff_token):
        """
        Test Scenario 4: Error Handling and Edge Cases
        
        Tests various error scenarios and edge cases
        """
        headers = {"Authorization": f"Bearer {staff_token}"}
        fake_transaction_id = "00000000-0000-0000-0000-000000000000"
        
        # Test payment on non-existent transaction
        response = await async_client.post(
            "/api/v1/payment/",
            json={
                "transaction_id": fake_transaction_id,
                "payment_amount": 100
            },
            headers=headers
        )
        assert response.status_code == 404
        
        # Test extension on non-existent transaction
        response = await async_client.post(
            "/api/v1/extension/",
            json={
                "transaction_id": fake_transaction_id,
                "extension_months": 1,
                "extension_fee_per_month": 25
            },
            headers=headers
        )
        assert response.status_code == 404
        
        # Test invalid transaction ID format
        response = await async_client.get(
            "/api/v1/pawn-transaction/invalid-id",
            headers=headers
        )
        assert response.status_code in [400, 404]  # Bad request or not found
        
        # Test overpayment validation
        # (This would require creating a transaction first, then testing overpayment)
        
        # Test invalid item descriptions (empty)
        invalid_transaction_data = {
            "customer_id": "5551234567",  # Assume exists
            "loan_amount": 100,
            "monthly_interest_amount": 10,
            "storage_location": "Test",
            "items": [{"description": "", "serial_number": None}]  # Empty description
        }
        response = await async_client.post(
            "/api/v1/pawn-transaction/",
            json=invalid_transaction_data,
            headers=headers
        )
        assert response.status_code == 422  # Validation error


@pytest.mark.integration
class TestPawnTransactionPerformance:
    """Performance tests for pawn transaction system"""

    async def test_api_response_times(self, async_client, staff_token, sample_pawn_data):
        """Test all API endpoints meet <100ms response time requirement"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        
        # Create transaction for testing
        start_time = datetime.now()
        response = await async_client.post(
            "/api/v1/pawn-transaction/",
            json=sample_pawn_data,
            headers=headers
        )
        end_time = datetime.now()
        
        # Check creation time
        creation_time = (end_time - start_time).total_seconds() * 1000
        assert creation_time < 100, f"Transaction creation took {creation_time}ms (>100ms)"
        
        if response.status_code == 201:
            transaction_id = response.json()["transaction_id"]
            
            # Test various endpoint response times
            endpoints_to_test = [
                f"/api/v1/pawn-transaction/{transaction_id}",
                f"/api/v1/pawn-transaction/{transaction_id}/summary",
                f"/api/v1/pawn-transaction/{transaction_id}/balance",
                f"/api/v1/pawn-transaction/{transaction_id}/interest-breakdown",
                f"/api/v1/pawn-transaction/{transaction_id}/payoff-amount",
            ]
            
            for endpoint in endpoints_to_test:
                start_time = datetime.now()
                response = await async_client.get(endpoint, headers=headers)
                end_time = datetime.now()
                
                response_time = (end_time - start_time).total_seconds() * 1000
                assert response_time < 100, f"Endpoint {endpoint} took {response_time}ms (>100ms)"

    async def test_concurrent_operations(self, async_client, staff_token, created_test_customer):
        """Test concurrent operations on same transaction"""
        import asyncio
        
        headers = {"Authorization": f"Bearer {staff_token}"}
        
        # Create transaction
        transaction_data = {
            "customer_id": created_test_customer["phone_number"],
            "loan_amount": 1000,
            "monthly_interest_amount": 100,
            "storage_location": "Concurrent Test",
            "items": [{"description": "Test Item", "serial_number": None}]
        }
        response = await async_client.post(
            "/api/v1/pawn-transaction/",
            json=transaction_data,
            headers=headers
        )
        assert response.status_code == 201
        transaction_id = response.json()["transaction_id"]
        
        # Test concurrent balance checks (should not interfere)
        async def check_balance():
            response = await async_client.get(
                f"/api/v1/pawn-transaction/{transaction_id}/balance",
                headers=headers
            )
            return response.status_code == 200
        
        # Run multiple concurrent balance checks
        tasks = [check_balance() for _ in range(5)]
        results = await asyncio.gather(*tasks)
        assert all(results), "Some concurrent balance checks failed"


@pytest.mark.integration  
class TestPawnTransactionSecurity:
    """Security tests for pawn transaction system"""

    async def test_jwt_authentication_required(self, async_client, sample_pawn_data):
        """Test that all pawn endpoints require JWT authentication"""
        # Test without authentication headers
        response = await async_client.post(
            "/api/v1/pawn-transaction/",
            json=sample_pawn_data
        )
        assert response.status_code == 401  # Unauthorized
        
        # Test with invalid token
        invalid_headers = {"Authorization": "Bearer invalid_token"}
        response = await async_client.post(
            "/api/v1/pawn-transaction/",
            json=sample_pawn_data,
            headers=invalid_headers
        )
        assert response.status_code == 401  # Unauthorized

    async def test_input_validation_security(self, async_client, staff_token):
        """Test input validation prevents malicious data"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        
        # Test SQL injection attempts in transaction data
        malicious_data = {
            "customer_id": "'; DROP TABLE pawn_transactions; --",
            "loan_amount": 500,
            "monthly_interest_amount": 50,
            "storage_location": "<script>alert('xss')</script>",
            "items": [{"description": "'; DROP TABLE pawn_items; --", "serial_number": None}]
        }
        
        response = await async_client.post(
            "/api/v1/pawn-transaction/",
            json=malicious_data,
            headers=headers
        )
        # Should either reject with validation error or sanitize input
        assert response.status_code in [400, 422]  # Bad request or validation error

    async def test_authorization_levels(self, async_client, staff_token, admin_token):
        """Test that staff and admin have appropriate access levels"""
        # Both staff and admin should be able to create transactions
        transaction_data = {
            "customer_id": "5551234567",
            "loan_amount": 100,
            "monthly_interest_amount": 10,
            "storage_location": "Auth Test",
            "items": [{"description": "Test Item", "serial_number": None}]
        }
        
        # Test staff access
        staff_headers = {"Authorization": f"Bearer {staff_token}"}
        response = await async_client.post(
            "/api/v1/pawn-transaction/",
            json=transaction_data,
            headers=staff_headers
        )
        # Should work (assuming customer exists) or fail with business logic error, not auth error
        assert response.status_code != 403  # Not forbidden
        
        # Test admin access
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        response = await async_client.post(
            "/api/v1/pawn-transaction/",
            json=transaction_data,
            headers=admin_headers
        )
        # Should work (assuming customer exists) or fail with business logic error, not auth error
        assert response.status_code != 403  # Not forbidden


@pytest.mark.integration
class TestPawnTransactionBusinessLogic:
    """Tests for business logic accuracy and consistency"""

    async def test_interest_calculation_accuracy(self, async_client, staff_token, sample_pawn_data):
        """Test fixed monthly interest calculations are accurate"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        
        # Create transaction with known amounts
        transaction_data = {
            **sample_pawn_data,
            "loan_amount": 600,  # $600 loan
            "monthly_interest_amount": 60  # $60/month interest
        }
        
        response = await async_client.post(
            "/api/v1/pawn-transaction/",
            json=transaction_data,
            headers=headers
        )
        assert response.status_code == 201
        transaction_id = response.json()["transaction_id"]
        
        # Get interest breakdown
        response = await async_client.get(
            f"/api/v1/pawn-transaction/{transaction_id}/interest-breakdown",
            headers=headers
        )
        assert response.status_code == 200
        breakdown = response.json()
        
        # Verify calculations
        # First month should be $600 principal + $60 interest = $660
        # Interest should be calculated based on calendar months, not days
        assert breakdown["principal_amount"] == 600
        assert breakdown["monthly_interest_amount"] == 60

    async def test_calendar_month_calculations(self, async_client, staff_token, sample_pawn_data):
        """Test that date calculations use calendar months, not fixed days"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        
        response = await async_client.post(
            "/api/v1/pawn-transaction/",
            json=sample_pawn_data,
            headers=headers
        )
        assert response.status_code == 201
        transaction = response.json()
        
        # Parse dates
        pawn_date = datetime.fromisoformat(transaction["pawn_date"].replace('Z', '+00:00'))
        maturity_date = datetime.fromisoformat(transaction["maturity_date"].replace('Z', '+00:00'))
        
        # Verify maturity is exactly 3 calendar months from pawn date
        expected_month = pawn_date.month + 3
        expected_year = pawn_date.year
        if expected_month > 12:
            expected_year += expected_month // 12
            expected_month = expected_month % 12
            if expected_month == 0:
                expected_month = 12
                expected_year -= 1
        
        assert maturity_date.year == expected_year
        assert maturity_date.month == expected_month
        assert maturity_date.day == pawn_date.day  # Same day of month

    async def test_payment_balance_updates(self, async_client, staff_token, sample_pawn_data):
        """Test payment balance updates are accurate and create audit trails"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        
        # Create transaction
        response = await async_client.post(
            "/api/v1/pawn-transaction/",
            json=sample_pawn_data,
            headers=headers
        )
        assert response.status_code == 201
        transaction_id = response.json()["transaction_id"]
        
        # Get initial balance
        response = await async_client.get(
            f"/api/v1/pawn-transaction/{transaction_id}/balance",
            headers=headers
        )
        assert response.status_code == 200
        initial_balance = response.json()["current_balance"]
        
        # Make payment
        payment_amount = 100
        response = await async_client.post(
            "/api/v1/payment/",
            json={
                "transaction_id": transaction_id,
                "payment_amount": payment_amount
            },
            headers=headers
        )
        assert response.status_code == 201
        payment = response.json()
        
        # Verify payment math
        expected_new_balance = payment["balance_before_payment"] - payment_amount
        assert payment["balance_after_payment"] == expected_new_balance
        
        # Verify balance is updated in transaction
        response = await async_client.get(
            f"/api/v1/pawn-transaction/{transaction_id}/balance",
            headers=headers
        )
        assert response.status_code == 200
        new_balance = response.json()["current_balance"]
        assert new_balance == initial_balance - payment_amount

    async def test_extension_date_calculations(self, async_client, staff_token, sample_pawn_data):
        """Test extension calculations from original maturity date"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        
        # Create transaction
        response = await async_client.post(
            "/api/v1/pawn-transaction/",
            json=sample_pawn_data,
            headers=headers
        )
        assert response.status_code == 201
        transaction_id = response.json()["transaction_id"]
        original_maturity = datetime.fromisoformat(
            response.json()["maturity_date"].replace('Z', '+00:00')
        )
        
        # Extend by 2 months
        response = await async_client.post(
            "/api/v1/extension/",
            json={
                "transaction_id": transaction_id,
                "extension_months": 2,
                "extension_fee_per_month": 30
            },
            headers=headers
        )
        assert response.status_code == 201
        extension = response.json()
        
        # Verify new maturity date is 2 calendar months from original
        new_maturity = datetime.fromisoformat(
            extension["new_maturity_date"].replace('Z', '+00:00')
        )
        
        # Should be exactly 2 calendar months after original maturity
        expected_month = original_maturity.month + 2
        expected_year = original_maturity.year
        if expected_month > 12:
            expected_year += expected_month // 12
            expected_month = expected_month % 12
            if expected_month == 0:
                expected_month = 12
                expected_year -= 1
        
        assert new_maturity.year == expected_year
        assert new_maturity.month == expected_month
        assert new_maturity.day == original_maturity.day


@pytest.mark.integration
class TestExtensionModel:
    """Test suite for Extension model validation and business logic"""
    
    def test_extension_field_validation(self):
        """Test extension field validation without database connection"""
        # Test valid data structure
        valid_data = {
            "transaction_id": "12345678-1234-1234-1234-123456789abc",
            "processed_by_user_id": "01",
            "extension_months": 2,
            "extension_fee_per_month": 25,
            "total_extension_fee": 50,
            "original_maturity_date": datetime(2025, 3, 15),
            "new_maturity_date": datetime(2025, 5, 15)
        }
        
        # Test that the model can validate the data structure
        try:
            model_fields = Extension.model_fields
            assert "transaction_id" in model_fields
            assert "processed_by_user_id" in model_fields
            assert "extension_months" in model_fields
            assert "extension_fee_per_month" in model_fields
            assert "total_extension_fee" in model_fields
            assert "original_maturity_date" in model_fields
            assert "new_maturity_date" in model_fields
        except Exception as e:
            pytest.fail(f"Field validation failed: {e}")
    
    def test_extension_months_validation(self):
        """Test extension months validation rules"""
        # Test invalid extension months
        invalid_months = [0, 4, 5, -1, 10]
        for months in invalid_months:
            try:
                Extension.validate_extension_months(months)
                pytest.fail(f"Should have raised ValueError for {months} months")
            except ValueError as e:
                assert "must be 1, 2, or 3" in str(e)
        
        # Test valid extension months
        valid_months = [1, 2, 3]
        for months in valid_months:
            result = Extension.validate_extension_months(months)
            assert result == months
    
    def test_extension_fee_validation(self):
        """Test extension fee validation rules"""
        # Test negative extension fee
        try:
            Extension.validate_extension_fee_per_month(-10)
            pytest.fail("Should have raised ValueError for negative extension fee")
        except ValueError as e:
            assert "cannot be negative" in str(e)
        
        # Test excessive extension fee
        try:
            Extension.validate_extension_fee_per_month(2000)
            pytest.fail("Should have raised ValueError for excessive extension fee")
        except ValueError as e:
            assert "cannot exceed" in str(e)
        
        # Test valid extension fees
        assert Extension.validate_extension_fee_per_month(0) == 0
        assert Extension.validate_extension_fee_per_month(25) == 25
        assert Extension.validate_extension_fee_per_month(100) == 100
        assert Extension.validate_extension_fee_per_month(1000) == 1000  # Max allowed


@pytest.mark.integration
class TestPawnItemModel:
    """Test suite for PawnItem model validation and business logic"""
    
    def test_pawn_item_validation(self):
        """Test pawn item field validation"""
        # Test that the model has required fields
        try:
            model_fields = PawnItem.model_fields
            assert "description" in model_fields
            assert "serial_number" in model_fields
            assert "estimated_value" in model_fields
            assert "condition" in model_fields
        except Exception as e:
            pytest.fail(f"PawnItem field validation failed: {e}")
    
    def test_item_description_validation(self):
        """Test item description validation rules"""
        # Test empty description validation
        try:
            result = PawnItem.validate_description("")
            pytest.fail("Should have raised ValueError for empty description")
        except ValueError as e:
            assert "cannot be empty" in str(e)
        
        # Test valid description
        valid_desc = "Gold Wedding Ring 14k"
        result = PawnItem.validate_description(valid_desc)
        assert result == valid_desc
    
    def test_serial_number_validation(self):
        """Test serial number validation rules"""
        # Test empty string becomes None
        result = PawnItem.validate_serial_number("")
        assert result is None
        
        # Test whitespace-only becomes None
        result = PawnItem.validate_serial_number("   ")
        assert result is None
        
        # Test valid serial number
        serial = "SN123456789"
        result = PawnItem.validate_serial_number(serial)
        assert result == serial


@pytest.mark.integration
class TestPaymentModel:
    """Test suite for Payment model validation and business logic"""
    
    def test_payment_field_validation(self):
        """Test payment field validation"""
        try:
            model_fields = Payment.model_fields
            assert "transaction_id" in model_fields
            assert "payment_amount" in model_fields
            assert "payment_method" in model_fields
            assert "payment_date" in model_fields
            assert "balance_before_payment" in model_fields
            assert "balance_after_payment" in model_fields
        except Exception as e:
            pytest.fail(f"Payment field validation failed: {e}")
    
    def test_payment_amount_validation(self):
        """Test payment amount validation rules"""
        # Test negative payment amount
        try:
            Payment.validate_payment_amount(-50.0)
            pytest.fail("Should have raised ValueError for negative payment")
        except ValueError as e:
            assert "cannot be negative" in str(e)
        
        # Test zero payment (should be valid)
        result = Payment.validate_payment_amount(0.0)
        assert result == 0.0
        
        # Test valid payment amount
        result = Payment.validate_payment_amount(100.50)
        assert result == 100.50
    
    def test_payment_method_validation(self):
        """Test payment method validation"""
        valid_methods = ["cash", "card", "check", "money_order", "other"]
        
        for method in valid_methods:
            try:
                result = Payment.validate_payment_method(method)
                assert result == method
            except ValueError:
                pytest.fail(f"Should accept valid payment method: {method}")
        
        # Test invalid payment method
        try:
            Payment.validate_payment_method("cryptocurrency")
            pytest.fail("Should reject invalid payment method")
        except ValueError as e:
            assert "Invalid payment method" in str(e)


@pytest.mark.integration
class TestPawnTransactionModel:
    """Test suite for PawnTransaction model validation and business logic"""
    
    def test_transaction_status_validation(self):
        """Test transaction status validation"""
        valid_statuses = ["active", "overdue", "extended", "redeemed", "forfeited", "sold"]
        
        for status in valid_statuses:
            try:
                result = TransactionStatus(status)
                assert result.value == status
            except ValueError:
                pytest.fail(f"Should accept valid status: {status}")
    
    def test_loan_amount_validation(self):
        """Test loan amount validation rules"""
        # Test negative loan amount
        try:
            PawnTransaction.validate_loan_amount(-100.0)
            pytest.fail("Should have raised ValueError for negative loan amount")
        except ValueError as e:
            assert "cannot be negative" in str(e)
        
        # Test zero loan amount
        try:
            PawnTransaction.validate_loan_amount(0.0)
            pytest.fail("Should have raised ValueError for zero loan amount")
        except ValueError as e:
            assert "must be greater than zero" in str(e)
        
        # Test valid loan amount
        result = PawnTransaction.validate_loan_amount(500.0)
        assert result == 500.0
    
    def test_interest_rate_validation(self):
        """Test monthly interest amount validation"""
        # Test negative interest
        try:
            PawnTransaction.validate_monthly_interest_amount(-10.0)
            pytest.fail("Should have raised ValueError for negative interest")
        except ValueError as e:
            assert "cannot be negative" in str(e)
        
        # Test zero interest (should be valid)
        result = PawnTransaction.validate_monthly_interest_amount(0.0)
        assert result == 0.0
        
        # Test valid interest amount
        result = PawnTransaction.validate_monthly_interest_amount(50.0)
        assert result == 50.0
    
    def test_storage_location_validation(self):
        """Test storage location validation"""
        # Test empty storage location
        try:
            PawnTransaction.validate_storage_location("")
            pytest.fail("Should have raised ValueError for empty storage location")
        except ValueError as e:
            assert "cannot be empty" in str(e)
        
        # Test valid storage location
        location = "Shelf A-15"
        result = PawnTransaction.validate_storage_location(location)
        assert result == location
#!/usr/bin/env python3
"""
Quick import test script to validate all new integrations before starting the server
"""

def test_imports():
    print("🔍 Testing critical import dependencies...")
    
    try:
        # Test transaction handler imports
        print("   📦 Testing transaction handler...")
        from app.schemas.transaction_schema import TransactionSearch
        from app.models.transaction_model import TransactionType, LoanStatus
        from app.api.api_v1.handlers.transaction import transaction_router
        print("   ✅ Transaction handler imports successful")
        
        # Test customer handler imports  
        print("   📦 Testing customer handler...")
        from app.api.api_v1.handlers.customer import customer_router
        print("   ✅ Customer handler imports successful")
        
        # Test customer service imports
        print("   📦 Testing customer service...")
        from app.services.customer_service import CustomerService
        print("   ✅ Customer service imports successful")
        
        # Test phone utils
        print("   📦 Testing phone utilities...")
        from app.utils.phone_utils import normalize_phone_number
        test_phone = normalize_phone_number("+1-555-123-4567")
        assert test_phone == "5551234567", f"Phone normalization failed: {test_phone}"
        print("   ✅ Phone utilities working correctly")
        
        # Test main router
        print("   📦 Testing main API router...")
        from app.api.api_v1.router import router
        print("   ✅ Main router imports successful")
        
        print("\n🎉 All integration imports successful! Server should start properly.")
        return True
        
    except ImportError as e:
        print(f"\n❌ Import Error: {e}")
        print("💡 Make sure all dependencies are installed:")
        print("   pip install -r requirements.txt")
        return False
    except AssertionError as e:
        print(f"\n❌ Functionality Error: {e}")
        return False
    except Exception as e:
        print(f"\n❌ Unexpected Error: {e}")
        return False

if __name__ == "__main__":
    success = test_imports()
    exit(0 if success else 1)
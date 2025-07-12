# 🚀 Backend Startup Fix Guide

## ✅ **Import Error Resolved**

The `NameError: name 'TransactionSearch' is not defined` error has been **FIXED**.

### **What Was Fixed:**
- ✅ Added missing `TransactionSearch` import in `transaction.py`
- ✅ Added missing `TransactionType` and `LoanStatus` imports  
- ✅ Verified all integration dependencies are properly imported

### **Files Modified:**
```python
# backend/app/api/api_v1/handlers/transaction.py
from app.schemas.transaction_schema import (
    PawnTransactionCreate, PaymentCreate, PaymentResultOut, LoanStatusOut, 
    LoanScenarioOut, StoreScenarioResponse, TransactionOut, TransactionSearch  # ← ADDED
)
from app.models.transaction_model import TransactionType, LoanStatus  # ← ADDED
```

## 🔧 **How to Start the Server**

### **Method 1: Direct Python Command**
```bash
cd backend
python -m uvicorn app.app:app --reload --host 0.0.0.0 --port 8000
```

### **Method 2: Using Package Script**
```bash
# From project root
npm run backend
# OR for Linux/Mac
npm run backend:linux
```

### **Method 3: Test Imports First (Recommended)**
```bash
cd backend
python test_imports.py
# If successful, then start server:
python -m uvicorn app.app:app --reload --host 0.0.0.0 --port 8000
```

## 🧪 **Pre-Start Verification**

Before starting the server, you can run the import test script:

```bash
cd backend
python test_imports.py
```

**Expected Output:**
```
🔍 Testing critical import dependencies...
   📦 Testing transaction handler...
   ✅ Transaction handler imports successful
   📦 Testing customer handler...
   ✅ Customer handler imports successful
   📦 Testing customer service...
   ✅ Customer service imports successful
   📦 Testing phone utilities...
   ✅ Phone utilities working correctly
   📦 Testing main API router...
   ✅ Main router imports successful

🎉 All integration imports successful! Server should start properly.
```

## 🐛 **If You Still Get Errors**

### **Common Issues & Solutions:**

#### **1. Missing Dependencies**
```bash
cd backend
pip install -r requirements.txt
```

#### **2. Python Path Issues**
```bash
# Make sure you're in the backend directory
cd backend
# And run with python module syntax
python -m uvicorn app.app:app --reload
```

#### **3. Virtual Environment Not Activated**
```bash
# Windows
venv\Scripts\activate
# Linux/Mac  
source venv/bin/activate
```

#### **4. Port Already in Use**
```bash
# Try a different port
python -m uvicorn app.app:app --reload --port 8001
```

## ✅ **Success Indicators**

When the server starts successfully, you should see:

```
INFO:     Will watch for changes in these directories: ['C:\\...\\backend']
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [####] using WatchFiles
INFO:     Starting Pawn Repo application...
INFO:     Connecting to MongoDB...
INFO:     MongoDB connection successful
INFO:     Beanie ODM initialized successfully
INFO:     Application started successfully on PAWNREPO
```

## 🔗 **Test the Integration**

Once the server is running, test the new endpoints:

### **1. Check API Documentation**
```
http://localhost:8000/docs
```

### **2. Test Customer Search**
```bash
curl "http://localhost:8000/api/v1/customers/search/phone/555" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### **3. Test Transaction Search**
```bash
curl -X POST "http://localhost:8000/api/v1/transactions/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"transaction_type": "pawn", "loan_status": "active"}'
```

## 🎯 **Next Steps After Server Starts**

1. **Start Frontend:**
   ```bash
   cd frontend
   npm start
   ```

2. **Test Payment Processing:**
   - Navigate to http://localhost:3000
   - Go to payment processing page
   - Test the new customer search functionality

3. **Verify Integration:**
   - Search for customers by phone/name
   - Select customer and view active loans
   - Test payment calculator
   - Process a test payment

## 🆘 **If Problems Persist**

### **Create Debug Log:**
```bash
cd backend
python -m uvicorn app.app:app --reload --log-level debug > startup.log 2>&1
```

### **Check Specific Import:**
```python
# In Python interactive shell
python
>>> from app.schemas.transaction_schema import TransactionSearch
>>> print("TransactionSearch imported successfully")
```

---

## 📝 **Summary**

The import error has been resolved by adding the missing `TransactionSearch` import. The server should now start properly and all new payment processing integration features should work correctly.

**Status: ✅ Ready to start backend server!**
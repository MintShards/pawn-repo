#!/usr/bin/env python3
"""
Initialize loan configuration with default values.

This migration script sets up the initial loan configuration in the database
with the increased limit of 8 active loans per customer.

Run this after updating the codebase to set the initial configuration.
"""

import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
import sys
import os

# Add parent directory to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.models.loan_config_model import LoanConfig


async def initialize_loan_config():
    """Initialize the loan configuration with default values"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.MONGO_CONNECTION_STRING)
    db = client.get_default_database()
    
    # Initialize Beanie with just LoanConfig model
    await init_beanie(database=db, document_models=[LoanConfig])
    
    print("Connected to MongoDB and initialized Beanie...")
    
    # Check if configuration already exists
    existing_config = await LoanConfig.get_current_config()
    
    if existing_config:
        print(f"Loan configuration already exists with limit: {existing_config.max_active_loans}")
        print(f"Updated by: {existing_config.updated_by}")
        print(f"Reason: {existing_config.reason}")
        return
    
    # Create initial configuration
    initial_config = LoanConfig(
        max_active_loans=8,  # Updated from 5 to 8
        updated_by="system_migration",
        reason="Initial configuration - increased from 5 to 8 active loans per customer",
        is_active=True
    )
    
    await initial_config.save()
    
    print("✅ Successfully created initial loan configuration:")
    print(f"   Max Active Loans: {initial_config.max_active_loans}")
    print(f"   Updated By: {initial_config.updated_by}")
    print(f"   Reason: {initial_config.reason}")
    print(f"   Created At: {initial_config.created_at}")
    
    # Close connection
    client.close()


async def main():
    """Main migration function"""
    print("🔧 Initializing loan configuration...")
    
    try:
        await initialize_loan_config()
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
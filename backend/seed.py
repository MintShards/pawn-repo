#!/usr/bin/env python3
"""
Seed script for the pawnshop system.

Creates initial data including the first admin user and sample staff.
Run with --clear flag to reset database before seeding.

Usage:
    python seed.py          # Seed database with initial data
    python seed.py --clear   # Clear database first, then seed
"""

import asyncio

from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

from app.core.config import settings
from app.models.user_model import User, UserRole
from app.core.security import get_pin


async def seed_database():
    """Seed the database with initial data"""
    
    print("🌱 Starting database seeding...")
    
    # Connect to database
    client = AsyncIOMotorClient(settings.MONGO_CONNECTION_STRING)
    db = client.get_default_database()
    
    # Initialize Beanie
    await init_beanie(database=db, document_models=[User])
    
    # Check if users already exist
    existing_users = await User.find().count()
    if existing_users > 0:
        print(f"⚠️  Database already seeded ({existing_users} users found).")
        print("💡 To re-seed, drop the database first.")
        client.close()
        return
    
    print("📊 Creating initial admin user...")
    
    # Create admin user with specified credentials
    admin_user = User(
        user_id="69",
        pin_hash=get_pin("6969"),
        first_name="Admin",
        last_name="Boss",
        email="admin@pawnshop.com",
        role=UserRole.ADMIN,
        notes="System administrator - created by seed script"
    )
    
    await admin_user.insert()
    
    # Create a sample staff user for testing
    print("👤 Creating sample staff user...")
    
    staff_user = User(
        user_id="02",
        pin_hash=get_pin("1234"),
        first_name="John",
        last_name="Staff",
        email="staff@pawnshop.com",
        role=UserRole.STAFF,
        notes="Sample staff member for testing"
    )
    
    await staff_user.insert()
    
    print("✅ Database seeding completed successfully!")
    print("")
    print("🔑 Admin Login Credentials:")
    print("   User ID: 69")
    print("   PIN: 6969")
    print("   Role: Admin")
    print("")
    print("👨‍💼 Staff Login Credentials (for testing):")
    print("   User ID: 02") 
    print("   PIN: 1234")
    print("   Role: Staff")
    print("")
    print("🚀 You can now start the server and test with Swagger UI!")
    print("   Server: uvicorn app.app:app --reload --host 0.0.0.0 --port 8000")
    print("   Swagger: http://localhost:8000/docs")
    
    # Close connection
    client.close()


async def clear_database():
    """Clear all data from the database"""
    
    print("🗑️  Clearing database...")
    
    # Connect to database
    client = AsyncIOMotorClient(settings.MONGO_CONNECTION_STRING)
    db = client.get_default_database()
    
    # Initialize Beanie
    await init_beanie(database=db, document_models=[User])
    
    # Delete all users
    await User.delete_all()
    
    print("✅ Database cleared!")
    client.close()


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--clear":
        asyncio.run(clear_database())
    else:
        asyncio.run(seed_database())
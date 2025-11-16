"""
Migration script for BLOCKER-1 fix: Convert extension financial fields from float to int

This script updates existing Extension documents in MongoDB to convert float
values to integers (whole dollars) for the following fields:
- discount_amount
- overdue_fee_collected
- net_amount_collected

Usage:
    python scripts/migrate_extension_float_to_int.py

Environment:
    Requires MONGO_CONNECTION_STRING to be set in environment or .env file
"""

import asyncio
import sys
import os
from pathlib import Path

# Add parent directory to Python path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from decouple import config
import structlog

from app.models.extension_model import Extension

# Configure logger
logger = structlog.get_logger(__name__)


async def migrate_extensions():
    """
    Migrate extension financial fields from float to int

    This migration:
    1. Connects to MongoDB
    2. Finds all Extension documents
    3. Rounds float values to integers
    4. Updates documents in place
    5. Reports statistics
    """

    # Get database connection
    mongo_uri = config("MONGO_CONNECTION_STRING", default="mongodb://localhost:27017/pawn-repo")

    logger.info("Connecting to MongoDB", uri=mongo_uri.split('@')[-1])  # Hide credentials

    client = AsyncIOMotorClient(mongo_uri)

    # Get database from connection string
    db_name = mongo_uri.split('/')[-1].split('?')[0]
    database = client[db_name]

    # Initialize Beanie
    await init_beanie(database=database, document_models=[Extension])

    logger.info("Connected to database", database=db_name)

    # Get all extensions
    all_extensions = await Extension.find_all().to_list()

    total_count = len(all_extensions)
    logger.info("Found extensions to migrate", count=total_count)

    if total_count == 0:
        logger.info("No extensions found - migration complete")
        return

    # Counters
    migrated_count = 0
    already_int_count = 0
    error_count = 0

    for extension in all_extensions:
        try:
            needs_migration = False

            # Check and convert discount_amount
            if isinstance(extension.discount_amount, float):
                old_value = extension.discount_amount
                extension.discount_amount = int(round(old_value))
                needs_migration = True
                logger.debug(
                    "Converting discount_amount",
                    extension_id=extension.extension_id,
                    old_value=old_value,
                    new_value=extension.discount_amount
                )

            # Check and convert overdue_fee_collected
            if isinstance(extension.overdue_fee_collected, float):
                old_value = extension.overdue_fee_collected
                extension.overdue_fee_collected = int(round(old_value))
                needs_migration = True
                logger.debug(
                    "Converting overdue_fee_collected",
                    extension_id=extension.extension_id,
                    old_value=old_value,
                    new_value=extension.overdue_fee_collected
                )

            # Check and convert net_amount_collected
            if extension.net_amount_collected is not None and isinstance(extension.net_amount_collected, float):
                old_value = extension.net_amount_collected
                extension.net_amount_collected = int(round(old_value))
                needs_migration = True
                logger.debug(
                    "Converting net_amount_collected",
                    extension_id=extension.extension_id,
                    old_value=old_value,
                    new_value=extension.net_amount_collected
                )

            if needs_migration:
                # Save the updated document
                await extension.save()
                migrated_count += 1
                logger.info(
                    "Migrated extension",
                    extension_id=extension.extension_id,
                    formatted_id=extension.formatted_id
                )
            else:
                already_int_count += 1

        except Exception as e:
            error_count += 1
            logger.error(
                "Error migrating extension",
                extension_id=extension.extension_id,
                error=str(e),
                exc_info=True
            )

    # Report statistics
    logger.info(
        "Migration complete",
        total=total_count,
        migrated=migrated_count,
        already_int=already_int_count,
        errors=error_count
    )

    # Close connection
    client.close()


if __name__ == "__main__":
    logger.info("Starting extension model migration (float to int)")
    asyncio.run(migrate_extensions())
    logger.info("Migration script completed")

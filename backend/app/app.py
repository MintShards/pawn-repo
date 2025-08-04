# main.py
from fastapi import FastAPI
from app.core.config import settings
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# Define the database client variable
db_client = None

@app.on_event("startup")
async def on_startup():
    """
    Initialize the application on startup.
    """
    global db_client
    
    client = AsyncIOMotorClient(settings.MONGO_CONNECTION_STRING)
    db_client = client.get_default_database()  # Gets database from connection string
    
    await init_beanie(
        database=db_client, 
        document_models=[
            # Add your document models here when you create them
        ]
    )

@app.on_event("shutdown")
async def on_shutdown():
    """
    Clean up on shutdown.
    """
    global db_client
    if db_client:
        db_client.client.close()
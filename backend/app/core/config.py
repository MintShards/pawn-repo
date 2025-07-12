from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl
from decouple import config
from typing import List

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    JWT_SECRET_KEY: str = config("JWT_SECRET_KEY", cast=str)  
    JWT_REFRESH_SECRET_KEY: str = config("JWT_REFRESH_SECRET_KEY", cast=str)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = config(
        "BACKEND_CORS_ORIGINS", 
        default="http://localhost:3000,http://localhost:5173",
        cast=lambda v: [url.strip() for url in v.split(",")]
    )
    
    PROJECT_NAME: str = "PAWNREPO"
    DEBUG: bool = config("DEBUG", default=False, cast=bool) 
    MONGO_CONNECTION_STRING: str = config("MONGO_CONNECTION_STRING", cast=str)
    
    # Backup settings
    BACKUP_DIRECTORY: str = config("BACKUP_DIRECTORY", default="./backups", cast=str)
    ENABLE_AUTOMATIC_BACKUPS: bool = config("ENABLE_AUTOMATIC_BACKUPS", default=True, cast=bool)

    class Config:
        case_sensitive = True

settings = Settings()
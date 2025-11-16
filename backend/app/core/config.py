"""Application configuration settings."""

from typing import List, Union

from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings
from decouple import config

class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    API_V1_STR: str = "/api/v1"
    JWT_SECRET_KEY: str = config("JWT_SECRET_KEY", cast=str)
    JWT_REFRESH_SECRET_KEY: str = config("JWT_REFRESH_SECRET_KEY", cast=str)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRATION: int = 30  # 30 minutes
    REFRESH_TOKEN_EXPIRATION: int = 60 * 24 * 30  # 30 days (extended for active users)
    PROJECT_NAME: str = "Pawn Repo"
    
    # CORS Configuration
    BACKEND_CORS_ORIGINS: List[Union[str, AnyHttpUrl]] = []
    
    # Security Settings
    ENVIRONMENT: str = config("ENVIRONMENT", default="development")
    REDIS_URL: str = config("REDIS_URL", default="redis://localhost:6379")
    ENABLE_RATE_LIMITING: bool = config("ENABLE_RATE_LIMITING", default=True, cast=bool)
    
    # MongoDB settings
    MONGO_CONNECTION_STRING: str = config("MONGO_CONNECTION_STRING", cast=str)
    
    # Field encryption settings
    FIELD_ENCRYPTION_KEY: str = config("FIELD_ENCRYPTION_KEY", default="", cast=str)
    
    # Business rules configuration
    MAX_ACTIVE_LOANS: int = config("MAX_ACTIVE_LOANS", default=8, cast=int)

    # Trends cache configuration
    TRENDS_CACHE_ENABLED: bool = config("TRENDS_CACHE_ENABLED", default=True, cast=bool)
    TRENDS_CACHE_TTL: int = config("TRENDS_CACHE_TTL", default=300, cast=int)  # 5 minutes in seconds
    TRENDS_CACHE_MAX_SIZE: int = config("TRENDS_CACHE_MAX_SIZE", default=1000, cast=int)
    
    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        # Load from environment using decouple if not provided
        if not v or v == []:
            v = config("BACKEND_CORS_ORIGINS", default="")

        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    class Config:
        case_sensitive = True
        # Note: Using decouple for .env loading instead of Pydantic's env_file
        # to avoid JSON parsing issues with comma-separated BACKEND_CORS_ORIGINS

settings = Settings()
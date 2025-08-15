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
    ACCESS_TOKEN_EXPIRATION: int = 15
    REFRESH_TOKEN_EXPIRATION: int = 60 * 24 * 7  # 7 days
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
    
    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    class Config:
        case_sensitive = True

settings = Settings()
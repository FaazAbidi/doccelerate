from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from pathlib import Path


class Settings(BaseSettings):
    """Application settings"""
    
    # Configuration for the model
    model_config = ConfigDict(
        extra='ignore',  # Ignore extra fields from .env file
        env_file=Path(__file__).parent.parent.parent / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )
    
    # App configuration
    app_name: str = "Doccelerate API"
    app_version: str = "1.0.0"
    debug: bool = False

    # API configuration
    api_prefix: str = "/api/v1"
    allowed_origins: list[str] = ["*"]
    
    REDIS_URL: str
    
    DATABASE_URL: str
    DIRECT_URL: str
    
    # OpenAI configuration
    OPENAI_API_KEY: str
    
    # Supabase configuration
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str


# Create global settings instance
settings = Settings() 
"""Application configuration settings using pydantic-settings."""
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str
    APP_ENV: str = "development"
    
    class Config:
        env_file = ".env"

settings = Settings()

"""Database session and engine setup."""
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncAttrs
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

class Base(AsyncAttrs, DeclarativeBase):
    pass

engine = create_async_engine(settings.DATABASE_URL, echo=True, future=True)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)

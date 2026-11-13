"""API v1 main router."""
from fastapi import APIRouter
from app.api.v1 import health, provinces, sources

router = APIRouter(prefix="/api/v1")
router.include_router(health.router, tags=["Health"])
router.include_router(provinces.router, prefix="/provinces", tags=["Provinces"])
router.include_router(sources.router, prefix="/sources", tags=["Sources"])

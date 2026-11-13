"""Provinces endpoints."""
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_provinces():
    return [{"id": 1, "name": "Tehran"}]

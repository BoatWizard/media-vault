from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from app.core.auth import get_current_user
from app.models.user import User
from app.services.metadata import MetadataService

router = APIRouter()
metadata_service = MetadataService()


class MetadataResult(BaseModel):
    title: str
    media_type: Optional[str] = None
    platform: Optional[str] = None
    release_date: Optional[str] = None
    description: Optional[str] = None
    developer: Optional[str] = None
    publisher: Optional[str] = None
    genre: Optional[List[str]] = None
    region: Optional[str] = None
    cover_art_url: Optional[str] = None
    igdb_id: Optional[int] = None
    tmdb_id: Optional[int] = None
    screenscraper_id: Optional[int] = None
    sources: List[str] = []
    confidence: float = 0.0


@router.get("/barcode/{upc}", response_model=List[MetadataResult])
async def lookup_by_barcode(
    upc: str,
    current_user: User = Depends(get_current_user),
):
    """Lookup metadata by UPC barcode. Returns ranked candidates."""
    results = await metadata_service.lookup_by_upc(upc)
    if not results:
        raise HTTPException(status_code=404, detail="No metadata found for this barcode")
    return results


@router.get("/search", response_model=List[MetadataResult])
async def search_metadata(
    q: str,
    media_type: Optional[str] = None,
    platform: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """Search for metadata by title across IGDB, TMDB, and ScreenScraper."""
    results = await metadata_service.search_by_title(q, media_type=media_type, platform=platform)
    return results



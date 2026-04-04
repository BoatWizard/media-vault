import httpx
import logging
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.models.user import User
from app.services.storage import upload_image, get_presigned_url

logger = logging.getLogger(__name__)
router = APIRouter()


class UploadResponse(BaseModel):
    key: str
    url: str


class FetchRequest(BaseModel):
    url: str


@router.post("/upload", response_model=UploadResponse)
async def upload(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP, and GIF images are allowed")

    image_bytes = await file.read()
    key = await upload_image(image_bytes, file.content_type, str(current_user.id))
    url = get_presigned_url(key)
    return UploadResponse(key=key, url=url)


@router.post("/fetch", response_model=UploadResponse)
async def fetch_url(
    body: FetchRequest,
    current_user: User = Depends(get_current_user),
):
    """Download an external image URL (e.g. cover art from IGDB/TMDB) and store it in MinIO."""
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(body.url)
            resp.raise_for_status()
    except Exception as exc:
        logger.warning("Failed to fetch cover art from %s: %s", body.url, exc)
        raise HTTPException(status_code=502, detail="Could not download image from URL")

    content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()
    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if content_type not in allowed_types:
        content_type = "image/jpeg"

    key = await upload_image(resp.content, content_type, str(current_user.id))
    url = get_presigned_url(key)
    logger.info("Fetched and stored cover art: %s → %s", body.url, key)
    return UploadResponse(key=key, url=url)

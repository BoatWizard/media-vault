from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional, List
from datetime import date
import uuid

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.item import Item, MediaType, ConditionType, CompletenessType
from app.models.user import User
from app.services.storage import get_presigned_url

router = APIRouter()


class ItemCreate(BaseModel):
    title: str
    media_type: MediaType
    platform_id: Optional[int] = None
    release_date: Optional[date] = None
    description: Optional[str] = None
    region: Optional[str] = None
    serial_number: Optional[str] = None
    upc: Optional[str] = None
    genre: Optional[List[str]] = None
    developer: Optional[str] = None
    publisher: Optional[str] = None
    rating: Optional[str] = None
    condition: Optional[ConditionType] = None
    completeness: Optional[CompletenessType] = None
    notes: Optional[str] = None
    cover_image_key: Optional[str] = None
    extra_image_keys: Optional[List[str]] = None
    igdb_id: Optional[int] = None
    tmdb_id: Optional[int] = None
    screenscraper_id: Optional[int] = None
    enrichment_sources: Optional[List[str]] = None
    user_confirmed: bool = False


class ItemResponse(ItemCreate):
    id: str
    owner_id: str
    cover_image_url: Optional[str] = None
    extra_image_urls: Optional[List[str]] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class ItemListResponse(BaseModel):
    items: List[ItemResponse]
    total: int
    page: int
    page_size: int


def item_to_response(item: Item) -> dict:
    """Convert an Item ORM object to a response dict with presigned image URLs."""
    return {
        "id": str(item.id),
        "owner_id": str(item.owner_id),
        "title": item.title,
        "media_type": item.media_type,
        "platform_id": item.platform_id,
        "release_date": item.release_date,
        "description": item.description,
        "region": item.region,
        "serial_number": item.serial_number,
        "upc": item.upc,
        "genre": item.genre,
        "developer": item.developer,
        "publisher": item.publisher,
        "rating": item.rating,
        "condition": item.condition,
        "completeness": item.completeness,
        "notes": item.notes,
        "cover_image_key": item.cover_image_key,
        "cover_image_url": get_presigned_url(item.cover_image_key),
        "extra_image_keys": item.extra_image_keys or [],
        "extra_image_urls": [get_presigned_url(k) for k in (item.extra_image_keys or [])],
        "igdb_id": item.igdb_id,
        "tmdb_id": item.tmdb_id,
        "screenscraper_id": item.screenscraper_id,
        "enrichment_sources": item.enrichment_sources,
        "user_confirmed": item.user_confirmed,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


@router.post("", response_model=dict)
async def create_item(
    body: ItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = Item(owner_id=current_user.id, **body.model_dump())
    db.add(item)
    await db.flush()
    return item_to_response(item)


@router.get("", response_model=ItemListResponse)
async def list_items(
    q: Optional[str] = Query(None, description="Search by title"),
    media_type: Optional[MediaType] = None,
    platform_id: Optional[int] = None,
    user_confirmed: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Item).where(Item.owner_id == current_user.id)

    if q:
        query = query.where(Item.title.ilike(f"%{q}%"))
    if media_type:
        query = query.where(Item.media_type == media_type)
    if platform_id:
        query = query.where(Item.platform_id == platform_id)
    if user_confirmed is not None:
        query = query.where(Item.user_confirmed == user_confirmed)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()

    query = query.order_by(Item.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()

    return ItemListResponse(
        items=[item_to_response(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{item_id}", response_model=dict)
async def get_item(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Item).where(Item.id == uuid.UUID(item_id), Item.owner_id == current_user.id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item_to_response(item)


@router.patch("/{item_id}", response_model=dict)
async def update_item(
    item_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Item).where(Item.id == uuid.UUID(item_id), Item.owner_id == current_user.id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    allowed = {c.name for c in Item.__table__.columns} - {"id", "owner_id", "created_at"}
    for key, value in body.items():
        if key in allowed:
            setattr(item, key, value)

    await db.flush()
    return item_to_response(item)


@router.delete("/{item_id}")
async def delete_item(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Item).where(Item.id == uuid.UUID(item_id), Item.owner_id == current_user.id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    await db.delete(item)
    return {"deleted": item_id}

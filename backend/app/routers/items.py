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
from app.models.permission import InventoryPermission, PermissionLevel
from app.models.wishlist_permission import WishlistPermission
from app.services.storage import get_presigned_url

router = APIRouter()


async def _check_permission(db, owner_id: uuid.UUID, current_user_id: uuid.UUID, require_write: bool = False):
    """Return the permission level or raise 403. Returns None if owner == current user."""
    if owner_id == current_user_id:
        return None
    result = await db.execute(
        select(InventoryPermission).where(
            InventoryPermission.owner_id == owner_id,
            InventoryPermission.grantee_id == current_user_id,
        )
    )
    perm = result.scalar_one_or_none()
    if not perm:
        raise HTTPException(status_code=403, detail="Access denied")
    if require_write and perm.permission != PermissionLevel.read_write:
        raise HTTPException(status_code=403, detail="Read-only access — write permission required")
    return perm.permission


async def _check_wishlist_permission(db, owner_id: uuid.UUID, current_user_id: uuid.UUID, require_owner: bool = False):
    """Wishlist is always read-only for grantees. require_owner=True for write ops."""
    if owner_id == current_user_id:
        return None
    if require_owner:
        raise HTTPException(status_code=403, detail="Only the owner can modify wishlist items")
    result = await db.execute(
        select(WishlistPermission).where(
            WishlistPermission.owner_id == owner_id,
            WishlistPermission.grantee_id == current_user_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Access denied")


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
    is_wishlist: bool = False


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
        "is_wishlist": item.is_wishlist,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


@router.post("", response_model=dict)
async def create_item(
    body: ItemCreate,
    owner_id: Optional[str] = Query(None, description="Create in another user's inventory (requires read_write permission)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if owner_id:
        target_owner_id = uuid.UUID(owner_id)
        await _check_permission(db, target_owner_id, current_user.id, require_write=True)
    else:
        target_owner_id = current_user.id
    item = Item(owner_id=target_owner_id, **body.model_dump())
    db.add(item)
    await db.flush()
    return item_to_response(item)


@router.get("", response_model=ItemListResponse)
async def list_items(
    q: Optional[str] = Query(None, description="Search by title"),
    media_type: Optional[MediaType] = None,
    platform_id: Optional[int] = None,
    user_confirmed: Optional[bool] = None,
    is_wishlist: Optional[bool] = Query(None),
    owner_id: Optional[str] = Query(None, description="View another user's inventory (requires permission)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if owner_id:
        target_owner_id = uuid.UUID(owner_id)
        if is_wishlist:
            await _check_wishlist_permission(db, target_owner_id, current_user.id)
        else:
            await _check_permission(db, target_owner_id, current_user.id)
    else:
        target_owner_id = current_user.id
    query = select(Item).where(Item.owner_id == target_owner_id)

    if q:
        query = query.where(Item.title.ilike(f"%{q}%"))
    if media_type:
        query = query.where(Item.media_type == media_type)
    if platform_id:
        query = query.where(Item.platform_id == platform_id)
    if user_confirmed is not None:
        query = query.where(Item.user_confirmed == user_confirmed)
    if is_wishlist is not None:
        query = query.where(Item.is_wishlist == is_wishlist)
    else:
        query = query.where(Item.is_wishlist == False)  # noqa: E712 — default to inventory

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
    result = await db.execute(select(Item).where(Item.id == uuid.UUID(item_id)))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.is_wishlist:
        await _check_wishlist_permission(db, item.owner_id, current_user.id)
    else:
        await _check_permission(db, item.owner_id, current_user.id)
    return item_to_response(item)


@router.patch("/{item_id}", response_model=dict)
async def update_item(
    item_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Item).where(Item.id == uuid.UUID(item_id)))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.is_wishlist:
        await _check_wishlist_permission(db, item.owner_id, current_user.id, require_owner=True)
    else:
        await _check_permission(db, item.owner_id, current_user.id, require_write=True)

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
    result = await db.execute(select(Item).where(Item.id == uuid.UUID(item_id)))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.is_wishlist:
        await _check_wishlist_permission(db, item.owner_id, current_user.id, require_owner=True)
    else:
        await _check_permission(db, item.owner_id, current_user.id, require_write=True)

    await db.delete(item)
    return {"deleted": item_id}

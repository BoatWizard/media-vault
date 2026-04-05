from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
import uuid

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.wishlist_permission import WishlistPermission

router = APIRouter()


class ShareRequest(BaseModel):
    username: str


@router.get("/granted")
async def list_granted(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WishlistPermission, User)
        .join(User, User.id == WishlistPermission.grantee_id)
        .where(WishlistPermission.owner_id == current_user.id)
    )
    return [
        {
            "id": str(p.id),
            "grantee_id": str(p.grantee_id),
            "grantee_username": u.username,
            "created_at": p.created_at.isoformat(),
        }
        for p, u in result.all()
    ]


@router.get("/received")
async def list_received(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WishlistPermission, User)
        .join(User, User.id == WishlistPermission.owner_id)
        .where(WishlistPermission.grantee_id == current_user.id)
    )
    return [
        {
            "id": str(p.id),
            "owner_id": str(p.owner_id),
            "owner_username": u.username,
            "created_at": p.created_at.isoformat(),
        }
        for p, u in result.all()
    ]


@router.post("", status_code=201)
async def share_wishlist(
    body: ShareRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.username == body.username))
    grantee = result.scalar_one_or_none()
    if not grantee:
        raise HTTPException(status_code=404, detail="User not found")
    if grantee.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot share with yourself")

    existing = await db.execute(
        select(WishlistPermission).where(
            WishlistPermission.owner_id == current_user.id,
            WishlistPermission.grantee_id == grantee.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already shared with this user")

    perm = WishlistPermission(owner_id=current_user.id, grantee_id=grantee.id)
    db.add(perm)
    await db.flush()
    return {
        "id": str(perm.id),
        "grantee_id": str(perm.grantee_id),
        "grantee_username": grantee.username,
        "created_at": perm.created_at.isoformat(),
    }


@router.delete("/{permission_id}", status_code=204)
async def revoke_wishlist_share(
    permission_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WishlistPermission).where(
            WishlistPermission.id == uuid.UUID(permission_id),
            WishlistPermission.owner_id == current_user.id,
        )
    )
    perm = result.scalar_one_or_none()
    if not perm:
        raise HTTPException(status_code=404, detail="Permission not found")
    await db.delete(perm)

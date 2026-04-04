from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
import uuid

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.permission import InventoryPermission, PermissionLevel

router = APIRouter()


class GrantRequest(BaseModel):
    username: str
    permission: PermissionLevel = PermissionLevel.read


class UpdatePermissionRequest(BaseModel):
    permission: PermissionLevel


@router.get("/granted")
async def list_granted(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Permissions I have granted to other users."""
    result = await db.execute(
        select(InventoryPermission, User)
        .join(User, User.id == InventoryPermission.grantee_id)
        .where(InventoryPermission.owner_id == current_user.id)
    )
    return [
        {
            "id": str(p.id),
            "grantee_id": str(p.grantee_id),
            "grantee_username": u.username,
            "permission": p.permission,
            "created_at": p.created_at.isoformat(),
        }
        for p, u in result.all()
    ]


@router.get("/received")
async def list_received(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Inventories other users have shared with me."""
    result = await db.execute(
        select(InventoryPermission, User)
        .join(User, User.id == InventoryPermission.owner_id)
        .where(InventoryPermission.grantee_id == current_user.id)
    )
    return [
        {
            "id": str(p.id),
            "owner_id": str(p.owner_id),
            "owner_username": u.username,
            "permission": p.permission,
            "created_at": p.created_at.isoformat(),
        }
        for p, u in result.all()
    ]


@router.post("", status_code=201)
async def grant_permission(
    body: GrantRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.username == body.username))
    grantee = result.scalar_one_or_none()
    if not grantee:
        raise HTTPException(status_code=404, detail="User not found")
    if grantee.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot grant access to yourself")

    existing = await db.execute(
        select(InventoryPermission).where(
            InventoryPermission.owner_id == current_user.id,
            InventoryPermission.grantee_id == grantee.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Permission already exists for this user — update or revoke it instead")

    perm = InventoryPermission(
        owner_id=current_user.id,
        grantee_id=grantee.id,
        permission=body.permission,
    )
    db.add(perm)
    await db.flush()
    return {
        "id": str(perm.id),
        "grantee_id": str(perm.grantee_id),
        "grantee_username": grantee.username,
        "permission": perm.permission,
        "created_at": perm.created_at.isoformat(),
    }


@router.patch("/{permission_id}")
async def update_permission(
    permission_id: str,
    body: UpdatePermissionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InventoryPermission).where(
            InventoryPermission.id == uuid.UUID(permission_id),
            InventoryPermission.owner_id == current_user.id,
        )
    )
    perm = result.scalar_one_or_none()
    if not perm:
        raise HTTPException(status_code=404, detail="Permission not found")
    perm.permission = body.permission
    await db.flush()

    grantee_result = await db.execute(select(User).where(User.id == perm.grantee_id))
    grantee = grantee_result.scalar_one()
    return {
        "id": str(perm.id),
        "grantee_id": str(perm.grantee_id),
        "grantee_username": grantee.username,
        "permission": perm.permission,
        "created_at": perm.created_at.isoformat(),
    }


@router.delete("/{permission_id}", status_code=204)
async def revoke_permission(
    permission_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InventoryPermission).where(
            InventoryPermission.id == uuid.UUID(permission_id),
            InventoryPermission.owner_id == current_user.id,
        )
    )
    perm = result.scalar_one_or_none()
    if not perm:
        raise HTTPException(status_code=404, detail="Permission not found")
    await db.delete(perm)

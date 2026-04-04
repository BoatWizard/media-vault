from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from pydantic import BaseModel
from typing import List, Optional

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User

router = APIRouter()


class PlatformResponse(BaseModel):
    id: int
    name: str
    short_name: Optional[str]
    media_type: str
    sort_order: int


@router.get("", response_model=List[PlatformResponse])
async def list_platforms(
    media_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = "SELECT id, name, short_name, media_type::text, sort_order FROM platforms"
    params = {}
    if media_type:
        query += " WHERE media_type = :media_type"
        params["media_type"] = media_type
    query += " ORDER BY sort_order, name"

    result = await db.execute(text(query), params)
    rows = result.mappings().all()
    return [PlatformResponse(**row) for row in rows]

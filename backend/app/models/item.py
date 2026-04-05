import uuid
from typing import Optional, List
from sqlalchemy import String, Text, Date, Boolean, Integer, DateTime, Enum, ForeignKey, func, ARRAY
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
import enum


class MediaType(str, enum.Enum):
    game = "game"
    movie = "movie"
    tv_show = "tv_show"
    music = "music"
    book = "book"
    other = "other"


class ConditionType(str, enum.Enum):
    sealed = "sealed"
    mint = "mint"
    very_good = "very_good"
    good = "good"
    fair = "fair"
    poor = "poor"


class CompletenessType(str, enum.Enum):
    sealed = "sealed"
    complete_in_box = "complete_in_box"
    game_only = "game_only"
    box_only = "box_only"
    loose = "loose"
    other = "other"


class Item(Base):
    __tablename__ = "items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    platform_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("platforms.id"), nullable=True)

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    media_type: Mapped[MediaType] = mapped_column(Enum(MediaType, name="media_type"), nullable=False)
    release_date: Mapped[Optional[Date]] = mapped_column(Date, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    region: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    serial_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    upc: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    genre: Mapped[Optional[List[str]]] = mapped_column(ARRAY(Text), nullable=True)
    developer: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    publisher: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    rating: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    condition: Mapped[Optional[ConditionType]] = mapped_column(Enum(ConditionType, name="condition_type"), nullable=True)
    completeness: Mapped[Optional[CompletenessType]] = mapped_column(Enum(CompletenessType, name="completeness_type"), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    cover_image_key: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    extra_image_keys: Mapped[Optional[List[str]]] = mapped_column(ARRAY(Text), nullable=True)

    igdb_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tmdb_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    screenscraper_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    enrichment_sources: Mapped[Optional[List[str]]] = mapped_column(ARRAY(Text), nullable=True)
    user_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    is_wishlist: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

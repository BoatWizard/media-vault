from sqlalchemy import Integer, String, Enum
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.models.item import MediaType


class Platform(Base):
    __tablename__ = "platforms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    short_name: Mapped[str | None] = mapped_column(String(20), nullable=True)
    media_type: Mapped[str] = mapped_column(Enum(MediaType), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

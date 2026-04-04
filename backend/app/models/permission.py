import uuid
import enum
import datetime
from sqlalchemy import Enum, ForeignKey, DateTime, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class PermissionLevel(str, enum.Enum):
    read = "read"
    read_write = "read_write"


class InventoryPermission(Base):
    __tablename__ = "inventory_permissions"
    __table_args__ = (UniqueConstraint("owner_id", "grantee_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    grantee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    permission: Mapped[PermissionLevel] = mapped_column(Enum(PermissionLevel, name="permission_level"), nullable=False, default=PermissionLevel.read)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

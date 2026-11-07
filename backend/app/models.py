from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class TaskStatus(StrEnum):
    TODO = "Yapılacak"
    IN_PROGRESS = "Devam ediyor"
    ON_HOLD = "Beklemede"
    DONE = "Bitti"


class TaskPriority(StrEnum):
    HIGH = "Yüksek"
    MEDIUM = "Orta"
    LOW = "Düşük"


class HistoryField(StrEnum):
    """Audit log'a yazılan alanlar: sadece durum ve atama değişiklikleri."""

    STATUS = "status"
    ASSIGNEE = "assignee_id"


def allowed_values_check(column: str, enum: type[StrEnum]) -> str:
    """Örn. "status IN ('Yapılacak', 'Devam ediyor', ...)" üretir."""
    values = ", ".join(f"'{member.value}'" for member in enum)
    return f"{column} IN ({values})"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(50))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    is_active: Mapped[bool] = mapped_column(default=True)


class Task(Base):
    __tablename__ = "tasks"
    # Durum ve öncelik Postgres ENUM yerine CHECK kısıtlı metin: değer eklemek kolay, okumak basit.
    __table_args__ = (
        CheckConstraint(allowed_values_check("status", TaskStatus), name="status"),
        CheckConstraint(allowed_values_check("priority", TaskPriority), name="priority"),
        CheckConstraint("length(trim(title)) > 0", name="title_not_blank"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), index=True)
    priority: Mapped[str] = mapped_column(String(10))
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    due_date: Mapped[date | None] = mapped_column(Date, index=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    # Soft delete: dolu ise görev silinmiş sayılır; satır ve geçmişi DB'de kalır.
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TaskHistory(Base):
    __tablename__ = "task_history"
    __table_args__ = (CheckConstraint(allowed_values_check("field", HistoryField), name="field"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), index=True)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    changed_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    field: Mapped[str] = mapped_column(String(20))
    # Hem durum hem kişi id'si tutulduğu için metin. İlk atamada old_value boştur.
    old_value: Mapped[str | None] = mapped_column(String(50))
    new_value: Mapped[str | None] = mapped_column(String(50))

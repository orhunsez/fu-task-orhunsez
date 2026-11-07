"""API'nin request/response şemaları (Pydantic). DB modelleri app/models.py'de."""

from datetime import date, datetime
from typing import Annotated

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    StringConstraints,
    computed_field,
    field_validator,
)

from app.models import HistoryField, TaskPriority, TaskStatus
from app.rules import ALLOWED_TRANSITIONS, is_overdue


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    role: str
    email: str
    is_active: bool


# Baştaki/sondaki boşluklar silinir; sadece boşluktan oluşan başlık "boş" sayılır.
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


def empty_to_none(value: str | None) -> str | None:
    """Boş ya da sadece boşluktan oluşan açıklama None olarak saklanır."""
    if value is None:
        return None
    return value.strip() or None


Description = Annotated[str | None, AfterValidator(empty_to_none)]


class TaskCreate(BaseModel):
    title: Title
    description: Description = None
    priority: TaskPriority
    assignee_id: int | None = None
    due_date: date | None = None
    # Auth olmadığı için işlemi yapan kişi istekte gönderilir.
    actor_id: int


class TaskUpdate(BaseModel):
    """PATCH: sadece gönderilen alanlar değişir. assignee_id/due_date için null = kaldır."""

    title: Title | None = None
    description: Description = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    assignee_id: int | None = None
    due_date: date | None = None
    actor_id: int

    @field_validator("title", "status", "priority")
    @classmethod
    def reject_null(cls, value):
        # Bu alanlar gönderilmeyebilir ama gönderilirse null olamaz.
        if value is None:
            raise ValueError("Bu alan boş olamaz.")
        return value


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    status: TaskStatus
    priority: TaskPriority
    assignee_id: int | None
    due_date: date | None
    created_by: int
    created_at: datetime
    updated_at: datetime

    # DB'de sütun değil: yanıt oluşturulurken hesaplanıp JSON'a eklenir.
    @computed_field
    @property
    def is_overdue(self) -> bool:
        return is_overdue(self.status, self.due_date)

    # Arayüzdeki durum menüsü sadece bunları gösterir. Geçiş kuralı böylece tek yerde
    # (rules.ALLOWED_TRANSITIONS) kalır; frontend kuralı kopyalamaz.
    @computed_field
    @property
    def next_statuses(self) -> list[TaskStatus]:
        return list(ALLOWED_TRANSITIONS[self.status])


class TaskListOut(BaseModel):
    items: list[TaskOut]
    total: int
    limit: int
    offset: int


class HistoryOut(BaseModel):
    """Audit log satırı: kim (changed_by), ne zaman (changed_at), neyi (field: eski -> yeni)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    changed_at: datetime
    changed_by: int
    field: HistoryField
    old_value: str | None
    new_value: str | None

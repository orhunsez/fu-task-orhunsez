from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import ApiError
from app.models import Task, TaskStatus, User
from app.rules import today
from app.schemas import TaskCreate, TaskListOut, TaskOut, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])

DbSession = Annotated[Session, Depends(get_db)]


# --- Yardımcılar ---


def get_task_or_404(db: Session, task_id: int) -> Task:
    """Silinmiş (soft delete) görevler de "bulunamadı" sayılır."""
    task = db.get(Task, task_id)
    if task is None or task.deleted_at is not None:
        raise ApiError(404, f"Görev bulunamadı (id={task_id}).")
    return task


def ensure_active_user(db: Session, user_id: int, field: str) -> User:
    """Olmayan ya da pasif kişi 422 döner (karar: CLAUDE.md, hata yönetimi)."""
    user = db.get(User, user_id)
    if user is None:
        raise ApiError(422, f"Kişi bulunamadı (id={user_id}).", field)
    if not user.is_active:
        raise ApiError(422, f"{user.full_name} pasif bir kullanıcı, seçilemez.", field)
    return user


def ensure_not_in_past(due_date, field: str = "due_date") -> None:
    if due_date is not None and due_date < today():
        raise ApiError(422, "Son tarih geçmişte olamaz.", field)


# --- Endpoint'ler ---


@router.get("", response_model=TaskListOut)
def list_tasks(
    db: DbSession,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    query = select(Task).where(Task.deleted_at.is_(None))
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    items = db.scalars(query.order_by(Task.id).limit(limit).offset(offset)).all()
    return TaskListOut(items=items, total=total, limit=limit, offset=offset)


@router.post("", response_model=TaskOut, status_code=201)
def create_task(body: TaskCreate, db: DbSession):
    ensure_active_user(db, body.actor_id, "actor_id")
    if body.assignee_id is not None:
        ensure_active_user(db, body.assignee_id, "assignee_id")
    ensure_not_in_past(body.due_date)

    task = Task(
        title=body.title,
        description=body.description,
        status=TaskStatus.TODO,  # yeni görev her zaman "Yapılacak" ile başlar
        priority=body.priority,
        assignee_id=body.assignee_id,
        due_date=body.due_date,
        created_by=body.actor_id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)  # created_at gibi DB'nin doldurduğu alanları oku
    return task


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: int, db: DbSession):
    return get_task_or_404(db, task_id)


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(task_id: int, body: TaskUpdate, db: DbSession):
    task = get_task_or_404(db, task_id)
    ensure_active_user(db, body.actor_id, "actor_id")

    # Sadece istekte gönderilen alanlar (gönderilmeyenler olduğu gibi kalır)
    changes = body.model_dump(exclude_unset=True, exclude={"actor_id"})

    # Kurallar sadece değer gerçekten değişiyorsa uygulanır. Böylece pasif kişiye atanmış
    # ya da son tarihi geçmiş eski bir görevin başlığı yine düzenlenebilir.
    new_assignee = changes.get("assignee_id")
    if "assignee_id" in changes and new_assignee != task.assignee_id and new_assignee is not None:
        ensure_active_user(db, new_assignee, "assignee_id")
    if "due_date" in changes and changes["due_date"] != task.due_date:
        ensure_not_in_past(changes["due_date"])

    for field, value in changes.items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: DbSession):
    """Soft delete: satır ve değişiklik geçmişi DB'de kalır, görev artık listelenmez."""
    task = get_task_or_404(db, task_id)
    task.deleted_at = func.now()
    db.commit()

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import ApiError
from app.models import HistoryField, Task, TaskHistory, TaskStatus, User
from app.rules import ALLOWED_TRANSITIONS, can_transition, today
from app.schemas import HistoryOut, TaskCreate, TaskListOut, TaskOut, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])

DbSession = Annotated[Session, Depends(get_db)]

# Öncelik metin olarak saklandığı için alfabetik değil, anlamına göre sıralanır.
PRIORITY_RANK = case({"Yüksek": 1, "Orta": 2, "Düşük": 3}, value=Task.priority)

# "-" önekli seçenekler ters sıralama. Son tarihi olmayan görevler her iki yönde de en sonda.
SortOption = Literal["due_date", "-due_date", "priority", "-priority", "created_at", "-created_at"]
SORT_COLUMNS = {
    "due_date": [Task.due_date.asc().nulls_last()],
    "-due_date": [Task.due_date.desc().nulls_last()],
    "priority": [PRIORITY_RANK.asc()],  # önce Yüksek
    "-priority": [PRIORITY_RANK.desc()],  # önce Düşük
    "created_at": [Task.created_at.asc()],
    "-created_at": [Task.created_at.desc()],
}


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


def ensure_valid_transition(current: str, new: str) -> None:
    if not can_transition(current, new):
        allowed = ", ".join(ALLOWED_TRANSITIONS[TaskStatus(current)])
        raise ApiError(
            409,
            f"'{current}' durumundan '{new}' durumuna geçilemez. İzin verilenler: {allowed}.",
            "status",
        )


def record_change(db: Session, task_id: int, field: HistoryField, old, new, actor_id: int) -> None:
    """Audit log satırı ekler. Commit etmez: görev değişikliğiyle aynı transaction'da yazılır,
    böylece biri yazılıp diğeri yazılamama durumu olmaz."""
    db.add(
        TaskHistory(
            task_id=task_id,
            changed_by=actor_id,
            field=field,
            old_value=None if old is None else str(old),
            new_value=None if new is None else str(new),
        )
    )


# --- Endpoint'ler ---


@router.get("", response_model=TaskListOut)
def list_tasks(
    db: DbSession,
    status: TaskStatus | None = None,
    assignee_id: int | None = None,
    unassigned: bool = False,
    overdue: bool = False,
    sort: SortOption = "due_date",
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    """Görev listesi. Filtreler birlikte kullanılabilir (VE ile birleşir).

    Örnek: /tasks?status=Devam ediyor&overdue=true&sort=-priority&limit=20
    """
    query = select(Task).where(Task.deleted_at.is_(None))
    if status is not None:
        query = query.where(Task.status == status)
    if assignee_id is not None:
        query = query.where(Task.assignee_id == assignee_id)
    if unassigned:
        query = query.where(Task.assignee_id.is_(None))
    if overdue:
        # rules.is_overdue ile aynı tanım, SQL olarak: son tarihi bugünden önce ve bitmemiş
        query = query.where(Task.due_date < today(), Task.status != TaskStatus.DONE)

    total = db.scalar(select(func.count()).select_from(query.subquery()))
    # id ikinci sıralama: aynı değerli satırlar sayfalar arasında yer değiştirmesin
    ordered = query.order_by(*SORT_COLUMNS[sort], Task.id)
    items = db.scalars(ordered.limit(limit).offset(offset)).all()
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
    db.flush()  # görevin id'si geçmiş kaydı için gerekli
    if task.assignee_id is not None:
        # İlk atama da geçmişe yazılır (eski değer boş), veri setindeki örnekle aynı.
        record_change(db, task.id, HistoryField.ASSIGNEE, None, task.assignee_id, body.actor_id)
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

    new_assignee = changes.get("assignee_id")
    assignee_changed = "assignee_id" in changes and new_assignee != task.assignee_id
    status_changed = "status" in changes and changes["status"] != task.status

    # Kurallar sadece değer gerçekten değişiyorsa uygulanır. Böylece pasif kişiye atanmış
    # ya da son tarihi geçmiş eski bir görevin başlığı yine düzenlenebilir.
    if assignee_changed and new_assignee is not None:
        ensure_active_user(db, new_assignee, "assignee_id")
    if "due_date" in changes and changes["due_date"] != task.due_date:
        ensure_not_in_past(changes["due_date"])
    if status_changed:
        ensure_valid_transition(task.status, changes["status"])

    # Audit log: sadece durum ve atama değişiklikleri (aynı değere "değişiklik" yazılmaz)
    if status_changed:
        record_change(
            db, task.id, HistoryField.STATUS, task.status, changes["status"], body.actor_id
        )
    if assignee_changed:
        record_change(
            db, task.id, HistoryField.ASSIGNEE, task.assignee_id, new_assignee, body.actor_id
        )

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


@router.get("/{task_id}/history", response_model=list[HistoryOut])
def get_task_history(task_id: int, db: DbSession):
    """Görevin değişiklik geçmişi, en yenisi önce."""
    get_task_or_404(db, task_id)
    query = (
        select(TaskHistory)
        .where(TaskHistory.task_id == task_id)
        .order_by(TaskHistory.changed_at.desc(), TaskHistory.id.desc())
    )
    return db.scalars(query).all()

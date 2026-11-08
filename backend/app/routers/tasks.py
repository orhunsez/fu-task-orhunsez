"""Görev endpoint'leri.

GET    /tasks               liste (filtre, sıralama, sayfalama)
POST   /tasks               oluştur
GET    /tasks/{id}          tek görev
PATCH  /tasks/{id}          güncelle (durum geçişi kontrolü + audit log)
DELETE /tasks/{id}          soft delete
GET    /tasks/{id}/history  değişiklik geçmişi

İş kuralları app/rules.py'de, hata gövdesinin formatı app/errors.py'de.
"""

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import ApiError
from app.models import HistoryField, Task, TaskHistory, TaskPriority, TaskStatus, User
from app.rules import ALLOWED_TRANSITIONS, can_transition, today
from app.schemas import HistoryOut, TaskCreate, TaskListOut, TaskOut, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])

# Endpoint parametresi olarak yazılınca FastAPI istek başına bir DB session'ı verir.
DbSession = Annotated[Session, Depends(get_db)]

# Öncelik metin olarak saklandığı için alfabetik değil, anlamına göre sıralanır.
PRIORITY_RANK = case(
    {TaskPriority.HIGH: 1, TaskPriority.MEDIUM: 2, TaskPriority.LOW: 3}, value=Task.priority
)

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


# --- Kontroller: kural bozulursa ApiError fırlatır, errors.py bunu JSON yanıta çevirir ---


def get_task_or_404(db: Session, task_id: int) -> Task:
    """Silinmiş (soft delete) görevler de "bulunamadı" sayılır."""
    task = db.get(Task, task_id)
    if task is None or task.deleted_at is not None:
        raise ApiError(404, f"Görev bulunamadı (id={task_id}).")
    return task


def ensure_active_user(db: Session, user_id: int, field: str) -> None:
    """Kişi yoksa ya da pasifse 422. `field`, hatanın hangi alana ait olduğunu söyler."""
    user = db.get(User, user_id)
    if user is None:
        raise ApiError(422, f"Kişi bulunamadı (id={user_id}).", field)
    if not user.is_active:
        raise ApiError(422, f"{user.full_name} pasif bir kullanıcı, seçilemez.", field)


def ensure_not_in_past(due_date: date | None) -> None:
    if due_date is not None and due_date < today():
        raise ApiError(422, "Son tarih geçmişte olamaz.", "due_date")


def ensure_valid_transition(current: str, new: str) -> None:
    if not can_transition(current, new):
        allowed = ", ".join(ALLOWED_TRANSITIONS[TaskStatus(current)])
        raise ApiError(
            409,
            f"'{current}' durumundan '{new}' durumuna geçilemez. İzin verilenler: {allowed}.",
            "status",
        )


def ensure_valid_range(due_from: date | None, due_to: date | None) -> None:
    if due_from is not None and due_to is not None and due_from > due_to:
        raise ApiError(422, "Bitiş tarihi başlangıç tarihinden önce olamaz.", "due_to")


def filter_conditions(
    statuses: list[TaskStatus] | None,
    assignee_ids: list[int] | None,
    unassigned: bool,
    overdue: bool,
    due_from: date | None = None,
    due_to: date | None = None,
) -> list:
    """Liste filtrelerini SQL koşullarına çevirir; silinmiş görevler her zaman dışarıda.

    Aynı filtredeki değerler VEYA ile birleşir (Yapılacak ya da Beklemede), farklı filtreler
    VE ile (seçilen durumlardan birinde ve seçilen kişilerden birine atanmış).
    """
    conditions = [Task.deleted_at.is_(None)]
    if statuses:
        conditions.append(Task.status.in_(statuses))

    # Kişi filtresi: seçilen kişilerin görevleri ve istenirse atanmamış görevler, VEYA ile.
    people = []
    if assignee_ids:
        people.append(Task.assignee_id.in_(assignee_ids))
    if unassigned:
        people.append(Task.assignee_id.is_(None))
    if people:
        conditions.append(or_(*people))

    if overdue:
        # rules.is_overdue ile aynı tanım, SQL olarak: son tarihi bugünden önce ve bitmemiş
        conditions += [Task.due_date < today(), Task.status != TaskStatus.DONE]

    # Son tarih aralığı, iki uç dahil (takvim görünen ayı böyle çeker). Son tarihi boş
    # görevler karşılaştırmada elenir, yani aralık verilince listeye girmez.
    if due_from is not None:
        conditions.append(Task.due_date >= due_from)
    if due_to is not None:
        conditions.append(Task.due_date <= due_to)
    return conditions


def record_change(
    db: Session, task_id: int, field: HistoryField, *, old, new, actor_id: int
) -> None:
    """Audit log'a bir satır ekler ama commit etmez.

    Commit'i endpoint yapar; böylece görev değişikliği ve geçmiş kaydı aynı transaction'da
    yazılır. Biri yazılıp diğeri yazılamama durumu olmaz.
    """
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
    # Liste parametreleri tekrarlanabilir: ?status=Yapılacak&status=Beklemede. Tek değer de olur.
    status: Annotated[list[TaskStatus] | None, Query()] = None,
    assignee_id: Annotated[list[int] | None, Query()] = None,
    unassigned: bool = False,
    overdue: bool = False,
    due_from: date | None = None,
    due_to: date | None = None,
    sort: SortOption = "due_date",
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    """Görev listesi. Aynı filtredeki değerler VEYA, farklı filtreler VE ile birleşir.

    Örnek: /tasks?status=Yapılacak&status=Beklemede&assignee_id=3&unassigned=true&overdue=true
    Son tarih aralığı: /tasks?due_from=2026-11-01&due_to=2026-11-30 (iki uç dahil)
    """
    ensure_valid_range(due_from, due_to)
    conditions = filter_conditions(status, assignee_id, unassigned, overdue, due_from, due_to)
    query = select(Task).where(*conditions)

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
    db.flush()  # INSERT çalışır ve görev id alır; geçmiş kaydı bu id'ye bağlanacak
    if task.assignee_id is not None:
        # İlk atama da geçmişe yazılır (eski değer boş); veri setinde de böyle bir örnek var.
        record_change(
            db,
            task.id,
            HistoryField.ASSIGNEE,
            old=None,
            new=task.assignee_id,
            actor_id=body.actor_id,
        )
    db.commit()  # görev + ilk atama kaydı birlikte
    db.refresh(task)  # created_at gibi DB'nin doldurduğu alanları oku
    return task


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: int, db: DbSession):
    return get_task_or_404(db, task_id)


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(task_id: int, body: TaskUpdate, db: DbSession):
    task = get_task_or_404(db, task_id)
    ensure_active_user(db, body.actor_id, "actor_id")

    # 1) Sadece istekte gönderilen alanlar alınır; gönderilmeyenler olduğu gibi kalır.
    changes = body.model_dump(exclude_unset=True, exclude={"actor_id"})
    status_changed = "status" in changes and changes["status"] != task.status
    assignee_changed = "assignee_id" in changes and changes["assignee_id"] != task.assignee_id
    due_date_changed = "due_date" in changes and changes["due_date"] != task.due_date

    # 2) Kurallar sadece gerçekten değişen değere uygulanır. Böylece pasif kişiye atanmış
    #    ya da son tarihi geçmiş eski bir görevin başlığı yine düzenlenebilir.
    if status_changed:
        ensure_valid_transition(task.status, changes["status"])
    if assignee_changed and changes["assignee_id"] is not None:
        ensure_active_user(db, changes["assignee_id"], "assignee_id")
    if due_date_changed:
        ensure_not_in_past(changes["due_date"])

    # 3) Audit log: eski değerler üzerine yazılmadan önce kaydedilir.
    if status_changed:
        record_change(
            db,
            task.id,
            HistoryField.STATUS,
            old=task.status,
            new=changes["status"],
            actor_id=body.actor_id,
        )
    if assignee_changed:
        record_change(
            db,
            task.id,
            HistoryField.ASSIGNEE,
            old=task.assignee_id,
            new=changes["assignee_id"],
            actor_id=body.actor_id,
        )

    # 4) Değişiklikleri uygula. Görev ve geçmiş kayıtları tek commit'le birlikte yazılır.
    for field, value in changes.items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: DbSession):
    """Soft delete: satır ve değişiklik geçmişi DB'de kalır, görev artık listelenmez."""
    task = get_task_or_404(db, task_id)
    task.deleted_at = func.now()  # DB'nin saatiyle "şimdi"
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

"""dataset/ altındaki CSV'leri temizleyip veritabanına yükler.

Çalıştırma (backend/ içinden):  uv run python -m scripts.seed
Veri sorunları ve kararlar: docs/plan-model-seed.md

DB'de kişi varsa hiçbir şey yapmaz; bu yüzden her açılışta güvenle çalıştırılabilir.
"""

import csv
import os
from datetime import date, datetime
from pathlib import Path

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import HistoryField, Task, TaskHistory, TaskPriority, TaskStatus, User

# Varsayılan: repo kökündeki dataset/. Docker'da DATASET_DIR=/dataset olarak verilir.
DATASET_DIR = Path(os.getenv("DATASET_DIR", Path(__file__).resolve().parents[2] / "dataset"))

TITLE_MAX_LENGTH = 80

# Büyük/küçük harf ve baştaki/sondaki boşluk fark etmeden eşleştirmek için: "bitti" -> Bitti
STATUS_BY_KEY = {status.value.casefold(): status for status in TaskStatus}
PRIORITY_BY_KEY = {priority.value.casefold(): priority for priority in TaskPriority}


# --- Temizleme fonksiyonları (DB'ye dokunmaz, tek tek test edilir) ---


def normalize_status(raw: str) -> TaskStatus:
    """Sorun 1: "Devam Ediyor " ve "bitti" gibi yazım farklarını düzeltir."""
    key = raw.strip().casefold()
    if key not in STATUS_BY_KEY:
        raise ValueError(f"Bilinmeyen durum: {raw!r}")
    return STATUS_BY_KEY[key]


def normalize_priority(raw: str) -> TaskPriority | None:
    """Boşsa None döner (sorun 5: çağıran taraf varsayılan olarak Orta atar)."""
    key = raw.strip().casefold()
    if not key:
        return None
    if key not in PRIORITY_BY_KEY:
        raise ValueError(f"Bilinmeyen öncelik: {raw!r}")
    return PRIORITY_BY_KEY[key]


def parse_due_date(raw: str) -> date | None:
    """Sorun 3 ve 4: YYYY-MM-DD ya da GG.AA.YYYY okunur; boşsa None."""
    value = raw.strip()
    if not value:
        return None
    for date_format in ("%Y-%m-%d", "%d.%m.%Y"):
        try:
            return datetime.strptime(value, date_format).date()
        except ValueError:
            continue
    raise ValueError(f"Tarih okunamadı: {raw!r}")


def parse_utc_timestamp(raw: str) -> datetime:
    """ISO 8601 zamanını (örn. 2026-09-18T06:15:00Z) saat dilimli datetime'a çevirir."""
    return datetime.fromisoformat(raw.strip())


def title_from_description(description: str) -> str:
    """Sorun 6: başlık boşsa açıklamanın ilk cümlesi başlık olur (en fazla 80 karakter)."""
    first_sentence = description.strip().split(".")[0].strip()
    if not first_sentence:
        return "Başlıksız görev"
    return first_sentence[:TITLE_MAX_LENGTH]


def parse_optional_int(raw: str) -> int | None:
    value = raw.strip()
    return int(value) if value else None


# --- CSV -> model nesneleri ---


def read_csv(file_name: str) -> list[dict[str, str]]:
    # newline="": çok satırlı açıklamaları (sorun 13) csv modülü doğru okusun diye.
    with open(DATASET_DIR / file_name, newline="", encoding="utf-8") as file:
        return list(csv.DictReader(file))


def build_users(rows: list[dict[str, str]]) -> list[User]:
    return [
        User(
            id=int(row["id"]),
            full_name=row["full_name"].strip(),
            role=row["role"].strip(),
            email=row["email"].strip(),
            is_active=row["is_active"].strip().lower() == "true",
        )
        for row in rows
    ]


def clean_task_row(row: dict[str, str], user_ids: set[int], notes: list[str]) -> Task:
    """tasks.csv'deki tek bir satırı temizleyip Task nesnesine çevirir.

    Yapılan her düzeltme `notes` listesine yazılır (seed sonunda rapor olarak basılır).
    """
    task_id = int(row["id"])
    description = row["description"].strip() or None

    title = row["title"].strip()
    if not title:  # sorun 6
        title = title_from_description(description or "")
        notes.append(f"görev {task_id}: başlık boş -> açıklamadan türetildi: {title!r}")

    status = normalize_status(row["status"])  # sorun 1
    if status.value != row["status"]:
        notes.append(f"görev {task_id}: durum {row['status']!r} -> {status.value!r}")

    priority = normalize_priority(row["priority"])  # sorun 5
    if priority is None:
        priority = TaskPriority.MEDIUM
        notes.append(f"görev {task_id}: öncelik boş -> {priority.value!r}")

    due_date = parse_due_date(row["due_date"])  # sorun 3 ve 4
    if due_date and row["due_date"].strip() != due_date.isoformat():
        notes.append(f"görev {task_id}: tarih {row['due_date']!r} -> {due_date.isoformat()}")

    assignee_id = parse_optional_int(row["assignee_id"])  # sorun 7
    if assignee_id is not None and assignee_id not in user_ids:
        notes.append(f"görev {task_id}: kişi {assignee_id} yok -> atanmamış")
        assignee_id = None

    created_at = parse_utc_timestamp(row["created_at"])
    return Task(
        id=task_id,
        title=title,
        description=description,
        status=status,
        priority=priority,
        assignee_id=assignee_id,
        due_date=due_date,
        created_by=int(row["created_by"]),
        created_at=created_at,
        updated_at=created_at,
    )


def build_tasks(rows: list[dict[str, str]], user_ids: set[int], notes: list[str]) -> list[Task]:
    """Tüm satırları temizler; içeriği daha önce görülmüş görevi (sorun 10, mükerrer) atlar."""
    tasks: list[Task] = []
    first_id_by_content: dict[tuple, int] = {}  # görevin içeriği -> o içeriği ilk taşıyan id

    for row in rows:
        task = clean_task_row(row, user_ids, notes)
        content = (
            task.title,
            task.description,
            task.status,
            task.priority,
            task.assignee_id,
            task.due_date,
        )
        if content in first_id_by_content:
            first_id = first_id_by_content[content]
            notes.append(f"görev {task.id}: görev {first_id} ile aynı (mükerrer) -> atlandı")
            continue
        first_id_by_content[content] = task.id
        tasks.append(task)
    return tasks


def build_history(
    rows: list[dict[str, str]], task_ids: set[int], notes: list[str]
) -> list[TaskHistory]:
    history: list[TaskHistory] = []
    for row in rows:
        task_id = int(row["task_id"])
        if task_id not in task_ids:
            notes.append(f"geçmiş {row['id']}: görev {task_id} yok -> atlandı")
            continue

        field = HistoryField(row["field"].strip())
        old_value = row["old_value"].strip() or None
        new_value = row["new_value"].strip() or None
        if field == HistoryField.STATUS:
            old_value = normalize_status(old_value).value if old_value else None
            new_value = normalize_status(new_value).value if new_value else None

        history.append(
            TaskHistory(
                id=int(row["id"]),
                task_id=task_id,
                changed_at=parse_utc_timestamp(row["changed_at"]),
                changed_by=int(row["changed_by"]),
                field=field,
                old_value=old_value,
                new_value=new_value,
            )
        )
    return history


def flag_history_conflicts(tasks: list[Task], history: list[TaskHistory], notes: list[str]) -> None:
    """Sorun 12: geçmişteki son değer görevin güncel değeriyle uyuşmuyorsa sadece raporlar.

    Güncel durum için tasks.csv esas alınır (export anındaki hali); hiçbir şey değiştirilmez.
    """
    # (görev id, alan) -> geçmişteki en son yeni değer. Zamana göre sıralı gezildiği için
    # aynı anahtara yazılan son değer, en güncel değişiklik olur.
    latest: dict[tuple[int, str], str | None] = {}
    for entry in sorted(history, key=lambda h: h.changed_at):
        latest[(entry.task_id, entry.field)] = entry.new_value

    for task in tasks:
        current = {
            HistoryField.STATUS: str(task.status),
            HistoryField.ASSIGNEE: str(task.assignee_id) if task.assignee_id else None,
        }
        for field, current_value in current.items():
            key = (task.id, field)
            if key in latest and latest[key] != current_value:
                notes.append(
                    f"görev {task.id}: geçmişe göre {field}={latest[key]!r}, "
                    f"tabloda {current_value!r} -> tablo esas alındı"
                )


def reset_id_sequences(session: Session) -> None:
    """Id'ler CSV'den geldiği için Postgres sayaçlarını en büyük id'ye çeker.

    Yapılmazsa API'den eklenen ilk görev id=1 almaya çalışır ve çakışır.
    """
    for table in ("users", "tasks", "task_history"):
        session.execute(
            text(
                f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
                f"(SELECT MAX(id) FROM {table}))"
            )
        )


def seed(session: Session) -> list[str]:
    """Tüm yüklemeyi yapar ve rapor satırlarını döner. Commit çağıran tarafta."""
    notes: list[str] = []

    users = build_users(read_csv("users.csv"))
    session.add_all(users)
    session.flush()  # görevlerdeki foreign key'ler için önce kişiler yazılır

    task_rows = read_csv("tasks.csv")
    tasks = build_tasks(task_rows, {user.id for user in users}, notes)
    session.add_all(tasks)
    session.flush()

    history_rows = read_csv("task_history.csv")
    history = build_history(history_rows, {task.id for task in tasks}, notes)
    session.add_all(history)
    flag_history_conflicts(tasks, history, notes)

    reset_id_sequences(session)

    summary = [
        f"users: {len(users)} eklendi",
        f"tasks: {len(tasks)} eklendi, {len(task_rows) - len(tasks)} atlandı",
        f"task_history: {len(history)} eklendi, {len(history_rows) - len(history)} atlandı",
    ]
    return summary + ["", "Düzeltmeler ve işaretlenenler:"] + [f"  - {n}" for n in notes]


def main() -> None:
    # Hepsi tek transaction: bir hata olursa hiçbir şey yazılmaz.
    with SessionLocal() as session, session.begin():
        if session.scalar(select(func.count()).select_from(User)):
            print("Seed atlandı: veritabanı zaten dolu.")
            return
        report = seed(session)
    print("Seed tamamlandı.")
    print("\n".join(report))


if __name__ == "__main__":
    main()

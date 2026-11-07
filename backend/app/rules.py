"""İş kuralları. DB'ye dokunmayan saf fonksiyonlar; kolayca test edilir."""

from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.models import TaskStatus

# Ekip Türkiye'de çalışıyor: "bugün" İstanbul saatine göre hesaplanır (sunucu UTC olsa bile).
TEAM_TIMEZONE = ZoneInfo("Europe/Istanbul")


# Durum geçiş tablosu (CLAUDE.md, iş kuralları). Burada olmayan geçiş 409 döner.
ALLOWED_TRANSITIONS: dict[TaskStatus, tuple[TaskStatus, ...]] = {
    TaskStatus.TODO: (TaskStatus.IN_PROGRESS,),
    TaskStatus.IN_PROGRESS: (TaskStatus.ON_HOLD, TaskStatus.DONE, TaskStatus.TODO),
    TaskStatus.ON_HOLD: (TaskStatus.IN_PROGRESS,),
    TaskStatus.DONE: (TaskStatus.IN_PROGRESS,),  # yeniden açma
}


def can_transition(current: str, new: str) -> bool:
    return TaskStatus(new) in ALLOWED_TRANSITIONS[TaskStatus(current)]


def today() -> date:
    return datetime.now(TEAM_TIMEZONE).date()


def is_overdue(status: str, due_date: date | None, reference_day: date | None = None) -> bool:
    """Gecikmiş: son tarihi bugünden önce ve bitmemiş. Son tarihi olmayan görev gecikmez."""
    if due_date is None or status == TaskStatus.DONE:
        return False
    return due_date < (reference_day or today())

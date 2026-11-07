"""İş kuralları. DB'ye dokunmayan saf fonksiyonlar; kolayca test edilir."""

from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.models import TaskStatus

# Ekip Türkiye'de çalışıyor: "bugün" İstanbul saatine göre hesaplanır (sunucu UTC olsa bile).
TEAM_TIMEZONE = ZoneInfo("Europe/Istanbul")


def today() -> date:
    return datetime.now(TEAM_TIMEZONE).date()


def is_overdue(status: str, due_date: date | None, reference_day: date | None = None) -> bool:
    """Gecikmiş: son tarihi bugünden önce ve bitmemiş. Son tarihi olmayan görev gecikmez."""
    if due_date is None or status == TaskStatus.DONE:
        return False
    return due_date < (reference_day or today())

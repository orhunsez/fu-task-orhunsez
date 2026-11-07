"""Seed'in veri temizleme kuralları (docs/plan-model-seed.md, bölüm 2)."""

from datetime import date

import pytest

from app.models import TaskPriority, TaskStatus
from scripts.seed import (
    build_history,
    build_tasks,
    normalize_priority,
    normalize_status,
    parse_due_date,
    title_from_description,
)


def task_row(**overrides: str) -> dict[str, str]:
    row = {
        "id": "1",
        "title": "Görev",
        "description": "Açıklama.",
        "status": "Yapılacak",
        "priority": "Orta",
        "assignee_id": "1",
        "due_date": "2026-11-20",
        "created_by": "1",
        "created_at": "2026-11-01T06:00:00Z",
    }
    return row | overrides


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Devam Ediyor ", TaskStatus.IN_PROGRESS),
        ("bitti", TaskStatus.DONE),
        ("Beklemede", TaskStatus.ON_HOLD),
    ],
)
def test_normalize_status_fixes_spacing_and_case(raw, expected):
    assert normalize_status(raw) == expected


def test_normalize_status_rejects_unknown_value():
    with pytest.raises(ValueError):
        normalize_status("İptal")


def test_empty_priority_returns_none():
    assert normalize_priority("") is None
    assert normalize_priority(" yüksek") == TaskPriority.HIGH


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("2026-11-17", date(2026, 11, 17)),
        ("17.11.2026", date(2026, 11, 17)),
        ("", None),
    ],
)
def test_parse_due_date_accepts_both_formats(raw, expected):
    assert parse_due_date(raw) == expected


def test_title_from_description_uses_first_sentence():
    assert (
        title_from_description("RT-04 nacelle içinde yağ izi var, bakılacak.")
        == "RT-04 nacelle içinde yağ izi var, bakılacak"
    )


def test_unknown_assignee_becomes_unassigned():
    notes: list[str] = []
    [task] = build_tasks([task_row(assignee_id="12")], user_ids={1, 2}, notes=notes)

    assert task.assignee_id is None
    assert "kişi 12 yok" in notes[0]


def test_empty_priority_defaults_to_medium():
    [task] = build_tasks([task_row(priority="")], user_ids={1}, notes=[])
    assert task.priority == TaskPriority.MEDIUM


def test_duplicate_task_is_skipped():
    rows = [task_row(id="30"), task_row(id="31", created_at="2026-11-01T06:02:00Z")]
    notes: list[str] = []

    tasks = build_tasks(rows, user_ids={1}, notes=notes)

    assert [task.id for task in tasks] == [30]
    assert "mükerrer" in notes[0]


def test_history_for_missing_task_is_skipped():
    rows = [
        {
            "id": "34",
            "task_id": "43",
            "changed_at": "2026-10-24T06:00:00Z",
            "changed_by": "1",
            "field": "assignee_id",
            "old_value": "",
            "new_value": "5",
        }
    ]
    notes: list[str] = []

    assert build_history(rows, task_ids={1, 2}, notes=notes) == []
    assert "görev 43 yok" in notes[0]

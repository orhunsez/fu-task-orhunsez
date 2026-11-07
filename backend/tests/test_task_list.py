"""Görev listesi: filtreler (durum, kişi, gecikme), sıralama ve sayfalama."""

from datetime import timedelta

import pytest

from app.models import Task
from app.rules import is_overdue, today

TODAY = today()


@pytest.fixture
def tasks(session_factory):
    """Gecikme kuralının tüm kenar durumlarını içeren küçük bir veri seti."""
    rows = [
        # id, durum, öncelik, kişi, son tarih
        (1, "Devam ediyor", "Yüksek", 2, TODAY - timedelta(days=3)),  # gecikmiş
        (2, "Bitti", "Orta", 2, TODAY - timedelta(days=3)),  # tarihi geçmiş ama bitmiş
        (3, "Yapılacak", "Düşük", 1, TODAY),  # bugün son gün: gecikmiş değil
        (4, "Beklemede", "Orta", None, TODAY - timedelta(days=1)),  # gecikmiş, atanmamış
        (5, "Yapılacak", "Yüksek", 1, None),  # son tarihi yok: gecikmiş değil
    ]
    with session_factory() as session:
        session.add_all(
            Task(
                id=task_id,
                title=f"Görev {task_id}",
                status=status,
                priority=priority,
                assignee_id=assignee_id,
                due_date=due_date,
                created_by=1,
            )
            for task_id, status, priority, assignee_id, due_date in rows
        )
        session.commit()


def ids(response) -> list[int]:
    return [task["id"] for task in response.json()["items"]]


def test_overdue_filter(client, tasks):
    response = client.get("/tasks", params={"overdue": "true"})

    assert sorted(ids(response)) == [1, 4]
    assert all(task["is_overdue"] for task in response.json()["items"])


def test_overdue_rule_edges():
    yesterday = TODAY - timedelta(days=1)
    assert is_overdue("Devam ediyor", yesterday) is True
    assert is_overdue("Bitti", yesterday) is False
    assert is_overdue("Yapılacak", TODAY) is False
    assert is_overdue("Yapılacak", None) is False


def test_status_and_assignee_filters_combine(client, tasks):
    response = client.get("/tasks", params={"status": "Yapılacak", "assignee_id": 1})

    assert sorted(ids(response)) == [3, 5]


def test_unassigned_filter(client, tasks):
    assert ids(client.get("/tasks", params={"unassigned": "true"})) == [4]


def test_invalid_status_filter_returns_422(client, tasks):
    response = client.get("/tasks", params={"status": "İptal"})

    assert response.status_code == 422
    assert response.json()["field"] == "status"


def test_default_sort_is_due_date_with_empty_last(client, tasks):
    assert ids(client.get("/tasks")) == [1, 2, 4, 3, 5]


def test_sort_by_priority_high_first(client, tasks):
    assert ids(client.get("/tasks", params={"sort": "priority"})) == [1, 5, 2, 4, 3]


def test_pagination_returns_total(client, tasks):
    response = client.get("/tasks", params={"limit": 2, "offset": 2})

    body = response.json()
    assert body["total"] == 5
    assert (body["limit"], body["offset"]) == (2, 2)
    assert ids(response) == [4, 3]

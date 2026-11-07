from datetime import timedelta

import pytest

from app.models import Task
from app.rules import today


def new_task(**overrides):
    body = {"title": "RT-03 yağ numunesi", "priority": "Orta", "assignee_id": 2, "actor_id": 1}
    return body | overrides


def test_create_task_starts_as_todo(client):
    response = client.post("/tasks", json=new_task(description="  "))

    assert response.status_code == 201
    task = response.json()
    assert task["status"] == "Yapılacak"
    assert task["created_by"] == 1
    assert task["description"] is None  # sadece boşluk -> None
    assert task["is_overdue"] is False


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"title": "   "}, "title"),
        ({"priority": "Acil"}, "priority"),
        ({"due_date": "17.11.2026"}, "due_date"),
    ],
)
def test_create_task_validation_errors(client, overrides, field):
    response = client.post("/tasks", json=new_task(**overrides))

    assert response.status_code == 422
    assert response.json()["field"] == field


def test_missing_title_is_reported(client):
    body = new_task()
    del body["title"]

    response = client.post("/tasks", json=body)

    assert response.status_code == 422
    assert response.json() == {"detail": "Bu alan zorunlu.", "field": "title"}


def test_assign_to_unknown_user_returns_422(client):
    response = client.post("/tasks", json=new_task(assignee_id=12))

    assert response.status_code == 422
    assert response.json() == {"detail": "Kişi bulunamadı (id=12).", "field": "assignee_id"}


def test_assign_to_inactive_user_returns_422(client):
    response = client.post("/tasks", json=new_task(assignee_id=9))

    assert response.status_code == 422
    assert response.json()["field"] == "assignee_id"


def test_create_with_past_due_date_returns_422(client):
    yesterday = (today() - timedelta(days=1)).isoformat()

    response = client.post("/tasks", json=new_task(due_date=yesterday))

    assert response.status_code == 422
    assert response.json()["field"] == "due_date"


def test_get_missing_task_returns_404(client):
    response = client.get("/tasks/999")

    assert response.status_code == 404
    assert response.json() == {"detail": "Görev bulunamadı (id=999).", "field": None}


def test_update_changes_only_sent_fields(client):
    task_id = client.post("/tasks", json=new_task(description="Eski")).json()["id"]

    response = client.patch(f"/tasks/{task_id}", json={"title": "Yeni başlık", "actor_id": 1})

    assert response.status_code == 200
    assert response.json()["title"] == "Yeni başlık"
    assert response.json()["description"] == "Eski"


def test_update_can_unassign(client):
    task_id = client.post("/tasks", json=new_task()).json()["id"]

    response = client.patch(f"/tasks/{task_id}", json={"assignee_id": None, "actor_id": 1})

    assert response.json()["assignee_id"] is None


def test_update_rejects_null_title(client):
    task_id = client.post("/tasks", json=new_task()).json()["id"]

    response = client.patch(f"/tasks/{task_id}", json={"title": None, "actor_id": 1})

    assert response.status_code == 422
    assert response.json()["field"] == "title"


def test_old_task_of_inactive_user_stays_editable(client, session_factory):
    # Veri setindeki gibi: pasif kişiye atanmış ve son tarihi geçmiş eski bir görev
    with session_factory() as session:
        session.add(
            Task(
                id=50,
                title="Eski iş",
                status="Devam ediyor",
                priority="Orta",
                assignee_id=9,
                due_date=today() - timedelta(days=10),
                created_by=1,
            )
        )
        session.commit()

    response = client.patch("/tasks/50", json={"title": "Eski iş (güncel)", "actor_id": 1})

    assert response.status_code == 200
    assert response.json()["assignee_id"] == 9
    assert response.json()["is_overdue"] is True


def test_delete_is_soft(client, session_factory):
    task_id = client.post("/tasks", json=new_task()).json()["id"]

    assert client.delete(f"/tasks/{task_id}").status_code == 204
    assert client.get(f"/tasks/{task_id}").status_code == 404
    assert client.get("/tasks").json()["total"] == 0
    with session_factory() as session:
        assert session.get(Task, task_id).deleted_at is not None  # satır DB'de duruyor

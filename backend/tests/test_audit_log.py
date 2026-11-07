"""Durum geçiş kuralı ve audit log (task_history) yazımı."""

import pytest

from app.models import Task
from app.rules import can_transition


def create_task(client, **overrides) -> int:
    body = {"title": "Görev", "priority": "Orta", "assignee_id": 2, "actor_id": 1} | overrides
    return client.post("/tasks", json=body).json()["id"]


def set_status(client, task_id: int, status: str, actor_id: int = 2):
    return client.patch(f"/tasks/{task_id}", json={"status": status, "actor_id": actor_id})


def history(client, task_id: int) -> list[dict]:
    return client.get(f"/tasks/{task_id}/history").json()


def test_initial_assignment_is_logged(client):
    task_id = create_task(client)

    [entry] = history(client, task_id)
    assert entry["field"] == "assignee_id"
    assert (entry["old_value"], entry["new_value"]) == (None, "2")
    assert entry["changed_by"] == 1


def test_unassigned_task_has_empty_history(client):
    task_id = create_task(client, assignee_id=None)

    assert history(client, task_id) == []


def test_status_change_is_logged_with_actor(client):
    task_id = create_task(client)

    response = set_status(client, task_id, "Devam ediyor", actor_id=2)

    assert response.status_code == 200
    latest = history(client, task_id)[0]
    assert latest["field"] == "status"
    assert (latest["old_value"], latest["new_value"]) == ("Yapılacak", "Devam ediyor")
    assert latest["changed_by"] == 2


def test_reassignment_is_logged(client):
    task_id = create_task(client)

    client.patch(f"/tasks/{task_id}", json={"assignee_id": 1, "actor_id": 1})

    latest = history(client, task_id)[0]
    assert (latest["field"], latest["old_value"], latest["new_value"]) == ("assignee_id", "2", "1")


def test_same_value_and_other_fields_are_not_logged(client):
    task_id = create_task(client)

    client.patch(
        f"/tasks/{task_id}",
        json={"status": "Yapılacak", "assignee_id": 2, "title": "Yeni", "actor_id": 1},
    )

    assert len(history(client, task_id)) == 1  # sadece ilk atama


def test_invalid_transition_returns_409_and_changes_nothing(client):
    task_id = create_task(client)

    response = set_status(client, task_id, "Bitti")  # Yapılacak -> Bitti yasak

    assert response.status_code == 409
    assert response.json()["field"] == "status"
    assert client.get(f"/tasks/{task_id}").json()["status"] == "Yapılacak"
    assert len(history(client, task_id)) == 1


def test_done_task_can_be_reopened(client):
    task_id = create_task(client)
    set_status(client, task_id, "Devam ediyor")
    set_status(client, task_id, "Bitti")

    response = set_status(client, task_id, "Devam ediyor")

    assert response.status_code == 200
    assert history(client, task_id)[0]["old_value"] == "Bitti"


def test_history_of_missing_task_returns_404(client):
    assert client.get("/tasks/999/history").status_code == 404


def test_deleted_task_keeps_history_in_db(client, session_factory):
    task_id = create_task(client)
    client.delete(f"/tasks/{task_id}")

    with session_factory() as session:
        task = session.get(Task, task_id)
        assert task is not None and task.deleted_at is not None


@pytest.mark.parametrize(
    ("current", "new", "allowed"),
    [
        ("Yapılacak", "Devam ediyor", True),
        ("Yapılacak", "Bitti", False),
        ("Devam ediyor", "Beklemede", True),
        ("Devam ediyor", "Yapılacak", True),
        ("Beklemede", "Bitti", False),
        ("Bitti", "Devam ediyor", True),
        ("Bitti", "Yapılacak", False),
    ],
)
def test_transition_table(current, new, allowed):
    assert can_transition(current, new) is allowed

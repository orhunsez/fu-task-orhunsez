def test_list_users_includes_inactive(client):
    response = client.get("/users")

    assert response.status_code == 200
    users = {user["id"]: user for user in response.json()}
    assert set(users) == {1, 2, 9}
    assert users[9]["is_active"] is False


def test_unknown_route_uses_common_error_format(client):
    response = client.get("/olmayan-adres")

    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found", "field": None}

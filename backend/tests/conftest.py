"""Testler için ortak hazırlık.

Testler bellek içi SQLite ile çalışır: Docker/Postgres gerekmez, her test temiz bir DB alır.
Kullandığımız SQL (CHECK, index, tarih karşılaştırma) iki veritabanında da aynı davranır.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app
from app.models import User


@pytest.fixture
def session_factory():
    # StaticPool: bellek içi DB tek bağlantıda yaşar; tüm session'lar aynı veriyi görür.
    engine = create_engine(
        "sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)

    with factory() as session:
        session.add_all(
            [
                User(id=1, full_name="Selin Aydın", role="Ekip Lideri", email="selin@x.test"),
                User(id=2, full_name="Murat Yıldız", role="Mühendis", email="murat@x.test"),
                User(
                    id=9,
                    full_name="Okan Kurt",
                    role="Teknisyen",
                    email="okan@x.test",
                    is_active=False,
                ),
            ]
        )
        session.commit()

    yield factory
    engine.dispose()


@pytest.fixture
def client(session_factory):
    def override_get_db():
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()

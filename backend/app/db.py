from collections.abc import Iterator

from sqlalchemy import MetaData, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.config import settings

# Serverless (Vercel) ortamında fonksiyonlar kısa ömürlü; uygulama içinde bağlantı havuzu tutmayız.
# Havuzu Neon'un pooled bağlantısı (pgbouncer) tutar. Bu yüzden NullPool.
engine = create_engine(settings.database_url, poolclass=NullPool)

# expire_on_commit=False: commit'ten sonra nesneyi response'a çevirirken DB'ye tekrar gitmesin.
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    # Index ve constraint isimleri sabit bir kalıpla üretilsin; migration'lar okunur olsun.
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(table_name)s_%(column_0_name)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ck": "ck_%(table_name)s_%(constraint_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        }
    )


def get_db() -> Iterator[Session]:
    """FastAPI dependency: her istek için bir session açar, istek bitince kapatır."""
    with SessionLocal() as session:
        yield session

from logging.config import fileConfig

import app.models  # noqa: F401  (tabloların Base.metadata'ya kaydolması için import)
from alembic import context
from app.db import Base, engine

if context.config.config_file_name is not None:
    fileConfig(context.config.config_file_name)

# Autogenerate, modellerdeki tabloları bu metadata ile DB'deki durumla karşılaştırır.
target_metadata = Base.metadata


def run_migrations() -> None:
    # Uygulamanın engine'i kullanılır; adres DATABASE_URL ortam değişkeninden gelir.
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


run_migrations()

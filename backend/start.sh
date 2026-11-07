#!/bin/sh
# Sadece local Docker için başlangıç: migration -> seed -> API.
# Prod'da (Vercel) bu dosya çalışmaz; migration ve seed orada elle, bir kez çalıştırılır.
set -e

alembic upgrade head
python -m scripts.seed
exec uvicorn app.main:app --host 0.0.0.0 --port 8000

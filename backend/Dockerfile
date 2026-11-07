FROM python:3.12-slim

# uv'yi resmi imajından kopyala (pip yerine; uv.lock ile birebir aynı paketler kurulur)
COPY --from=ghcr.io/astral-sh/uv:0.13.7 /uv /bin/uv
ENV UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never

WORKDIR /app

# Önce sadece bağımlılıklar: kod değişince bu katman cache'ten gelir
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-dev

COPY . .

EXPOSE 8000
CMD ["uv", "run", "--no-dev", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

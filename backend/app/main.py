from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.errors import register_error_handlers
from app.routers import tasks, users

app = FastAPI(title="Saha Bakım Görev Takip API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)
app.include_router(users.router)
app.include_router(tasks.router)


@app.get("/health")
def health() -> dict[str, str]:
    """Deploy'un ayakta olduğunu kontrol etmek için. DB'ye dokunmaz."""
    return {"status": "ok"}

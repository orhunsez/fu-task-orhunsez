from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.schemas import UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(db: Annotated[Session, Depends(get_db)]):
    """Ekip listesi (pasifler dahil). Arayüz atama ve "işlem yapan kişi" seçicisinde kullanır."""
    return db.scalars(select(User).order_by(User.full_name)).all()

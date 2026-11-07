"""API'nin request/response şemaları (Pydantic). DB modelleri app/models.py'de."""

from pydantic import BaseModel, ConfigDict


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    role: str
    email: str
    is_active: bool

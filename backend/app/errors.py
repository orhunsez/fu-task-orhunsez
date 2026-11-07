"""Tüm hatalar aynı gövdeyle döner: {"detail": "...", "field": "..."}.

`field` hatanın hangi alandan kaynaklandığını söyler (form o alanın altında gösterir);
alanla ilgisi olmayan hatalarda null'dır.
"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ApiError(Exception):
    """İş kuralı hataları için: raise ApiError(409, "...", field="status")"""

    def __init__(self, status_code: int, detail: str, field: str | None = None):
        self.status_code = status_code
        self.detail = detail
        self.field = field


def error_body(detail: str, field: str | None = None) -> dict[str, str | None]:
    return {"detail": detail, "field": field}


# Pydantic'in hata tiplerine Türkçe mesajlar. Listede olmayan tipte Pydantic'in mesajı kullanılır.
VALIDATION_MESSAGES = {
    "missing": "Bu alan zorunlu.",
    "string_too_short": "Bu alan boş olamaz.",
    "string_too_long": "En fazla {max_length} karakter olabilir.",
    "enum": "Geçersiz değer. Geçerli değerler: {expected}.",
    "literal_error": "Geçersiz değer. Geçerli değerler: {expected}.",
    "int_parsing": "Tam sayı olmalı.",
    "bool_parsing": "true ya da false olmalı.",
    "date_parsing": "Tarih YYYY-MM-DD formatında olmalı.",
    "date_from_datetime_parsing": "Tarih YYYY-MM-DD formatında olmalı.",
    "greater_than_equal": "En az {ge} olmalı.",
    "less_than_equal": "En fazla {le} olabilir.",
}


async def handle_api_error(request: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=error_body(exc.detail, exc.field))


async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    # İlk hatayı döneriz; tutarlı tek bir {"detail", "field"} gövdesi için yeterli.
    error = exc.errors()[0]
    # loc örn. ("body", "title") ya da ("query", "limit"); ilk eleman hatanın yeri, gerisi alan adı.
    field = ".".join(str(part) for part in error["loc"][1:]) or None
    template = VALIDATION_MESSAGES.get(error["type"])
    if template:
        message = template.format(**error.get("ctx", {}))
    else:
        message = error["msg"].removeprefix("Value error, ")
    return JSONResponse(status_code=422, content=error_body(message, field))


async def handle_http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    # Olmayan adres (404) ya da yanlış method (405) gibi framework hataları da aynı formatta dönsün.
    return JSONResponse(
        status_code=exc.status_code, content=error_body(str(exc.detail)), headers=exc.headers
    )


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApiError, handle_api_error)
    app.add_exception_handler(RequestValidationError, handle_validation_error)
    app.add_exception_handler(StarletteHTTPException, handle_http_error)

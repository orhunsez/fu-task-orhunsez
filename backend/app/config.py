from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Uygulama ayarları. Değerler ortam değişkenlerinden (veya .env dosyasından) okunur."""

    # .env repo kökünde durur; backend/ içinden çalıştırınca da bulunsun diye ikisine de bakılır.
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    # Local varsayılanı docker-compose'daki Postgres'e işaret eder; secret değildir.
    # Not (port çakışması): docker-compose Postgres'i bilgisayarın 5432 portuna açar. Makinede
    # 5432'yi kullanan başka bir Postgres varsa `docker compose up` "port is already allocated"
    # hatası verir. O zaman docker-compose.yml'deki eşlemeyi "5433:5432" yapmak yeterli; backend'i
    # Docker dışında çalıştırıyorsan buradaki ve .env'deki portu da 5433 yap.
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/tasks"

    # Virgülle ayrılmış izinli origin listesi, örn. "http://localhost:3000,https://x.vercel.app"
    cors_origins: str = "http://localhost:3000"

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, value: str) -> str:
        # Neon/Vercel adresi "postgres://" ya da "postgresql://" ile verir.
        # SQLAlchemy'ye psycopg 3 sürücüsünü kullanmasını söylemek için öneki değiştiririz.
        for prefix in ("postgres://", "postgresql://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value.removeprefix(prefix)
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()

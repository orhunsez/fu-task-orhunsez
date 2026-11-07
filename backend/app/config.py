from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Uygulama ayarları. Değerler ortam değişkenlerinden (veya .env dosyasından) okunur."""

    # .env repo kökünde durur; backend/ içinden çalıştırınca da bulunsun diye ikisine de bakılır.
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    # Local varsayılanı docker-compose'daki Postgres'e işaret eder; secret değildir.
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/tasks"

    # Virgülle ayrılmış izinli origin listesi, örn. "http://localhost:3000,https://x.vercel.app"
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()

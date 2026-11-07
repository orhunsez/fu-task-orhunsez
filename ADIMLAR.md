# ADIMLAR.md: geliştirme günlüğü

Her adım kısaca: ne yapıldı, hangi dosyalar, neden. Parantez içindeki kod, ilgili commit'in kısa hash'i.

---

## 0. Ortam hazırlığı (repo dışı)
- WSL2 (Ubuntu) üzerinde araçlar kontrol edildi. Eksik olanlar sudo kullanmadan, kullanıcı dizinine kuruldu: uv, Python 3.12, ruff, gh, Vercel CLI.
- Docker, Docker Desktop'ın WSL entegrasyonuyla açıldı.
- Ayrıntılar `setup.md` dosyasında. Bu dosya kişisel olduğu için repoya girmiyor.

## 1. İlk commit (`b863a4e`)
- Case study dokümanı (PDF + md), `CLAUDE.md`, `README.md` ve `dataset/` eklendi.
- `.gitignore`: `setup.md`, `.env`, Python/Node build çıktıları ve Windows'un bıraktığı `*:Zone.Identifier` dosyaları dışarıda.

## 2. İş kuralları (`70ebf83`)
- 4 durum: Yapılacak / Devam ediyor / Beklemede / Bitti. "Beklemede" veride gerçekten kullanıldığı için korundu.
- Durum geçişleri kısıtlı, kurala uymayan geçiş 409 döner. Bitti → Devam ediyor ile yeniden açma var.
- Soft delete (`deleted_at`); görevin geçmişi korunur.
- Olmayan ya da pasif kişiye atama 422 döner.
- Gecikme kuralı: `due_date < bugün` (İstanbul saati) ve durum Bitti değil.

## 3. Backend iskeleti (`db5c118`)
- `backend/pyproject.toml`: bağımlılıklar (FastAPI, SQLAlchemy, Alembic, psycopg, pydantic-settings, uvicorn) ve ruff/pytest ayarları. `uv.lock` ile sürümler sabit.
- `app/config.py`: `DATABASE_URL` ve `CORS_ORIGINS` ortam değişkenlerinden okunuyor.
- `app/main.py`: FastAPI uygulaması, CORS ayarı ve `GET /health`.
- `tests/test_health.py`: ilk test.

## 4. Frontend iskeleti (`1bea7ec`)
- `create-next-app` ile kuruldu: Next.js 16, App Router, TypeScript, Tailwind. Üstüne shadcn/ui eklendi.
- Kütüphaneler: TanStack Query, react-hook-form, zod.
- `src/lib/api.ts`: `apiFetch` yardımcısı. Backend adresini `NEXT_PUBLIC_API_URL`'den alıyor; hata durumunda `ApiError` fırlatıyor.
- `src/app/providers.tsx`: QueryClient provider'ı.
- `src/app/page.tsx`: şimdilik backend bağlantı durumunu gösteriyor.
- `next.config.ts`: Next'in sunucu tarafı önbellek özellikleri kapalı, çünkü veri tamamen client'ta çekiliyor.

## 5. Docker ile local ortam (`2fc780f`)
- `docker-compose.yml`: `db` (Postgres 17), `backend` (:8000) ve `frontend` (:3000) servisleri.
- `backend/Dockerfile`: bağımlılıklar uv ile `uv.lock`'tan kuruluyor.
- `frontend/Dockerfile`: `npm ci` ve production build. `NEXT_PUBLIC_API_URL` build arg olarak veriliyor.
- `.env.example`: sadece local için örnek değerler. Prod secret'ları Vercel'de duruyor.

## 6. Dokümantasyon
- Bu dosya eklendi. README'ye çalıştırma ve durdurma komutları yazıldı.

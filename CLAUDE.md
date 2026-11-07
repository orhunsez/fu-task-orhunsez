# CLAUDE.md — Ekip Görev Takip Uygulaması

Rüzgar santralindeki 8 kişilik saha bakım ekibi için görev takip uygulaması (case study).
Bu dosya projedeki kararların ve çalışma kurallarının tek kaynağı. Her oturumda buna uy.

## Zaman ve teslim

- Süre: **07.11.2026 13:00 → 09.11.2026 01:00** (Europe/Istanbul). Hedef efor: 6–8 saat.
- Teslim edilecekler: Git repo linki, deploy linki, README, `.env.example` ve seed script.
- Her şeyi bitirmek şart değil. Öncelik sırası net olmalı. Yapılamayanlar README'de "yapılmadı" olarak yazılır.
- Teslimden sonra commit push edilmez.

## Stack (kesinleşti)

| Katman | Seçim |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, psycopg 3 |
| DB | PostgreSQL: prod'da Neon (Vercel entegrasyonu), local'de Docker |
| Frontend | Next.js (App Router, TypeScript), TanStack Query, react-hook-form + zod, Tailwind + shadcn/ui |
| Deploy | Vercel: aynı repodan iki proje (Root Directory `backend/` ve `frontend/`) |
| Test | pytest (FastAPI TestClient) |
| Tooling | uv (Python paketleri), ruff (lint/format) |

Kapsam dışı: AI özet botu, authentication, drag & drop, bildirimler, mobil.

## Mimari kararlar

- **Frontend sade tutulur:** Sayfalar client component olarak yazılır, veri TanStack Query ile FastAPI'den çekilir. Server Components ve Server Actions ile veri işi yapılmaz; tek backend FastAPI'dir.
- **Görünüm liste/tablo.** Kanban yok, çünkü drag & drop istenmiyor ve filtre/sıralama tabloda daha doğal.
- **Kişiler** sabit bir listeden seçilir (`users` tablosu). "Kim değiştirdi" bilgisi, auth olmadığı için request'te gönderilen `actor_id` ile alınır; arayüzde "işlem yapan kişi" seçicisi olur. *(Varsayım: README'ye yazılacak.)*
- **Audit log** ayrı bir tablodur (`task_history`). Durum ve atama değişiklikleri, görev güncellemesiyle **aynı transaction** içinde yazılır. Endpoint: `GET /tasks/{id}/history`.
- **Hata yönetimi:**
  - 422: şema/validasyon hatası (boş başlık, geçersiz enum)
  - 404: görev bulunamadı
  - 422: olmayan ya da pasif (`is_active=false`) kişiye atama, `field=assignee_id`. 404 sadece URL'deki görev yoksa döner.
  - 409: geçersiz durum geçişi (geçiş tablosu aşağıda)
  - Hata gövdesi her zaman tutarlı formatta: `{"detail": "...", "field": "..."}`.
- **Ölçeklenme:** Liste endpoint'inde sayfalama (limit/offset). Filtrelenen alanlara index: `status`, `assignee_id`, `due_date`.

## Vercel / serverless kısıtları (önemli)

- Fonksiyonlar stateless ve geçicidir. Dosya sistemine veya belleğe kalıcı veri yazılmaz, bu yüzden prod'da SQLite kullanılmaz.
- SQLAlchemy'de `NullPool` kullanılır. Prod'da Neon'un **pooled** connection string'i kullanılır.
- Migration ve seed app startup'ında **çalışmaz**. Local'den bir kez prod DB'ye karşı elle çalıştırılır.
- CORS: izinli origin'ler `CORS_ORIGINS` env değişkeninden okunur (local + Vercel frontend domain'i).
- Frontend backend'e `NEXT_PUBLIC_API_URL` üzerinden bağlanır.
- Secret'lar sadece Vercel env değişkenlerinde ve local `.env` dosyasında durur. `.env` repoya girmez, `.env.example` girer.

## Klasör yapısı

```
/backend          FastAPI uygulaması (app/, alembic/, tests/, scripts/seed.py)
/frontend         Next.js uygulaması
/dataset          users.csv, tasks.csv, task_history.csv, README.md
docker-compose.yml
.env.example
README.md
CLAUDE.md
```

## Local çalıştırma (hedef: en çok 3 adım)

```
cp .env.example .env
docker compose up        # postgres + backend + frontend; migration + seed otomatik
```

Değerlendirici repoyu clone'layıp hiçbir secret olmadan çalıştırabilmeli.

## Veri seti

- `dataset/` içinde: `users.csv` (9 kişi), `tasks.csv` (42 görev), `task_history.csv` (55 kayıt). Sütunlar `dataset/README.md` dosyasında.
- **Veri kirli kabul edilir.** Kod yazmadan önce CSV'ler analiz edilir ve sorunlar listelenir (tarih formatları, boş alanlar, yazım farkları, olmayan kişiler, tutarsız durumlar vb.).
- Her sorun için bir karar verilir: düzelt, varsayılan değer ata, atla ya da işaretle. Seed script bu kuralları uygular. Liste ve kararlar README'ye yazılır.
- Uygulama hem local'de hem deploy'da veriyle dolu açılmalı.

## İş kuralları (karara bağlandı, README'ye yazılacak)

- [x] **Durumlar (4 adet):** Yapılacak / Devam ediyor / Beklemede / Bitti. "Beklemede" dokümanda yok ama veride gerçek kullanım var (parça/randevu bekleyen işler), bu yüzden korunur.
- [x] **Durum geçişleri kısıtlı.** Kurala uymayan geçiş 409 döner. Aynı duruma "geçiş" değişiklik sayılmaz, log yazılmaz.
  - Yapılacak → Devam ediyor
  - Devam ediyor → Beklemede, Bitti, Yapılacak (geri alma)
  - Beklemede → Devam ediyor
  - Bitti → Devam ediyor (yeniden açma)
- [x] **Gecikme:** `due_date < bugün` (Europe/Istanbul) ve `status != Bitti`. Son tarihi olmayan görev gecikmiş sayılmaz.
- [x] **Silme: soft delete.** `deleted_at` doldurulur, görev listede ve detayda görünmez (404), geçmişi DB'de korunur.
- [x] **Öncelik:** Yüksek / Orta / Düşük, zorunlu. Seed'de boş öncelik → Orta.
- [x] **Atanmamış görev olabilir** (`assignee_id` nullable).
- [x] **Geçmiş son tarih:** Yeni görev oluştururken son tarih geçmişte olamaz (422). Güncellemede yalnızca tarih değiştiriliyorsa kontrol edilir; eski görevler düzenlenebilir kalır.
- [x] **Pasif kişi:** Mevcut görevleri korunur, yeni atama yapılamaz (422).

*Seçilmemiş varsayımlar (kullanıcıya bildirildi):* gecikme, öncelik, atanmamış görev ve geçmiş son tarih kuralları Claude'un önerisidir.

## Gereksinim checklist'i

**Backend**
- [ ] Model: başlık, açıklama, durum (Yapılacak / Devam ediyor / Beklemede / Bitti), öncelik, atanan kişi, son tarih
- [ ] CRUD endpoint'leri
- [ ] Filtre: durum, atanan kişi, geciken; sıralama
- [ ] Audit log: kim, ne zaman, neyi (durum + atama değişiklikleri)
- [ ] Anlamlı hata mesajları ve doğru status code'lar
- [ ] Kritik yerlerde testler: validasyon, olmayan kişiye atama, audit log yazımı, gecikme filtresi

**Frontend**
- [ ] Görev listesi
- [ ] Oluşturma/düzenleme formu; atama ve atanan kişiyi değiştirme; görünür validasyon mesajları
- [ ] Filtreler: durum, kişi, geciken
- [ ] Detay görünümünde değişiklik geçmişi
- [ ] Loading, empty ve error state'leri

**Deploy ve README**
- [ ] Backend + frontend Vercel'de, DB Neon'da, veriyle dolu
- [ ] README: çalıştırma adımları, kararlar ve varsayımlar, veri sorunları ve kararları, bilerek yapılmayanlar, "2 gün daha olsa", çalışma süresi, AI kullanımı, deploy linki ve yöntemi, cold start notu

## İş sırası

1. Repo iskeleti + ilk commit
2. CSV analizi → veri sorunları listesi
3. Model + Alembic migration + seed script
4. Backend'in erken deploy'u (hello world seviyesinde; Vercel + Neon bağlantısını erkenden doğrula)
5. CRUD + filtre/sıralama + audit log + hata yönetimi + testler
6. Frontend: liste → form → detay/geçmiş → filtreler → state'ler
7. Frontend deploy, uçtan uca kontrol
8. README; repoyu boş klasöre clone'layıp adımları sıfırdan dene

## Çalışma kuralları (Claude için)

- **Commit:** Commitlerin başında genel sektörde kullanılan "doc: ", "feat : " gibi başlıklar olsun. Küçük, tek mantıksal birim; mesaj Türkçe ve açıklayıcı olsun (örn. "görev listesine durum filtresi eklendi"). "wip" veya "düzeltme" gibi mesajlar yazılmaz. **Squash, rebase, amend ve force push kesinlikle yok.** Commit'ten önce `ruff` ve `pytest` çalıştırılır. 
- **Büyük adımlarda önce plan:** Veri modeli, audit log ve seed gibi adımlarda önce plan sunulur, onaydan sonra kod yazılır.
- **Açıklanabilir kod:** Kullanıcı her satırı görüşmede açıklayacak. Gereksiz soyutlama, sihirli kütüphane ya da gereğinden karmaşık pattern kullanılmaz. Açık olmayan kararlar kısa bir yorumla açıklanır. Gereken/ iterasyonlu yerlerde class / function tiplerini kullan.
- **Belirsizlikte:** Kullanıcıya sor. Olabilecek "makul varsayımları" listele ve kullanıcıya söyle. Final karar alındıktan sonra "Karar verilecek iş kuralları" bölümüne ve README'ye işle.
- **Secret'lar:** Hiçbir secret koda veya repoya yazılmaz. 

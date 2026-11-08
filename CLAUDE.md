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
- **Frontend kuralları backend'i kopyalamaz:** durum menüsü `TaskOut.next_statuses`'tan, gecikme `is_overdue`'dan gelir. Düzenlemede PATCH'e sadece değişen alanlar gider; geçmiş tarih kontrolü sadece tarih değişince çalışır. Pasif kişiye atanmış görevde o kişi "(pasif)" etiketiyle listede kalır.
- **İşlem yapan kişi** tarayıcıda (localStorage) tutulur, sadece aktif kişiler seçilebilir; seçilmeden kaydedilemez. Silme `actor_id` almaz (silen kişi kaydedilmiyor, bilinen eksik).
- **Filtreler sayfa state'inde,** URL'de değil: detaydan dönünce sıfırlanır ("2 gün daha olsa" listesine).

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
- [x] **Yeni görev her zaman "Yapılacak" ile başlar.** Oluştururken durum seçilmez; sonrası geçiş kurallarına tabi.
- [x] **Audit log'a ilk atama da yazılır** (oluştururken atanan kişi varsa, `old_value` boş).
- [x] **Kurallar sadece değişen değere uygulanır:** pasif kişiye atanmış ya da tarihi geçmiş eski görevin başlığı yine düzenlenebilir.

*Seçilmemiş varsayımlar (kullanıcıya bildirildi):* gecikme, öncelik, atanmamış görev ve geçmiş son tarih kuralları Claude'un önerisidir.

## Gereksinim checklist'i

**Backend**
- [x] Model: başlık, açıklama, durum (Yapılacak / Devam ediyor / Beklemede / Bitti), öncelik, atanan kişi, son tarih
- [x] CRUD endpoint'leri
- [x] Filtre: durum, atanan kişi, geciken; sıralama
- [x] Audit log: kim, ne zaman, neyi (durum + atama değişiklikleri)
- [x] Anlamlı hata mesajları ve doğru status code'lar
- [x] Kritik yerlerde testler: validasyon, olmayan kişiye atama, audit log yazımı, gecikme filtresi (testler bellek içi SQLite ile)

**Frontend** (plan: `docs/plan-frontend.md`)
- [x] Görev listesi (tablo, durum renkleri, gecikmiş görevde kırmızı tarih + etiket, sayfa başına 20)
- [x] Oluşturma/düzenleme formu; atama ve atanan kişiyi değiştirme; görünür validasyon mesajları (zod + backend'in `field` alanı)
- [x] Filtreler: durum, kişi (atanmamış ve pasifler dahil), geciken; sıralama
- [x] Detay görünümünde değişiklik geçmişi (kişi id'leri isimle, en altta "Görev oluşturuldu")
- [x] Loading, empty ve error state'leri ("Tekrar dene", "Filtreleri temizle", "Görev bulunamadı")

**Deploy ve README**
- [x] Backend + frontend Vercel'de, DB Neon'da, veriyle dolu
- [x] README: çalıştırma adımları, kararlar ve varsayımlar, veri sorunları ve kararları, bilerek yapılmayanlar, "2 gün daha olsa", çalışma süresi, AI kullanımı, deploy linki ve yöntemi, cold start notu

## İş sırası

1. ✅ Repo iskeleti + ilk commit
2. ✅ CSV analizi → veri sorunları listesi (`docs/plan-model-seed.md`)
3. ✅ Model + Alembic migration + seed script
4. ⏭ Backend'in erken deploy'u: kullanıcı kararıyla (07.11) frontend'den sonraya alındı
5. ✅ CRUD + filtre/sıralama + audit log + hata yönetimi + testler
6. ✅ Frontend: liste → filtreler → işlem yapan kişi → form → detay/geçmiş → silme
7. ✅ Backend + frontend deploy, uçtan uca kontrol (08.11)
8. 🔄 README yazıldı (08.11); clean-clone testi ve push kaldı

## Durum ve devir notu

> 08.11.2026 15:02 (İstanbul) itibarıyla. Yeni oturum önce bu bölümü okusun; adım adım ayrıntı `ADIMLAR.md`'de (kişisel, repoda yok).

- **Bitti ve commit'lendi:** backend (55 test, ruff temiz) ve frontend. Frontend headless tarayıcıda 33 kontrolle denendi (Docker'daki production build'e karşı); her frontend commit'i tek başına lint + build + tip kontrolünden geçiyor.
- **Deploy bitti (08.11):** frontend https://fu-task-orhunsez.vercel.app, backend https://fu-task-orhunsez-api.vercel.app (`828be3e`). Neon şifresi 08.11'de yenilendi (eski şifre bir araç çıktısına sızmıştı); entegrasyon yeni şifreyi Vercel'e kendisi yazdı.
- **README yazıldı (08.11).** "Yapay zekâ kullanımı" bölümünü kullanıcı sonra kendisi yeniden yazacak; o bölüme dokunma. Görsel iyileştirmeler README'yi etkilerse güncelle.
- **Sırada:** frontend görsel iyileştirmeleri → son deploy (her şey commit'liyken, iki klasörden `vercel deploy --prod`) → clean-clone testi → GitHub'a push. Remote `git@github.com:orhunsez/fu-task-orhunsez.git` tanımlı (SSH çalışıyor, repo **public** ve henüz boş). Son teslim **09.11.2026 01:00**; sonrasında push yok.
- **İnceleme önerileri için kararlar (07.11):** eşzamanlı güncellemede satır kilidi, `deleted_by` ve DB hatası için 503 handler koda **eklenmeyecek** (README'de bilinen eksik/2 gün daha olsa). Port çakışması `backend/app/config.py`'de not olarak duruyor. "Bitmiş görevler listenin başında" ve "filtreler URL'de" yapılmadı.

**Deploy notları**
- Vercel hesabı `orhunsez-4700` (Hobby). Projeler `fu-task-orhunsez-api` (backend/) ve `fu-task-orhunsez` (frontend/), CLI ile her klasörden `vercel deploy --prod`. Git bağlantısı yok; son deploy her şey commit'liyken yapılmalı.
- `vercel.json`'larda framework (`fastapi`/`nextjs`) ve bölge `fra1`. Neon `aws-eu-central-1`, ücretsiz, Auth/Realtime kapalı.
- `vercel link` her seferinde token içeren `.env.local` oluşturuyor; silinmeli (backend `.dockerignore` sadece `.env`'i dışlıyor).
- Neon değişkenleri sensitive: `vercel env pull` değer vermez. Migration/seed için unpooled adres kullanıcıdan alınır (Vercel → Storage → .env.local → Show secret), ekrana basılmadan kullanılır, sonra silinir.
- Sıfırlama (veri bozulursa): unpooled adresle `alembic downgrade base && alembic upgrade head && python -m scripts.seed`.
- Ölçümler (08.11): 12 dk boşluktan sonra ilk `/tasks` ~3 sn, sonrakiler 0,3–0,4 sn (README'de).

**README için notlar**
- Çalışma süresi: Claude Code oturumları 07.11 17:09–20:18 ve 20:27–22:40; commit'ler 18:09–19:19 ve 22:36–22:37. Kullanıcının kendi hazırlık süresi eklenmeli.
- AI kullanımı: kararlar ve incelemeler Sonnet (medium), kod Opus ile; 07.11 akşamki inceleme, frontend kodu ve tarayıcı testleri Opus ile.
- Geciken görev sayısı tarihe bağlı: 07.11'de 9, 08.11'de 11 (29 ve 34 eklenir), 09.11'de 12 (39 eklenir).
- Seed sonucu: 9 kişi, 41 görev, 53 geçmiş kaydı; yeni görev id'si 43'ten başlar. Rapor: `docker compose logs backend`.

**Bilinmesi gerekenler**
- Frontend yığını: Next 16.4 (Turbopack), React 19.3, Tailwind 4 (`next.config.ts`'deki turbopack kuralı). shadcn stili `base-nova`: bileşenler `@base-ui/react` üstünde, `cn` npm paketinden. `buttonVariants`'ı `Link`'e doğrudan verirken `outline` kullanma (çerçeve sınıfları birleşmiyor); `ghost` ya da varsayılan varyant kullan.
- `next dev` her açılışta `frontend/AGENTS.md` üretir; gitignore'da.
- Backend testleri bellek içi SQLite ile çalışır. Postgres'e özgü davranışlar psql ya da Swagger ile elle denenir. Frontend için repoda otomatik test yok (plan kararı).
- Oturum kayıtları: `~/.claude/projects/-home-orhun-code-fu-task-orhunsez/*.jsonl`.

## Çalışma kuralları (Claude için)

- **Commit:** Commitlerin başında genel sektörde kullanılan "doc: ", "feat : " gibi başlıklar olsun. Küçük, tek mantıksal birim; mesaj Türkçe ve açıklayıcı olsun (örn. "görev listesine durum filtresi eklendi"). "wip" veya "düzeltme" gibi mesajlar yazılmaz. **Squash, rebase, amend ve force push kesinlikle yok.** Commit'ten önce `ruff` ve `pytest` çalıştırılır. Kullanılabilecek commit başlıkları listesi : (feat fix docs style refactor perf test build ci chore)
- **Büyük adımlarda önce plan:** Veri modeli, audit log ve seed gibi adımlarda önce plan sunulur, onaydan sonra kod yazılır.
- **Açıklanabilir kod:** Kullanıcı her satırı görüşmede açıklayacak. Gereksiz soyutlama, sihirli kütüphane ya da gereğinden karmaşık pattern kullanılmaz. Açık olmayan kararlar kısa bir yorumla açıklanır. Gereken/ iterasyonlu yerlerde class / function tiplerini kullan.
- **Belirsizlikte:** Kullanıcıya sor. Olabilecek "makul varsayımları" listele ve kullanıcıya söyle. Final karar alındıktan sonra "Karar verilecek iş kuralları" bölümüne ve README'ye işle.
- **Secret'lar:** Hiçbir secret koda veya repoya yazılmaz.
- **Adım günlüğü:** Her adımdan sonra `ADIMLAR.md`'ye çok kısa bir kayıt eklenir: ne yapıldı, hangi dosyalar, neden, commit hash'i. Kullanıcı bu dosyayı sunumda kullanacak.
- **Plan dosyası:** Büyük adımların planı `docs/` altına bir dosya olarak yazılır. Kullanıcı okuyup onaylamadan kod yazılmaz. 
- **Commit zamanlaması (commit as you go):** Bir özellik kodlanıp test edildiği anda hemen commit'lenir; tüm kod yazılıp sonradan parçalara bölünmez. Her commit küçük, tek mantıksal birim olur ve kendi başına build alır.
- **Commit mesajı biçimi:** önek `docs:` (`doc:` değil), kısa bir Türkçe gövde. `Co-Authored-By:` ya da başka attribution satırı eklenmez; `...skipping...` gibi kesinti artıkları yazılmaz. `git commit -q -F - <<'EOF'` ile yazılır; sadece ilgili dosyalar `git add` edilir.
- **Commit öncesi kontroller:**
  - Backend: `cd backend && uv run ruff check . && uv run ruff format --check . && uv run pytest -q`
  - Frontend: `cd frontend && npm run lint && npm run build && npx tsc --noEmit`. Sıra önemli: `LayoutProps` gibi tipleri build `.next/types`'a üretir; temiz klasörde build'den önce `tsc` hata verir.
- **Frontend geliştirme:** önce `docker compose stop frontend`, sonra `cd frontend && npm run dev` (:3000). Bitince `docker compose up --build -d frontend`. DB'yi temiz seed'e döndürmek: `docker compose down -v && docker compose up -d`.
- **Tarayıcı testi:** Chrome eklentisi bağlı değilse Windows'taki Edge headless + `--remote-debugging-port=9333` + geçici `--user-data-dir` ile CDP üzerinden test edilir (WSL "mirrored" ağ modunda localhost ortak). Kapatırken sadece o örnek kapatılır; `taskkill /IM msedge.exe` kullanıcının Edge'ini de kapatır.
- **Paketler:** Doğrulanmamış paket kurulmaz (`httpx2` reddedildi, `httpx`'te kalındı). WSL2'de sudo şifre istiyor; kurulumlar kullanıcı dizinine yapılır.
- **Dil:** Kullanıcı hangi dilde yazarsa o dilde cevap verilir (çoğunlukla Türkçe). Dosyalar ve commit'ler Türkçe. Kod okuma sırası ve görüşme soruları `docs/elle-deneme.md`'de (kişisel, repoda yok).


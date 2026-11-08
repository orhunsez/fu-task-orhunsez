# Saha Bakım Görev Takip

Rüzgâr santralindeki 8 kişilik saha bakım ekibi için görev takip uygulaması. Görevler oluşturulup atanabiliyor, durumları takip ediliyor ve her durum ve atama değişikliği kayıt altına alınıyor.

FU Enerji full-stack case study'si. Görev tanımı: [FU-Enerji-Case-Study-Task-Tracker.pdf](FU-Enerji-Case-Study-Task-Tracker.pdf) ([fu-task.md](fu-task.md)).

## Canlı uygulama

| | Adres |
|---|---|
| **Uygulama** | https://fu-task-orhunsez.vercel.app |
| API | https://fu-task-orhunsez-api.vercel.app |
| API dokümanı (Swagger) | https://fu-task-orhunsez-api.vercel.app/docs |

> **İlk açılış yavaş olabilir.** Ücretsiz katmanda veritabanı (Neon) 5 dakika boşta kalınca uyuyor, backend fonksiyonu da soğuk başlıyor. Bir süre kimse kullanmadıysa ilk liste 3 saniye kadar sürer, sonrakiler yarım saniyenin altındadır. Ayrıntı: [Deploy](#deploy).

Giriş yok (kapsam dışı). Değişiklik yapmadan önce sağ üstten **İşlem yapan kişi** seçilir; geçmişteki "kim" bilgisi buradan gelir.

## Local çalıştırma

Gereken tek araç Docker (Compose ile). Secret gerekmez.

```bash
git clone https://github.com/orhunsez/fu-task-orhunsez.git && cd fu-task-orhunsez
cp .env.example .env
docker compose up --build
```

- Uygulama: http://localhost:3000
- API: http://localhost:8000 (Swagger: http://localhost:8000/docs)

Backend container'ı açılırken sırayla migration, seed ve API çalışır; uygulama veriyle dolu açılır. Seed, veritabanı doluysa hiçbir şey yapmaz.

```bash
docker compose down      # durdur
docker compose down -v   # veritabanını da sil (sonraki açılışta seed yeniden çalışır)
```

Makinede 5432 portunu kullanan başka bir Postgres varsa `docker compose up` "port is already allocated" hatası verir. Çözümü `backend/app/config.py`'deki notta.

### Testler

[uv](https://docs.astral.sh/uv/) gerekir:

```bash
cd backend
uv sync
uv run pytest            # 55 test, bellek içi SQLite ile (Docker gerekmez)
uv run ruff check .
```

## Proje yapısı

```
backend/                 FastAPI uygulaması
  app/main.py            uygulama, CORS, router'lar
  app/models.py          tablolar: users, tasks, task_history
  app/rules.py           iş kuralları: durum geçiş tablosu, gecikme, "bugün" (İstanbul)
  app/routers/tasks.py   görev endpoint'leri, kontroller, audit log yazımı
  app/errors.py          tek tip hata gövdesi {"detail", "field"}
  alembic/               migration
  scripts/seed.py        CSV'leri temizleyip yükleyen seed script
  tests/                 pytest
frontend/                Next.js (App Router) uygulaması
  src/app/               sayfalar: liste, yeni görev, görev detayı
  src/components/        tablo, filtreler, form, geçmiş, yükleniyor/boş/hata görünümleri
  src/lib/               API istemcisi, TanStack Query hook'ları, tipler
dataset/                 users.csv, tasks.csv, task_history.csv
docs/                    veri modeli + seed planı, frontend planı
docker-compose.yml       local ortam: Postgres + backend + frontend
.env.example             örnek ortam değişkenleri (secret yok)
```

## Teknoloji

| Katman | Seçim |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, psycopg 3 |
| Veritabanı | PostgreSQL (local'de Docker, prod'da Neon) |
| Frontend | Next.js 16 (App Router, TypeScript), TanStack Query, react-hook-form + zod, Tailwind + shadcn/ui |
| Deploy | Vercel (iki proje) + Neon |
| Test / araçlar | pytest, ruff, uv |

Frontend sade tutuldu: sayfalar client component, veri TanStack Query ile doğrudan FastAPI'den geliyor. Next.js'in sunucu tarafında veri işi yok; tek backend FastAPI.

## Kararlar ve varsayımlar

### İş kuralları

| Konu | Karar | Neden |
|---|---|---|
| Durumlar | **Yapılacak / Devam ediyor / Beklemede / Bitti** | "Beklemede" dokümanda yok ama veride gerçekten kullanılıyor (parça ya da randevu bekleyen işler). Silmek bilgi kaybı olurdu. |
| Durum geçişleri | Yapılacak → Devam ediyor<br>Devam ediyor → Beklemede, Bitti, Yapılacak<br>Beklemede → Devam ediyor<br>Bitti → Devam ediyor | Gerçek iş akışı. Tabloda olmayan geçiş **409** döner, mesajda izin verilen durumlar yazar. Aynı duruma "geçiş" değişiklik sayılmaz. |
| Bitmiş görev yeniden açılabilir mi? | **Evet**, Bitti → Devam ediyor. | Bakımdan sonra arıza tekrar edebilir. Yeniden açma da geçmişe yazılır. |
| Gecikme | `son tarih < bugün` **ve** durum Bitti değil. "Bugün" İstanbul saatine göre. | Sunucu UTC'de çalışsa bile ekip Türkiye'de. Son tarihi olmayan görev gecikmiş sayılmaz. |
| Silme | **Soft delete** (`deleted_at`). Silinen görev listede görünmez, detayı 404 döner, geçmişi DB'de kalır. | Audit log'un amacı iz bırakmak. Kalıcı silme bu izi de silerdi. |
| Öncelik | Yüksek / Orta / Düşük, zorunlu. | Seed'de boş öncelik Orta yapıldı. |
| Atama | Görev atanmamış olabilir. Olmayan ya da **pasif** kişiye yeni atama 422 döner. | Pasif kişinin eski görevleri korunur; arayüzde "(pasif)" etiketiyle görünür. |
| Son tarih | Yeni görevde son tarih geçmişte olamaz (422). Düzenlemede sadece tarih değiştiriliyorsa kontrol edilir. | Eski, gecikmiş bir görevin başlığını düzeltmek mümkün olmalı. |
| Yeni görev | Her zaman **Yapılacak** ile başlar; oluştururken durum seçilmez. | Sonraki her değişiklik geçiş kurallarına tabi. |
| Kurallar | Sadece **değişen** değere uygulanır. | Pasif kişiye atanmış ya da tarihi geçmiş bir görev yine düzenlenebilir. |

### Audit log (değişiklik geçmişi)

- Ayrı bir tablo: `task_history` (görev, alan, eski değer, yeni değer, kim, ne zaman).
- **Durum ve atama** değişiklikleri yazılır (dokümandaki kapsam). Oluştururken yapılan ilk atama da yazılır (eski değer boş).
- Geçmiş kaydı, görev güncellemesiyle **aynı transaction'da** yazılır. Biri yazılıp diğerinin yazılamaması mümkün değil.
- **"Kim":** Giriş olmadığı için arayüzde seçilen kişi isteğe `actor_id` olarak eklenir. Sadece aktif kişiler seçilebilir, seçilmeden kaydedilemez. Seçim tarayıcıda (localStorage) hatırlanır. Bu bir varsayım: gerçek bir sistemde "kim" bilgisi oturumdan gelir.
- Okuma: `GET /tasks/{id}/history`. Detay sayfasında kişi adlarıyla, en yeniden eskiye; en altta "Görev oluşturuldu".

### Kurallar nerede?

Kuralların tek kaynağı backend. Geçiş tablosu ve gecikme tanımı `backend/app/rules.py`'de. Endpoint'ler bunları `app/routers/tasks.py`'de uygular. Frontend kuralları kopyalamaz:

- Durum menüsü, görev yanıtındaki `next_statuses` alanından gelir.
- "Gecikmiş" etiketi `is_overdue` alanından gelir.
- Düzenlemede PATCH'e sadece değişen alanlar gider.

### Hatalar

Beklenen her hata aynı gövdeyle döner: `{"detail": "Türkçe mesaj", "field": "hatalı alan ya da null"}`. Frontend `field`'a bakıp mesajı ilgili form alanının altında gösterir. Beklenmeyen sunucu hataları (500) bu formatta değil; bkz. [Bilerek yapılmayanlar](#bilerek-yapılmayanlar).

| Durum | Kod | Örnek |
|---|---|---|
| Şema / validasyon | 422 | boş başlık, geçersiz durum değeri |
| Olmayan ya da pasif kişiye atama | 422 | `"field": "assignee_id"` |
| Geçmiş son tarih (yeni görev) | 422 | `"field": "due_date"` |
| Görev yok ya da silinmiş | 404 | `GET /tasks/999` |
| İzin verilmeyen durum geçişi | 409 | Yapılacak → Bitti |

Olmayan kişi için 404 değil 422 dönüyor, çünkü URL'deki kaynak (görev) var; hatalı olan gövdedeki değer.

### Veri büyüyünce

- Liste sayfalanıyor (`limit`/`offset`, en çok 200; arayüzde sayfa başına 20) ve toplam sayı dönüyor.
- Filtrelenen alanlarda index var: `status`, `assignee_id`, `due_date`. Geçmiş için de `task_id`.
- Sıralamada eşit değerler id ile sabitleniyor, satırlar sayfalar arasında kaymıyor. Öncelik, alfabeye göre değil anlamına göre sıralanıyor.
- Serverless'ta uygulama bağlantı havuzu tutmuyor (`NullPool`); havuzu Neon'un pooler'ı tutuyor.

### API

```
GET    /users                 kişiler (pasifler dahil)
GET    /tasks                 liste: ?status= &assignee_id= &unassigned=true &overdue=true
                              &sort=due_date|-due_date|priority|-priority|created_at|-created_at
                              &limit= &offset=
POST   /tasks                 oluştur
GET    /tasks/{id}            tek görev (is_overdue ve next_statuses ile)
PATCH  /tasks/{id}            güncelle: sadece gönderilen alanlar
DELETE /tasks/{id}            soft delete
GET    /tasks/{id}/history    değişiklik geçmişi
GET    /health                ayakta mı (DB'ye dokunmaz)
```

## Veri setindeki sorunlar ve kararlar

Veri elle tutulduğu için kirli kabul edildi. CSV'ler kod yazılmadan önce incelendi. Seed script (`backend/scripts/seed.py`) aşağıdaki kararları uygular, her şeyi tek transaction'da yazar ve sonunda neyi neden değiştirdiğini raporlar. Ayrıntılı analiz: [docs/plan-model-seed.md](docs/plan-model-seed.md).

| # | Sorun | Örnek | Karar |
|---|---|---|---|
| 1 | Durumda boşluk ve büyük/küçük harf farkı | `Devam Ediyor ` (18), `bitti` (19) | **Düzelt.** Boşluk silinip eşleştirilir. |
| 2 | Dokümanda olmayan durum | `Beklemede` (7, 20) | **Koru.** Dördüncü durum olarak eklendi. |
| 3 | Farklı tarih formatı | `17.11.2026` (24), `07.11.2026` (29) | **Düzelt.** `GG.AA.YYYY` de okunur. |
| 4 | Boş son tarih | 13, 26, 37 | **Boş bırak.** Son tarih zorunlu değil, bu görevler gecikmez. |
| 5 | Boş öncelik | 13 | **Varsayılan ata:** Orta. |
| 6 | Boş başlık | 37 | **Açıklamadan türet:** ilk cümle, en çok 80 karakter. |
| 7 | Olmayan kişiye atama | 32 (kişi 12 yok) | **Atanmamış yap**, raporda işaretle. |
| 8 | Atanmamış görev | 42 | **Olduğu gibi.** Atanmamış görev geçerli. |
| 9 | Pasif kişiye atanmış görev | 15, 35 (Okan Kurt) | **Koru.** Eski atama kalır, yeni atama yapılamaz. |
| 10 | Mükerrer görev | 30 ve 31: aynı içerik, 2 dakika arayla | **Atla.** İlki tutulur. |
| 11 | Olmayan göreve geçmiş kaydı | geçmiş 34, 38 (görev 43 yok) | **Atla.** |
| 12 | Geçmiş ile güncel durum çelişiyor | görev 40: geçmişte Bitti, tabloda Devam ediyor | **Tabloyu esas al** (export anındaki güncel durum). Geçmiş olduğu gibi kalır, raporda işaretlenir. |
| 13 | Çok satırlı açıklama | 35 | **Olduğu gibi.** Python `csv` modülü doğru okur, satır sonu korunur. |

**Sonuç:** 9 kişi, 41 görev (42 − 1 mükerrer), 53 geçmiş kaydı (55 − 2). Yeni görev id'si 43'ten başlar. Seed rapor çıktısı: `docker compose logs backend`.

Seed, geçmiş kayıtlarını geçiş kuralına göre kontrol etmez ve geçmiş tarihli son tarihleri kabul eder: bunlar yaşanmış olaylar. Kurallar sadece API'den yapılan yeni işlemlerde geçerli.

Geciken görev sayısı güne bağlı: 08.11.2026'da 11, 09.11.2026'da 12.

## Deploy

| Parça | Nerede | Bölge |
|---|---|---|
| Frontend | Vercel projesi `fu-task-orhunsez` (`frontend/`) | CDN + `fra1` |
| Backend | Vercel projesi `fu-task-orhunsez-api` (`backend/`), Python fonksiyonu | `fra1` (Frankfurt) |
| Veritabanı | Neon Postgres, Vercel Marketplace entegrasyonu, ücretsiz plan | `aws-eu-central-1` (Frankfurt) |

Fonksiyon ile veritabanı aynı bölgede: bir API isteği DB'ye birkaç kez gidiyor, aradaki mesafe her seferinde süreye ekleniyor. İstanbul'a en yakın bölge Frankfurt.

**Nasıl deploy edildi:**

1. İki Vercel projesi Vercel CLI ile oluşturuldu. Her klasör ayrı deploy ediliyor: `backend/` ve `frontend/` içinde `vercel deploy --prod`. Her klasördeki `vercel.json` framework'ü (`fastapi` / `nextjs`) ve bölgeyi belirliyor. Vercel'in Python derleyicisi `app/main.py`'yi kendisi buluyor ve bağımlılıkları `uv.lock`'tan kuruyor.
2. Neon, Vercel panelinden eklenip backend projesine bağlandı. `DATABASE_URL` (pooled adres) ortam değişkenini entegrasyon ekliyor.
3. Diğer değişkenler Vercel'e girildi: backend'de `CORS_ORIGINS` (frontend adresi), frontend'de `NEXT_PUBLIC_API_URL` (backend adresi, build anında koda gömülür).
4. Migration ve seed uygulama açılışında **çalışmıyor**. Local'den prod veritabanına karşı bir kez elle çalıştırıldı, Neon'un doğrudan (unpooled) adresiyle:
   ```bash
   cd backend
   DATABASE_URL="<neon unpooled adresi>" uv run alembic upgrade head
   DATABASE_URL="<neon unpooled adresi>" uv run python -m scripts.seed
   ```

**Secret'lar:** Veritabanı adresi sadece Vercel'in ortam değişkenlerinde duruyor. Repoda `.env` yok; `.env.example` sadece local Docker için örnek değerler içeriyor. Backend, Neon'un `postgres://` adresini kodda psycopg 3 sürücüsüne çeviriyor (`app/config.py`).

**İlk açılış (cold start):** Neon'un ücretsiz planında veritabanı 5 dakika boşta kalınca uyuyor, Python fonksiyonu da bir süre istek gelmezse soğuk başlıyor. Uzun bir aradan sonraki ilk istek bu yüzden yavaş, sonrakiler hızlı. Ölçüm (08.11.2026, İstanbul'dan, `GET /tasks?limit=20`): 12 dakika boşluktan sonraki ilk istek **yaklaşık 3 saniye**, sonraki istekler **0,3–0,4 saniye**.

**Prod verisini sıfırlama:** Giriş olmadığı için linki bilen herkes görev ekleyip silebilir. Veri bozulursa unpooled adresle `alembic downgrade base`, `alembic upgrade head` ve `python -m scripts.seed` çalıştırılır.

## Bilerek yapılmayanlar

- **AI özet botu** (isteğe bağlı bölüm). Önce ana kısmın eksiksiz ve deploy edilmiş olması öne alındı.
- **Authentication, bildirimler, mobil, drag & drop:** kapsam dışı. Kanban yerine tablo seçildi; filtre ve sıralama tabloda daha doğal.
- **Silen kişinin kaydı:** Silme isteği `actor_id` almıyor, "kim sildi" bilinmiyor. Görev ve geçmişi DB'de kalıyor.
- **Eşzamanlı düzenleme koruması yok:** İki kişi aynı görevi aynı anda düzenlerse son kaydeden kazanır.
- **DB'ye ulaşılamazsa** API, anlamlı bir 503 ve tek tip hata gövdesi yerine düz bir 500 dönüyor (arayüzde "Tekrar dene" görünüyor).
- **Audit log sadece durum ve atamayı kapsıyor** (dokümandaki kapsam). Başlık, öncelik ve son tarih değişiklikleri yazılmıyor.
- **Filtreler URL'de değil,** sayfa state'inde: detaydan listeye dönünce sıfırlanıyor.
- **Frontend için otomatik test yok.** Her değişiklikte lint, tip kontrolü ve build çalıştı; arayüz headless tarayıcıda elle denendi. Backend testleri Postgres yerine bellek içi SQLite ile çalışıyor.
- **Deploy GitHub'a bağlı değil;** CLI ile yapılıyor.

## 2 gün daha olsa

1. **AI özet botu:** Sayılar ve görev listesi backend'de hazırlanır, model yalnızca bu veriyi Türkçe anlatır. Her görev kendi sayfasına bağlanır, aktivite yoksa bot bunu söyler, API key yoksa uygulamanın geri kalanı çalışır.
2. Eşzamanlı düzenleme için `version` kolonu (optimistic locking): eski sürüm üzerine kaydetmek 409 döner.
3. `deleted_by` ile silme işlemini de geçmişe yazmak; başlık, öncelik ve son tarih değişikliklerini de audit log'a eklemek.
4. Filtreleri URL'de tutmak (paylaşılabilir link, geri tuşu filtreyi korur); bitmiş görevleri varsayılan olarak listenin sonuna almak.
5. DB hataları için 503 ve anlaşılır mesaj.
6. Testler: frontend için Playwright, backend testlerini gerçek Postgres'e karşı da çalıştırmak, GitHub Actions ile her push'ta lint + test + build.
7. Basit bir giriş ya da en azından prod'da yazma işlemleri için koruma; deploy'u GitHub'a bağlamak.

## Yapay zekâ kullanımı

Bütün süreçte terminalde **Claude Code** (Anthropic) kullanıldı.

- **Benim yaptıklarım:** İş kurallarına ve teknoloji seçimine ben karar verdim (durumlar, geçişler, gecikme, silme, hata kodları). Her büyük adımdan önce Claude'dan bir plan dosyası istedim (`docs/`), okuyup onayladım ya da değiştirdim. Kodu satır satır okudum ve elle denedim.
- **Claude'a yaptırdıklarım:** CSV'lerdeki sorunların çıkarılması, plan taslakları, backend ve frontend kodu, testler, kod incelemesi, headless tarayıcı testleri, deploy komutları ve bu README'nin taslağı.
- **Modeller:** Kararlar ve incelemeler için Claude Sonnet, kod için Claude Opus.
- **Çalışma kuralları:** Claude'a verdiğim kurallar ve kararların tek kaynağı [CLAUDE.md](CLAUDE.md): küçük commit'ler, açıklanabilir kod, büyük adımda önce plan, secret'lar repoya girmez.

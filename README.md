# Saha Bakım Görev Takip

Rüzgâr santralindeki 8 kişilik saha bakım ekibi için görev takip uygulaması. Görevler oluşturulup atanabiliyor, durumları takip ediliyor ve her durum ve atama değişikliği kayıt altına alınıyor. Liste filtrelenip sıralanabiliyor, son tarihler takvimde görülebiliyor.

## Canlı uygulama

- **Uygulama:** https://fu-task-orhunsez.vercel.app
- **API:** https://fu-task-orhunsez-api.vercel.app (Swagger: https://fu-task-orhunsez-api.vercel.app/docs)

> **İlk açılış yavaş olabilir.** Ücretsiz katmanda veritabanı ve backend bir süre kullanılmayınca uyuyor. Uzun bir aradan sonraki ilk istek 3 saniye kadar sürer, sonrakiler yarım saniyenin altındadır.

Giriş yok (kapsam dışı). Değişiklik yapmadan önce sağ üstten **İşlem yapan kişi** seçilir; değişiklik geçmişindeki "kim" bilgisi buradan gelir.

## Local çalıştırma

Gereken tek araç Docker (Compose ile). Secret gerekmez.

```bash
git clone https://github.com/orhunsez/fu-task-orhunsez.git && cd fu-task-orhunsez
cp .env.example .env
docker compose up --build
```

Uygulama http://localhost:3000, API http://localhost:8000/docs adresinde açılır. Migration ve seed açılışta otomatik çalışır; uygulama veriyle dolu gelir. Veritabanını sıfırlamak için `docker compose down -v`. 5432 portu doluysa çözüm `backend/app/config.py`'deki notta.

Testler ([uv](https://docs.astral.sh/uv/) gerekir): `cd backend && uv sync && uv run pytest` (64 test, Docker gerekmez).

## Kararlar ve varsayımlar

- **Durumlar:** Yapılacak / Devam ediyor / Beklemede / Bitti. "Beklemede" dokümanda yok ama veride kullanıldığı için korundu.
- **Durum geçişleri kısıtlı:** İzin verilmeyen geçiş 409 döner. Bitmiş görev yeniden açılabilir (Bitti → Devam ediyor).
- **Gecikme:** Son tarihi bugünden (İstanbul saatiyle) önce olan ve bitmemiş görev gecikmiştir. Son tarihi olmayan görev gecikmez.
- **Silme soft delete:** Görev listeden kalkar, değişiklik geçmişi korunur.
- **Atama:** Görev atanmamış olabilir. Pasif kişiye yeni atama yapılamaz, eski görevleri korunur.
- **Son tarih:** Yeni görevde geçmiş olamaz. Kurallar sadece değişen değere uygulanır; eski, gecikmiş bir görev yine düzenlenebilir.
- **Değişiklik geçmişi:** Durum ve atama değişiklikleri, görev güncellemesiyle aynı transaction'da yazılır. Giriş olmadığı için "kim" bilgisi arayüzde seçilen kişiden gelir (varsayım).
- **Kuralların tek kaynağı backend:** Frontend kuralları kopyalamaz.

Gerekçeler, filtre ve takvim davranışı, hata kodları ve API: [docs/kararlar.md](docs/kararlar.md#kararlar-ve-varsayımlar).

## Veri setindeki sorunlar

Veri kirli kabul edildi. Seed script her sorunu düzeltir, varsayılan değer atar ya da atlar ve sonunda bir rapor basar (`docker compose logs backend`).

- **Düzeltildi:** Durumdaki yazım farkları (`bitti`, `Devam Ediyor `) ve `GG.AA.YYYY` biçimindeki tarihler.
- **Varsayılan atandı:** Boş öncelik Orta oldu, boş başlık açıklamadan türetildi.
- **Atanmamış yapıldı:** Olmayan kişiye yapılmış atama.
- **Atlandı:** Mükerrer görev ve olmayan göreve ait geçmiş kayıtları.
- **Korundu:** "Beklemede" durumu ve pasif kişiye atanmış görevler.

Sonuç: 9 kişi, 41 görev, 53 geçmiş kaydı. 13 sorunun tam tablosu: [docs/kararlar.md](docs/kararlar.md#veri-setindeki-sorunlar-ve-kararlar).

## Deploy

Frontend ve backend Vercel'de iki ayrı proje; her klasörden Vercel CLI ile `vercel deploy --prod`. Veritabanı Neon Postgres, Frankfurt'ta. Migration ve seed prod veritabanına bir kez elle çalıştırıldı. Ayrıntı: [docs/kararlar.md](docs/kararlar.md#deploy).

## Bilerek yapılmayanlar

- AI özet botu (isteğe bağlı bölüm).
- Authentication, bildirimler, mobil ve drag & drop (kapsam dışı). Takvim yalnızca görüntüleme amaçlı.
- Silen kişi kaydedilmiyor ve eşzamanlı düzenleme koruması yok. DB'ye ulaşılamazsa 503 yerine 500 dönüyor.
- Filtreler URL'de tutulmuyor. Frontend için otomatik test yok.

Gerekçeleriyle tam liste: [docs/kararlar.md](docs/kararlar.md#bilerek-yapılmayanlar).

## 2 gün daha olsa

1. AI özet botu.
2. Eşzamanlı düzenleme için optimistic locking.
3. Silme işlemini ve başlık, öncelik, son tarih değişikliklerini de değişiklik geçmişine yazmak.
4. Filtreleri URL'de tutmak.
5. DB hataları için 503.
6. Frontend için Playwright, backend testlerini Postgres'e karşı da çalıştırmak ve CI.
7. Giriş ya da prod'da yazma koruması.

Ayrıntı: [docs/kararlar.md](docs/kararlar.md#2-gün-daha-olsa).

## Yapay zekâ kullanımı

Bütün süreçte terminalde **Claude Code** (Anthropic) kullanıldı.

- **Benim yaptıklarım:** İş kurallarına ve teknoloji seçimine ben karar verdim (durumlar, geçişler, gecikme, silme, hata kodları). Her büyük adımdan önce Claude'dan bir plan dosyası istedim (`docs/`), okuyup onayladım ya da değiştirdim. Kodu satır satır okudum ve elle denedim.
- **Claude'a yaptırdıklarım:** CSV'lerdeki sorunların çıkarılması, plan taslakları/iskeletleri, backend ve frontend kod yazımı, testler, headless tarayıcı testleri, deploy komutları ve bu README'nin taslağı.
- **Modeller:** Kararlar ve incelemeler için Claude Sonnet, kod için Claude Opus.
- **Çalışma kuralları:** Claude'a verdiğim kurallar ve kararların tek kaynağı [CLAUDE.md](CLAUDE.md): küçük commit'ler, açıklanabilir kod, büyük adımda önce plan, secret'lar repoya girmez.

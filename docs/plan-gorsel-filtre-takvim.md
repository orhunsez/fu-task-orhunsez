# Plan: Görsel cila, çoklu filtre ve takvim menüsü

> Durum: **onaylandı** (08.11.2026).

Mevcut frontend yeniden yazılmıyor. Görsel ilham Donezo (yeşil, yumuşak, köşesiz). Birebir kopya yok.

**Sıra ve branch'ler:**
1. **`main`:** Önce görünümden bağımsız özellikler gelir: çoklu seçimli filtreler (backend + frontend) ve son tarih aralığı filtresi (backend). Böylece görsel güncelleme beğenilmese de bu özellikler kaybolmaz.
2. **`soft-ui`:** Bunlardan sonra `main`'den `soft-ui` branch'i açılır. Görsel cila ve takvim menüsünün arayüzü orada yazılır. Branch'in `main`'e alınmasına kullanıcı karar verir. Alınacaksa normal ya da fast-forward merge yapılır, squash/rebase yapılmaz.

Filtre menüsü `main`'de mevcut temayla çalışır. `soft-ui`'de tema token'ları ve shadcn bileşenleri üzerinden yumuşak görünümü kendiliğinden alır. `main`'de tarih aralığı sadece API'den (Swagger) kullanılabilir.

## Aşama 1a: Görsel cila

**Görünüm tek yerden yönetilir (`globals.css`):**

| Token | Değer | Etkisi |
|---|---|---|
| `--background` | kırık beyaz / açık gri | sayfa zemini |
| `--card`, `--popover` | beyaz | kartlar, tablo kapsayıcısı, açılır paneller |
| `--primary` | koyu-orta yeşil (beyaz yazıyla kontrast ≥ 4.5:1) | birincil buton, seçili gün |
| `--secondary`, `--accent` | açık yeşil zemin + koyu yeşil yazı | seçili filtre, menüde üzerine gelinen satır |
| `--destructive` | daha koyu kırmızı (red-700) | gecikmiş tarih ve etiketi; yeşil temada da belirgin ve açık kırmızı zeminde AA kontrast |
| `--radius` | `0.625rem` → `1.125rem` | kartlar ~25px (≈ `rounded-3xl`), popover ve menü 18px |
| `--shadow-soft` (yeni) | iki katmanlı hafif gölge | kartlar ve paneller çerçeve yerine gölgeyle ayrılır |

**shadcn bileşenlerinde (`components/ui/`) birer kez:** Button, Input, NativeSelect ve Badge `rounded-full` olur (boyuta göre değişen köşe kuralları kaldırılır). Card ve paneller çizgi yerine `shadow-soft` kullanır. Tablo başlığı soluk ve ince yazılır, satır çizgileri yumuşar, hücreler daha ferah olur. Sayfa bileşenlerinde `rounded-*` yazılmaz. İstisnalar şunlar: avatar kendi küçük bileşeninde daire olarak çizilir, takvim günleri de Button'ın hap/daire şeklini kullanır.

**Sayfalar:**
- **Üst bar:** Küçük yeşil logo ve başlık yer alır. "İşlem yapan kişi" seçicisi korunur, yanında seçilen kişinin baş harfli avatarı görünür.
- **Liste:** "Görevler" başlığının altında kısa bir açıklama olur. Sağda "Takvim" (2. aşama) ve "+ Yeni görev" butonları bulunur.
  - Tablo beyaz, yuvarlak bir kartın içinde durur.
  - Atanan kişi baş harfli yuvarlak avatar ve isimle gösterilir. Pasif kişi "(pasif)" etiketiyle görünür.
  - Durum rozetleri küçük, yumuşak zeminli haplardır.
  - Gecikmiş görevin tarihi ve "Gecikmiş" etiketi kırmızı kalır.
- **Yükleniyor / boş / hata:** Aynı kart yüzeyinde ikon, mesaj ve hap buton gösterilir ("Tekrar dene", "Filtreleri temizle", "Görev bulunamadı").
- **Detay ve yeni görev:** Yeni görünüm bileşenlerden kendiliğinden gelir. Sadece başlık satırı ve geri linki toparlanır.
- **Alınmayanlar:** Özet kartları, grafik, sidebar, gradyan, mobil uygulama kutusu ve zamanlayıcı alınmaz. Koyu tema yok.

## Aşama 1b: Çoklu seçimli filtreler

**Backend (`GET /tasks`):**
- `status` ve `assignee_id` tekrarlı parametre alır: `?status=Yapılacak&status=Beklemede`. Eski tek değerli çağrılar aynı sonucu verir.
- **Kural:** Aynı filtredeki değerler VEYA ile, farklı filtreler VE ile birleşir.
  - Kişi filtresinde seçilen kişiler ve "Atanmamış" (`unassigned=true`) VEYA ile birleşir. Örneğin `assignee_id=1&unassigned=true` 1 numaralı kişinin görevlerini ve atanmamış görevleri döndürür.
  - Bu birleşim eskiden her zaman boş liste dönüyordu. Arayüz bu çağrıyı hiç yapmıyordu.
- Listede geçersiz bir değer varsa 422 döner ve `field` yine `"status"` olur, `"status.1"` değil. Bunun için `errors.py`'de liste sırası alan adından çıkarılır.
- Filtre koşulları küçük bir yardımcı fonksiyonda toplanır, böylece endpoint okunur kalır (ruff karmaşıklık sınırı 8).
- **pytest:**
  - iki durum VEYA ile birleşir
  - iki kişi VEYA ile birleşir
  - kişi + atanmamış birleşir
  - farklı filtreler hâlâ VE ile birleşir
  - listede geçersiz değer 422 ve `field=status` döner
  - mevcut tek değer testleri değişmeden geçer

**Frontend:**
- shadcn `dropdown-menu` eklenir. base-ui Menu üstüne kurulu olduğu için yeni paket gerekmez (dry-run ile kontrol edildi).
- Yeni bir `MultiSelectFilter` bileşeni yazılır ve iki kez kullanılır (Durum, Kişi).
  - Seçenekler onay kutulu menü satırlarıdır. Tıklayınca menü kapanmaz, böylece birden fazla değer seçilebilir.
  - Tetikleyicide seçili sayısı görünür: **"Durum (2)"**. Seçim varsa tetikleyici yeşil olur.
- **Kişi menüsü:** Önce "Atanmamış", sonra herkes listelenir. Pasifler "(pasif)" etiketiyle görünür.
- **Geciken:** Tek bir aç/kapa butonudur (`aria-pressed`). Açıkken yeşil olur.
- **Filtreleri temizle:**
  - Bir filtre seçiliyse çubukta görünür. Durum, kişi ve geciken filtrelerini sıfırlar.
  - Sıralama filtre sayılmadığı için korunur.
  - Boş listedeki düğme de aynı işi yapar.
- **Sıralama:** native select olarak kalır (hap şeklinde).
- Filtreler sayfa state'inde kalır, URL'ye taşınmaz. Filtreleme kuralları sadece backend'dedir; frontend sadece parametre gönderir.

## Aşama 2: Takvim menüsü

**Backend:**
- `GET /tasks?due_from=YYYY-MM-DD&due_to=YYYY-MM-DD` eklenir, iki uç da dahildir. Mevcut `due_date` index'i kullanılır.
- Son tarihi olmayan ve silinmiş görevler dönmez.
- `due_from > due_to` ise 422 döner (`field=due_to`).
- **pytest:**
  - sınır günleri dahil
  - soft delete'li görev hariç
  - son tarihsiz görev hariç
  - ters aralık 422 döner

**Frontend:**
- Liste başlığındaki **"Takvim"** butonu bir popover açar (shadcn `popover`, base-ui; yeni paket yok). Takvim yalnızca görüntüleme içindir: görev oluşturma ve sürükleme yok.
- **Ay görünümü:**
  - ‹ › okları ve **Bugün** butonu bulunur.
  - Hafta Pazartesi başlar.
  - Ay ve gün adları Türkçedir ve sabit dizide tutulur.
  - Ay dışındaki hücreler boş bırakılır.
- **Izgara:** Yeni paket kullanılmaz, düz `Date` ile elle çizilir. Ayın günleri `Date.UTC` ve `getUTCDay` ile hesaplanır; böylece tarayıcının saat dilimi günü kaydıramaz. Günler `"YYYY-MM-DD"` metniyle görevin `due_date`'ine eşlenir. "Bugün" mevcut `todayInIstanbul()` fonksiyonundan gelir.
- **Veri:**
  - Takvim görünen ayın ilk ve son gününü `GET /tasks?due_from&due_to&limit=200` ile çeker.
  - Query key `["tasks", "calendar", from, to]` olur. Bir görev değişince mevcut `invalidateQueries(["tasks"])` takvimi de yeniler.
  - Ayda 200'den fazla görev olursa uyarı gösterilir.
- **Gün hücresi:**
  - Görev varsa en çok 3 nokta görünür.
  - Gecikmiş görevi olan günün rakamı ve noktaları kırmızıdır. Bu bilgi `is_overdue`'dan gelir, frontend hesaplamaz.
  - Bugünün rakamı yeşil yazılır.
  - Seçili gün dolu yeşil dairedir.
- **Güne tıklayınca:**
  - Altta o günün görevleri başlık ve durum rozetiyle listelenir. Bitti görevleri soluk görünür.
  - Bir göreve tıklanınca detay sayfası açılır.
  - Boş günde "Bu güne son tarihli görev yok." yazar.
  - Yükleniyor ve hata (Tekrar dene) durumları da gösterilir.
- **Liste filtreleri:** Takvim bunlardan bağımsızdır ve tüm görevleri gösterir.
- **Süre yetmezse:** Takvim sade tutulur (sayaç ya da nokta, gün listesi). Yetişmeyen kısım README'de "yapılmadı" olarak yazılır.

## Commit sırası

Her commit kendi başına lint, build ve testten geçer. Özellik test edilir edilmez commit'lenir.

| # | Branch | Commit | Kontrol |
|---|---|---|---|
| 1 | main | `docs: görsel cila, çoklu filtre ve takvim planı eklendi` | onayın |
| 2 | main | `feat: durum ve kişi filtreleri birden fazla değer alıyor` (backend) | pytest |
| 3 | main | `feat: durum ve kişi filtreleri çoklu seçimli menüye dönüştürüldü` | tarayıcı: "Durum (2)", atanmamış + pasif, temizle |
| 4 | main | `feat: görev listesine son tarih aralığı filtresi eklendi` (backend) | pytest |
| 5 | main | `docs: README ve CLAUDE.md çoklu filtre ve tarih aralığıyla güncellendi` | |
| 6 | soft-ui | `style: yeşil tema, yumuşak gölge ve hap şeklinde kontroller eklendi` | ekran görüntüsü: liste, detay, form |
| 7 | soft-ui | `style: liste sayfası, üst bar ve durum ekranları yenilendi` | ekran görüntüsü + boş/hata ekranları |
| 8 | soft-ui | `feat: liste sayfasına takvim menüsü eklendi` | tarayıcı: ay değiştirme, Bugün, güne tıklama, boş/hata |
| 9 | soft-ui | `docs: README ve CLAUDE.md görsel güncelleme ve takvimle güncellendi` | |

`ADIMLAR.md`'ye her adımdan sonra commit hash'iyle kısa bir kayıt eklenir.

## Doğrulama

- **Backend:** `ruff check`, `ruff format --check` ve `pytest`.
- **Frontend:** `lint`, `build` ve ardından `tsc`.
- **Tarayıcı:** Docker'daki backend'e karşı production build (`next start`) headless Edge ile (CDP) test edilir.
  - Ekran görüntüleri alıp kendim bakarım. Emin olamadığım görsel bir şey olursa sana gösterip onay isterim.
  - En sonda tüm sistem Docker'daki production build'e karşı baştan denenir: çoklu filtre, takvimde ay değiştirme, güne tıklama, boş ve hata durumları.

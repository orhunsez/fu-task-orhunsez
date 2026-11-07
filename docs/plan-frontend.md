# Plan: Frontend

> Durum: **onaylandı** (07.11.2026).

Üç sayfa var: liste, yeni görev ve görev detayı (düzenleme, geçmiş ve silme aynı sayfada). Tasarım sade tutulacak ve shadcn bileşenleri kullanılacak.

## 1. Ekranlar

### 1.1 Görev listesi: `/`

```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ Saha Bakım Görev Takip                                  İşlem yapan kişi: [ Seçin…      ▾] │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│ Durum [Tümü ▾]  Kişi [Tümü ▾]  [✓] Sadece gecikenler  Sırala [Son tarih ↑ ▾]               │
│                                                                             [+ Yeni görev] │
├─────┬─────────────────────────────────┬──────────────┬─────────┬──────────────┬────────────┤
│ #   │ Başlık                          │ Durum        │ Öncelik │ Atanan       │ Son tarih  │
├─────┼─────────────────────────────────┼──────────────┼─────────┼──────────────┼────────────┤
│ 33  │ Kasım bakım takvimini hazırla   │ Devam ediyor │ Orta    │ Selin Aydın  │ 17.10.2026 │
│     │                                 │              │         │              │ Gecikmiş   │
│ 20  │ RT-10 konverter fan arızası     │ Beklemede    │ Yüksek  │ Deniz Arslan │ 29.10.2026 │
│     │                                 │              │         │              │ Gecikmiş   │
│ 32  │ RT-09 jeneratör rulman değişimi │ Yapılacak    │ Yüksek  │ —            │ 10.11.2026 │
├─────┴─────────────────────────────────┴──────────────┴─────────┴──────────────┴────────────┤
│ 1–20 / 41                                                           [‹ Önceki] [Sonraki ›] │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

- Satıra tıklayınca görevin detay sayfası açılır.
- Durum renkli bir etiketle gösterilir. Gecikmiş görevin son tarihi kırmızı yazılır ve yanında "Gecikmiş" etiketi olur.
- Kişi filtresinde herkes var (pasif Okan dahil, çünkü eski görevleri var). Ayrıca bir "Atanmamış" seçeneği bulunur.
- Filtre değişince 1. sayfaya dönülür.
- **Loading:** tablo yerine gri iskelet satırlar gösterilir.
- **Empty:** "Filtrelere uyan görev yok." mesajı ve **Filtreleri temizle** düğmesi.
- **Error:** hata mesajı ve **Tekrar dene** düğmesi. Backend kapalıysa da bu görünür.

### 1.2 Yeni görev: `/tasks/new`

```
← Görevler
Yeni görev
┌──────────────────────────────────────────────┐
│ Başlık *      [                            ] │
│               Bu alan boş olamaz.            │  ← hata mesajı alanın altında
│ Açıklama      [                            ] │
│               [                            ] │
│ Öncelik *     [ Orta          ▾]             │
│ Atanan kişi   [ Atanmamış     ▾]             │  ← sadece aktif kişiler
│ Son tarih     [ gg.aa.yyyy  ]                │  ← bugünden önce seçilemez
│                              [İptal] [Kaydet]│
└──────────────────────────────────────────────┘
```

- Durum alanı yok, çünkü yeni görev her zaman "Yapılacak" ile başlar (backend kuralı).
- Validasyon iki katmanlı:
  1. **zod** ile anında kontrol: boş başlık, 200 karakter sınırı, geçmiş tarih.
  2. **Backend'den dönen hata:** `{"detail", "field"}` ilgili alanın altına yazılır. Örneğin pasif kişi seçilirse "Atanan kişi" alanının altında görünür. Alanla ilgisi olmayan hatalar formun üstünde gösterilir.
- Kaydedince yeni görevin detay sayfasına gidilir.

### 1.3 Görev detayı: `/tasks/[id]`

```
← Görevler
#4  RT-11 yaw motoru arıza tespiti                                          [Sil]
┌ Düzenle ─────────────────────────────────┐  ┌ Değişiklik geçmişi ─────────────────────┐
│ Başlık     [RT-11 yaw motoru arıza t…]   │  │ 02.11.2026 11:55 · Burak Çelik          │
│ Açıklama   [Yaw hatası 3 kez tekrar…]    │  │   Durum: Yapılacak → Devam ediyor       │
│ Durum      [ Devam ediyor ▾]             │  │                                         │
│ Öncelik    [ Yüksek       ▾]             │  │ 27.10.2026 07:45 · Murat Yıldız         │
│ Atanan     [ Burak Çelik  ▾]             │  │   Görev oluşturuldu                     │
│ Son tarih  [ 31.10.2026 ]                │  │                                         │
│                               [Kaydet]   │  │                                         │
└──────────────────────────────────────────┘  └─────────────────────────────────────────┘
```

- **Durum menüsü** sadece mevcut durumu ve izin verilen geçişleri gösterir. Örneğin "Devam ediyor" için: Devam ediyor, Beklemede, Bitti, Yapılacak. Böylece kullanıcı yasak bir geçişi seçemez. Backend 409 dönerse yine alanın altında gösterilir.
- **Geçmiş:**
  - Kişi id'leri isimle gösterilir (örn. "Atanan: Elif Şahin → Murat Yıldız"), boş değer "—" olur.
  - En alttaki "Görev oluşturuldu" satırı `created_at` ve `created_by` alanlarından üretilir. Bu satır geçmiş tablosunda yoktur, sadece gösterimdir.
- Kaydedince form ve geçmiş hemen yenilenir.
- **Sil:** önce onay sorulur ("Görev silinsin mi?"), ardından listeye dönülür.
- Görev bulunamazsa (404, örneğin silinmiş görev) "Görev bulunamadı" mesajı ve listeye dönüş linki gösterilir.

## 2. İşlem yapan kişi

Auth olmadığı için değişikliği kimin yaptığı arayüzde seçilir.

- Sağ üstte "İşlem yapan kişi" seçicisi var. Sadece aktif kişiler listelenir. Seçim tarayıcıda (localStorage) hatırlanır, sayfa yenilense de kalır.
- Seçilmeden oluşturma veya düzenleme yapılamaz. **Kaydet** düğmesi pasif olur ve altında "Kaydetmek için sağ üstten işlem yapan kişiyi seçin." uyarısı görünür.
- Seçilen kişi, isteklerde `actor_id` olarak gönderilir. Audit log'daki "kim" bilgisi buradan gelir.

## 3. Backend'e küçük bir ek

`TaskOut` yanıtına `next_statuses` alanı eklenir. Bu alan o görev için geçilebilecek durumları içerir ve değerini `rules.ALLOWED_TRANSITIONS`'tan alır.
Böylece geçiş kuralı tek bir yerde (backend'de) kalır ve frontend bu kuralı kopyalamaz.

## 4. Veri akışı

Sunucudan gelen veri **TanStack Query** ile, filtreler `useState` ile, formlar **react-hook-form + zod** ile, işlem yapan kişi ise **localStorage** ile tutulur.

| Veri | Query key | Endpoint | Ne zaman yenilenir |
|---|---|---|---|
| Kişiler | `["users"]` | `GET /users` | Bir kez yüklenir (liste değişmiyor) |
| Liste | `["tasks", filtreler, sayfa]` | `GET /tasks?...` | Filtre/sayfa değişince; bir görev değişince |
| Görev | `["task", id]` | `GET /tasks/{id}` | Kaydetmeden sonra |
| Geçmiş | `["history", id]` | `GET /tasks/{id}/history` | Kaydetmeden sonra |

Oluşturma, güncelleme ve silme işlemi bitince ilgili veriler `invalidateQueries` ile yeniden çekilir.

## 5. Kararlar (önerim; onayınla kesinleşir)

1. **Oluşturma ve düzenleme ayrı sayfalarda** (modal yok). Daha basit, her sayfanın adresi var ve geri tuşu çalışıyor.
2. **Filtreler sayfa state'inde tutulur, URL'de değil.** Sayfa yenilenince sıfırlanır. Filtreleri URL'e taşımak "2 gün daha olsa" listesine girer.
3. **Sayfa başına 20 görev.**
4. **Bileşenler:** shadcn'den Table, Badge, Button, Input, Textarea, Label ve Card. Seçim kutuları için shadcn **native-select** (tarayıcının kendi `<select>`'i, react-hook-form ile doğrudan çalışır).
5. **Tarih ve saatler** `07.11.2026 14:05` biçiminde, İstanbul saatiyle gösterilir.
6. **Frontend için otomatik test yok** (kapsam gereği). Her commit öncesi lint, tip kontrolü (`tsc`) ve `next build` çalışır; ardından tarayıcıda elle kontrol edilir.

## 6. Dosyalar

```
src/app/page.tsx                   liste sayfası
src/app/tasks/new/page.tsx         yeni görev sayfası
src/app/tasks/[id]/page.tsx        detay: düzenleme + geçmiş + silme
src/components/site-header.tsx     başlık + işlem yapan kişi seçici
src/components/task-filters.tsx    filtre çubuğu
src/components/task-table.tsx      görev tablosu
src/components/task-form.tsx       ortak form (yeni + düzenle)
src/components/task-history.tsx    değişiklik geçmişi listesi
src/components/query-states.tsx    yükleniyor / boş / hata görünümleri
src/lib/api.ts                     fetch + ApiError (zaten var)
src/lib/types.ts                   Task, User, HistoryEntry tipleri (backend şemalarının aynısı)
src/lib/queries.ts                 useTasks, useTask, useUsers, useHistory + kaydet/sil işlemleri
src/lib/format.ts                  tarih ve kişi adı biçimlendirme
src/lib/actor.ts                   işlem yapan kişiyi localStorage'da tutan hook
```

## 7. Commit sırası

| # | Commit | Elle kontrol (sen) |
|---|---|---|
| 1 | `feat: görev yanıtına izin verilen sonraki durumlar eklendi` | `/docs`'ta `GET /tasks/4` yanıtında `next_statuses` |
| 2 | `feat: görev listesi sayfası eklendi` | 41 görev, gecikmişler kırmızı; backend durdurulunca hata ekranı |
| 3 | `feat: listeye filtre, sıralama ve sayfalama eklendi` | "Sadece gecikenler" → 9 görev |
| 4 | `feat: işlem yapan kişi seçici eklendi` | Seçim sayfa yenilenince kalıyor |
| 5 | `feat: görev oluşturma formu eklendi` | Boş başlık ve geçmiş tarih hataları görünüyor |
| 6 | `feat: görev detayı, düzenleme ve değişiklik geçmişi eklendi` | Durum değişince geçmişe satır ekleniyor |
| 7 | `feat: görev silme eklendi` | Silinen görev listeden kalkıyor |

Geliştirme sırasında frontend `npm run dev` ile çalışır; kod değiştikçe sayfa anında yenilenir. Bu süre boyunca docker'daki frontend durdurulur, adres yine http://localhost:3000 olur.
Her adımın sonunda neyi elle kontrol edeceğini ayrıca yazacağım.

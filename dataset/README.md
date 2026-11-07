# Task tracker dataset

Bu klasördeki veriler, saha bakım ekibinin bugüne kadar kullandığı tablodan alındı.
Export zamanı: **6 Kasım 2026, 18:00 (Türkiye saati)**.

Uygulaman ilk açıldığında bu veriyle dolu gelmeli. Tablo elle tutulduğu için verinin temiz olduğunu varsayma.
Karşılaştığın sorunları ve her birini nasıl ele aldığını kendi README dosyanda anlat.

Dosyaların hepsi virgülle ayrılmış, UTF-8 kodlu CSV dosyalarıdır. İlk satırda sütun adları var.

## users.csv: ekip (9 satır)

| Column | Açıklama |
| --- | --- |
| id | Kişinin kimliği |
| full_name | Ad ve soyad |
| role | Ekipteki rolü |
| email | E-posta adresi |
| is_active | `true` ya da `false` |

## tasks.csv: görevler (42 satır)

| Column | Açıklama |
| --- | --- |
| id | Görevin kimliği |
| title | Başlık |
| description | Açıklama, boş olabilir |
| status | Görevin şu anki durumu |
| priority | `Yüksek`, `Orta` ya da `Düşük` |
| assignee_id | Görevin atandığı kişi (`users.csv` içindeki `id`) |
| due_date | Son tarih, gün olarak (YYYY-MM-DD) |
| created_by | Görevi oluşturan kişi (`users.csv` içindeki `id`) |
| created_at | Oluşturulma zamanı, UTC (ISO 8601) |

## task_history.csv: değişiklik geçmişi (55 satır)

Bu dosyada yalnızca status ve assignee değişiklikleri var. Görevin ne zaman oluşturulduğu `tasks.csv` dosyasındaki `created_at` sütununda yazıyor.

| Column | Açıklama |
| --- | --- |
| id | Kaydın kimliği |
| task_id | Değişen görev (`tasks.csv` içindeki `id`) |
| changed_at | Değişikliğin zamanı, UTC (ISO 8601) |
| changed_by | Değişikliği yapan kişi (`users.csv` içindeki `id`) |
| field | Değişen alan: `status` ya da `assignee_id` |
| old_value | Önceki değer. `assignee_id` alanında kişi id'sidir; ilk atamada boştur |
| new_value | Yeni değer. `assignee_id` alanında kişi id'sidir |

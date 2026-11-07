# FU Enerji Full-stack Case Study: Task Tracker

Görev tanımı, çalışma kuralları ve teslim adımları [FU-Enerji-Case-Study-Task-Tracker.pdf](FU-Enerji-Case-Study-Task-Tracker.pdf) dosyasında.
Geliştirme adımlarının kısa günlüğü: [ADIMLAR.md](ADIMLAR.md).

```
FU-Enerji-Case-Study-Task-Tracker.pdf   Görev tanımı
backend/                                FastAPI uygulaması
frontend/                               Next.js uygulaması
dataset/
├── README.md                           Dosyaların ve sütunların açıklaması
├── users.csv                           Ekip
├── tasks.csv                           Görevler
└── task_history.csv                    Değişiklik geçmişi
docker-compose.yml                      Local ortam: Postgres + backend + frontend
.env.example                            Örnek ortam değişkenleri
```

## Local çalıştırma

Gereken tek araç Docker (Compose ile birlikte).

```bash
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000 (API dokümanı: http://localhost:8000/docs)

Durdurmak için:

```bash
docker compose down
```

Veritabanını da silip sıfırdan başlamak için (`-v`, Postgres volume'unu siler):

```bash
docker compose down -v
```

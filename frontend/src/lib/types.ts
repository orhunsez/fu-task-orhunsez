// Backend yanıtlarının TypeScript karşılıkları (alanlar backend/app/schemas.py ile aynı).

export const STATUSES = ["Yapılacak", "Devam ediyor", "Beklemede", "Bitti"] as const;
export type TaskStatus = (typeof STATUSES)[number];

export const PRIORITIES = ["Yüksek", "Orta", "Düşük"] as const;
export type TaskPriority = (typeof PRIORITIES)[number];

export type User = {
  id: number;
  full_name: string;
  role: string;
  email: string;
  is_active: boolean;
};

export type Task = {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: number | null;
  due_date: string | null; // "YYYY-MM-DD"
  created_by: number;
  created_at: string; // ISO 8601, UTC
  updated_at: string;
  is_overdue: boolean; // backend hesaplar
  next_statuses: TaskStatus[]; // bu görevin geçebileceği durumlar (backend'deki geçiş tablosundan)
};

/** Değişiklik geçmişi (audit log) satırı. Atama kayıtlarında değerler kişi id'sidir (metin). */
export type HistoryEntry = {
  id: number;
  task_id: number;
  changed_at: string; // ISO 8601, UTC
  changed_by: number;
  field: "status" | "assignee_id";
  old_value: string | null; // ilk atamada boş
  new_value: string | null;
};

/** POST /tasks ve PATCH /tasks/{id} gövdesi. PATCH'te sadece değişen alanlar gönderilir. */
export type TaskBody = {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: number | null;
  due_date?: string | null;
  actor_id: number; // auth olmadığı için işlemi yapan kişi
};

/** Liste sıralaması. "-" önekliler ters sıra (backend'deki SortOption ile aynı değerler). */
export type SortOption =
  | "due_date"
  | "-due_date"
  | "priority"
  | "-priority"
  | "created_at"
  | "-created_at";

/** Liste filtreleri ve sıralama. Çoklu seçimde boş dizi "tümü" demek. */
export type TaskFilters = {
  statuses: TaskStatus[];
  assignees: string[]; // kişi id'leri; "none" = atanmamış
  overdue: boolean;
  sort: SortOption;
};

/** GET /tasks yanıtı: bir sayfalık görev ve filtreye uyan toplam görev sayısı. */
export type TaskList = {
  items: Task[];
  total: number;
  limit: number;
  offset: number;
};

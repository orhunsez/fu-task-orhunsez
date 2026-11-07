import { formatDateTime, userName } from "@/lib/format";
import type { HistoryEntry, Task, User } from "@/lib/types";

const FIELD_LABELS: Record<HistoryEntry["field"], string> = {
  status: "Durum",
  assignee_id: "Atanan",
};

type TaskHistoryProps = {
  task: Task;
  entries: HistoryEntry[]; // en yenisi önce (backend böyle sıralar)
  users: User[] | undefined;
};

/**
 * Değişiklik geçmişi: kim, ne zaman, neyi değiştirdi. En alttaki "Görev oluşturuldu" satırı
 * geçmiş tablosunda yoktur; görevin created_at ve created_by alanlarından üretilir.
 */
export function TaskHistory({ task, entries, users }: TaskHistoryProps) {
  // Atama kayıtlarında değer kişi id'si, isme çevrilir. Boş değer "—" olur.
  function showValue(entry: HistoryEntry, value: string | null) {
    if (entry.field === "assignee_id") return userName(users, value ? Number(value) : null);
    return value ?? "—";
  }

  return (
    <ol className="space-y-4 text-sm">
      {entries.map((entry) => (
        <li key={entry.id}>
          <p className="text-muted-foreground">
            {formatDateTime(entry.changed_at)} · {userName(users, entry.changed_by)}
          </p>
          <p>
            {FIELD_LABELS[entry.field]}: {showValue(entry, entry.old_value)} →{" "}
            {showValue(entry, entry.new_value)}
          </p>
        </li>
      ))}
      <li>
        <p className="text-muted-foreground">
          {formatDateTime(task.created_at)} · {userName(users, task.created_by)}
        </p>
        <p>Görev oluşturuldu</p>
      </li>
    </ol>
  );
}

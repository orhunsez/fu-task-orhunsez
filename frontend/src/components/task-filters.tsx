import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { userLabel } from "@/lib/format";
import { STATUSES, type SortOption, type TaskFilters, type User } from "@/lib/types";

export const DEFAULT_FILTERS: TaskFilters = {
  status: "",
  assignee: "",
  overdue: false,
  sort: "due_date",
};

const SORT_LABELS: Record<SortOption, string> = {
  due_date: "Son tarih (en erken önce)",
  "-due_date": "Son tarih (en geç önce)",
  priority: "Öncelik (yüksek önce)",
  "-priority": "Öncelik (düşük önce)",
  created_at: "Oluşturma (en eski önce)",
  "-created_at": "Oluşturma (en yeni önce)",
};

type TaskFiltersBarProps = {
  filters: TaskFilters;
  users: User[];
  onChange: (filters: TaskFilters) => void;
};

/** Liste üstündeki filtre çubuğu. State'i tutmaz; değeri sayfadan alır, değişikliği sayfaya bildirir. */
export function TaskFiltersBar({ filters, users, onChange }: TaskFiltersBarProps) {
  // Tek bir alanı değiştirir, diğer filtreleri olduğu gibi bırakır.
  function update(changes: Partial<TaskFilters>) {
    onChange({ ...filters, ...changes });
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <label className="grid gap-1 text-sm">
        Durum
        <NativeSelect
          value={filters.status}
          onChange={(event) => update({ status: event.target.value as TaskFilters["status"] })}
        >
          <NativeSelectOption value="">Tümü</NativeSelectOption>
          {STATUSES.map((status) => (
            <NativeSelectOption key={status} value={status}>
              {status}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </label>

      <label className="grid gap-1 text-sm">
        Kişi
        <NativeSelect
          value={filters.assignee}
          onChange={(event) => update({ assignee: event.target.value })}
        >
          <NativeSelectOption value="">Tümü</NativeSelectOption>
          <NativeSelectOption value="none">Atanmamış</NativeSelectOption>
          {/* Pasif kişiler de listede, çünkü üzerlerinde eski görevler var. */}
          {users.map((user) => (
            <NativeSelectOption key={user.id} value={user.id}>
              {userLabel(user)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </label>

      <label className="flex h-8 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={filters.overdue}
          onChange={(event) => update({ overdue: event.target.checked })}
        />
        Sadece gecikenler
      </label>

      <label className="grid gap-1 text-sm">
        Sırala
        <NativeSelect
          value={filters.sort}
          onChange={(event) => update({ sort: event.target.value as SortOption })}
        >
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <NativeSelectOption key={value} value={value}>
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </label>
    </div>
  );
}

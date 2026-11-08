import { AlarmClockIcon, XIcon } from "lucide-react";

import { MultiSelectFilter } from "@/components/multi-select-filter";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { userLabel } from "@/lib/format";
import { STATUSES, type SortOption, type TaskFilters, type TaskStatus, type User } from "@/lib/types";

export const DEFAULT_FILTERS: TaskFilters = {
  statuses: [],
  assignees: [],
  overdue: false,
  sort: "due_date",
};

/** Durum, kişi ya da geciken filtresinden biri seçili mi? Sıralama filtre sayılmaz. */
export function hasActiveFilters(filters: TaskFilters): boolean {
  return filters.statuses.length > 0 || filters.assignees.length > 0 || filters.overdue;
}

/** Bütün filtreleri sıfırlar; seçili sıralama korunur. */
export function clearFilters(filters: TaskFilters): TaskFilters {
  return { ...DEFAULT_FILTERS, sort: filters.sort };
}

const SORT_LABELS: Record<SortOption, string> = {
  due_date: "Son tarih (en erken önce)",
  "-due_date": "Son tarih (en geç önce)",
  priority: "Öncelik (yüksek önce)",
  "-priority": "Öncelik (düşük önce)",
  created_at: "Oluşturma (en eski önce)",
  "-created_at": "Oluşturma (en yeni önce)",
};

const STATUS_OPTIONS = STATUSES.map((status) => ({ value: status, label: status }));

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

  // "Atanmamış" da bir seçenek. Pasif kişiler de listede, çünkü üzerlerinde eski görevler var.
  const personOptions = [
    { value: "none", label: "Atanmamış" },
    ...users.map((user) => ({ value: String(user.id), label: userLabel(user) })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <MultiSelectFilter
        label="Durum"
        options={STATUS_OPTIONS}
        selected={filters.statuses}
        // Seçenekler STATUSES'tan geldiği için değerler geçerli birer durum.
        onChange={(statuses) => update({ statuses: statuses as TaskStatus[] })}
      />
      <MultiSelectFilter
        label="Kişi"
        options={personOptions}
        selected={filters.assignees}
        onChange={(assignees) => update({ assignees })}
      />
      {/* Tek aç/kapa düğmesi; aria-pressed ekran okuyucuya açık/kapalı olduğunu söyler. */}
      <Button
        variant={filters.overdue ? "secondary" : "outline"}
        aria-pressed={filters.overdue}
        onClick={() => update({ overdue: !filters.overdue })}
      >
        <AlarmClockIcon />
        Geciken
      </Button>
      {hasActiveFilters(filters) && (
        <Button variant="ghost" onClick={() => onChange(clearFilters(filters))}>
          <XIcon />
          Filtreleri temizle
        </Button>
      )}

      <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
        Sırala
        <NativeSelect
          className="text-foreground"
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

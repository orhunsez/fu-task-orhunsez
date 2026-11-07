// Sunucu verisi TanStack Query ile çekilir ve önbellekte tutulur.
// queryKey verinin önbellekteki adresidir; aynı key'i kullanan bileşenler aynı veriyi paylaşır.

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { TaskFilters, TaskList, User } from "@/lib/types";

export const PAGE_SIZE = 20;

/** Ekip listesi (pasifler dahil). Uygulama açıkken değişmediği için bir kez çekilir. */
export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<User[]>("/users"),
    staleTime: Infinity,
  });
}

/** Görev listesi. Filtreler ve sayfa (0'dan başlar) backend'e query string olarak gider. */
export function useTasks(filters: TaskFilters, page: number) {
  const params = new URLSearchParams({
    sort: filters.sort,
    limit: String(PAGE_SIZE),
    offset: String(page * PAGE_SIZE),
  });
  if (filters.status) params.set("status", filters.status);
  if (filters.assignee === "none") params.set("unassigned", "true");
  else if (filters.assignee) params.set("assignee_id", filters.assignee);
  if (filters.overdue) params.set("overdue", "true");

  return useQuery({
    // Filtre ya da sayfa değişince key değişir ve yeni istek atılır.
    queryKey: ["tasks", filters, page],
    queryFn: () => apiFetch<TaskList>(`/tasks?${params}`),
    // Yeni sayfa gelene kadar eski liste ekranda kalır; tablo boşalıp zıplamaz.
    placeholderData: keepPreviousData,
  });
}

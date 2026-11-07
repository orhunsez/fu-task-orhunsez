// Sunucu verisi TanStack Query ile çekilir ve önbellekte tutulur.
// queryKey verinin önbellekteki adresidir; aynı key'i kullanan bileşenler aynı veriyi paylaşır.

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { HistoryEntry, Task, TaskBody, TaskFilters, TaskList, User } from "@/lib/types";

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

/** Tek görev. */
export function useTask(id: number) {
  return useQuery({
    queryKey: ["task", id],
    queryFn: () => apiFetch<Task>(`/tasks/${id}`),
  });
}

/** Görevin değişiklik geçmişi, en yenisi önce. */
export function useHistory(id: number) {
  return useQuery({
    queryKey: ["history", id],
    queryFn: () => apiFetch<HistoryEntry[]>(`/tasks/${id}/history`),
  });
}

// --- Değişiklikler (mutation). Başarılı olunca etkilenen önbellek "eski" sayılır ve
// --- o veriyi gösteren ekran açıksa yeniden çekilir (invalidateQueries).

/** Yeni görev (POST). */
export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: TaskBody) =>
      apiFetch<Task>("/tasks", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

/** Görevi güncelle (PATCH). Kaydedince görev, geçmişi ve liste yeniden çekilir. */
export function useUpdateTask(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: TaskBody) =>
      apiFetch<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    // Promise döndürülür: veriler yeniden çekilene kadar form "kaydediliyor" durumunda kalır.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["task", id] }),
        queryClient.invalidateQueries({ queryKey: ["history", id] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      ]),
  });
}

/** Görevi sil (backend'de soft delete). Liste yeniden çekilir. */
export function useDeleteTask(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>(`/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

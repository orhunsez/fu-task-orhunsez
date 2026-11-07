// Sunucu verisi TanStack Query ile çekilir ve önbellekte tutulur.
// queryKey verinin önbellekteki adresidir; aynı key'i kullanan bileşenler aynı veriyi paylaşır.

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { TaskList, User } from "@/lib/types";

/** Ekip listesi (pasifler dahil). Uygulama açıkken değişmediği için bir kez çekilir. */
export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<User[]>("/users"),
    staleTime: Infinity,
  });
}

/** Görev listesi. */
export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: () => apiFetch<TaskList>("/tasks"),
  });
}

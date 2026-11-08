"use client";

import Link from "next/link";
import { useState } from "react";

import { EmptyState, ErrorState, LoadingRows } from "@/components/query-states";
import { clearFilters, DEFAULT_FILTERS, TaskFiltersBar } from "@/components/task-filters";
import { TaskTable } from "@/components/task-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { useTasks, useUsers } from "@/lib/queries";
import type { TaskFilters } from "@/lib/types";

export default function TaskListPage() {
  // Filtreler URL'de değil sayfa state'inde tutulur; sayfa yenilenince sıfırlanır.
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(0); // 0'dan başlar
  const tasks = useTasks(filters, page);
  const users = useUsers();

  // Filtre değişince 1. sayfaya dönülür; yoksa sonuç az olduğunda boş bir sayfada kalınabilir.
  function changeFilters(next: TaskFilters) {
    setFilters(next);
    setPage(0);
  }

  // Sorgunun durumuna göre dört görünümden biri çizilir.
  function renderTasks() {
    if (tasks.isPending) return <LoadingRows />;
    if (tasks.isError) return <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} />;
    if (tasks.data.items.length === 0) {
      return (
        <EmptyState message="Filtrelere uyan görev yok.">
          <Button variant="outline" onClick={() => changeFilters(clearFilters(filters))}>
            Filtreleri temizle
          </Button>
        </EmptyState>
      );
    }

    const { items, total, offset } = tasks.data;
    return (
      // Yeni sayfa yüklenirken eski liste soluk görünür.
      <div className={tasks.isPlaceholderData ? "opacity-60" : undefined}>
        <TaskTable tasks={items} users={users.data} />
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {offset + 1}–{offset + items.length} / {total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              ‹ Önceki
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + items.length >= total}
              onClick={() => setPage(page + 1)}
            >
              Sonraki ›
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Görevler</h1>
        <Link href="/tasks/new" className={buttonVariants()}>
          + Yeni görev
        </Link>
      </div>
      <TaskFiltersBar filters={filters} users={users.data ?? []} onChange={changeFilters} />
      {renderTasks()}
    </div>
  );
}

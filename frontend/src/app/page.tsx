"use client";

import { EmptyState, ErrorState, LoadingRows } from "@/components/query-states";
import { TaskTable } from "@/components/task-table";
import { useTasks, useUsers } from "@/lib/queries";

export default function TaskListPage() {
  const tasks = useTasks();
  const users = useUsers();

  // Sorgunun durumuna göre dört görünümden biri çizilir.
  function renderTasks() {
    if (tasks.isPending) return <LoadingRows />;
    if (tasks.isError) return <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} />;
    if (tasks.data.items.length === 0) return <EmptyState message="Henüz görev yok." />;
    return <TaskTable tasks={tasks.data.items} users={users.data} />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Görevler</h1>
      {renderTasks()}
    </div>
  );
}

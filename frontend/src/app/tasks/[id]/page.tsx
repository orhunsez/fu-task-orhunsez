"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { EmptyState, ErrorState, LoadingRows } from "@/components/query-states";
import { TaskForm } from "@/components/task-form";
import { TaskHistory } from "@/components/task-history";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api";
import { useDeleteTask, useHistory, useTask, useUpdateTask, useUsers } from "@/lib/queries";
import type { Task, TaskBody } from "@/lib/types";

export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const taskId = Number(params.id);
  const task = useTask(taskId);
  const history = useHistory(taskId);
  const users = useUsers();
  const updateTask = useUpdateTask(taskId);
  const deleteTask = useDeleteTask(taskId);

  // Hata olursa mutateAsync hata fırlatır; form bunu yakalayıp ilgili alanın altına yazar.
  async function save(body: TaskBody) {
    await updateTask.mutateAsync(body);
  }

  // Önce onay sorulur; silinince listeye dönülür. Hata olursa düğmenin altında görünür.
  function remove() {
    if (!window.confirm("Görev silinsin mi?")) return;
    deleteTask.mutate(undefined, { onSuccess: () => router.push("/") });
  }

  function renderHistory(currentTask: Task) {
    if (history.isPending) return <LoadingRows count={4} />;
    if (history.isError) {
      return <ErrorState error={history.error} onRetry={() => history.refetch()} />;
    }
    return <TaskHistory task={currentTask} entries={history.data} users={users.data} />;
  }

  function renderTask() {
    if (task.isPending || users.isPending) return <LoadingRows count={6} />;
    if (task.isError) {
      // 404: görev yok ya da silinmiş. 422: adresteki id sayı değil (örn. /tasks/abc).
      const notFound = task.error instanceof ApiError && [404, 422].includes(task.error.status);
      if (notFound) {
        return (
          <EmptyState message="Görev bulunamadı. Silinmiş ya da hiç oluşturulmamış olabilir.">
            <Link href="/" className={buttonVariants()}>
              Görev listesine dön
            </Link>
          </EmptyState>
        );
      }
      return <ErrorState error={task.error} onRetry={() => task.refetch()} />;
    }
    if (users.isError) return <ErrorState error={users.error} onRetry={() => users.refetch()} />;

    return (
      <>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-xl font-semibold">
            <span className="text-muted-foreground">#{task.data.id}</span> {task.data.title}
          </h1>
          <div className="text-right">
            <Button variant="destructive" disabled={deleteTask.isPending} onClick={remove}>
              {deleteTask.isPending ? "Siliniyor…" : "Sil"}
            </Button>
            {deleteTask.isError && (
              <p className="mt-1 text-sm text-destructive">{deleteTask.error.message}</p>
            )}
          </div>
        </div>
        <div className="grid items-start gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Düzenle</CardTitle>
            </CardHeader>
            <CardContent>
              {/* key: görev kaydedilince (updated_at değişir) form yeni değerlerle baştan kurulur. */}
              <TaskForm
                key={task.data.updated_at}
                task={task.data}
                users={users.data}
                onSave={save}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Değişiklik geçmişi</CardTitle>
            </CardHeader>
            <CardContent>{renderHistory(task.data)}</CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-4">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Görevler
      </Link>
      {renderTask()}
    </div>
  );
}

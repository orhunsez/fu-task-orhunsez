"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { EmptyState, ErrorState, LoadingRows } from "@/components/query-states";
import { StatusBadge } from "@/components/status-badge";
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
    if (task.isPending || users.isPending) {
      return (
        <Card className="px-6">
          <LoadingRows count={6} />
        </Card>
      );
    }
    if (task.isError) {
      // 404: görev yok ya da silinmiş. 422: adresteki id sayı değil (örn. /tasks/abc).
      const notFound = task.error instanceof ApiError && [404, 422].includes(task.error.status);
      if (notFound) {
        return (
          <Card>
            <EmptyState message="Görev bulunamadı. Silinmiş ya da hiç oluşturulmamış olabilir.">
              <Link href="/" className={buttonVariants()}>
                Görev listesine dön
              </Link>
            </EmptyState>
          </Card>
        );
      }
      return (
        <Card>
          <ErrorState error={task.error} onRetry={() => task.refetch()} />
        </Card>
      );
    }
    if (users.isError) {
      return (
        <Card>
          <ErrorState error={users.error} onRetry={() => users.refetch()} />
        </Card>
      );
    }

    return (
      <>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              <span className="text-muted-foreground">#{task.data.id}</span> {task.data.title}
            </h1>
            <StatusBadge status={task.data.status} />
          </div>
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
    <div className="space-y-5">
      <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <ArrowLeftIcon />
        Görevler
      </Link>
      {renderTask()}
    </div>
  );
}

"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ErrorState, LoadingRows } from "@/components/query-states";
import { TaskForm } from "@/components/task-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCreateTask, useUsers } from "@/lib/queries";
import type { TaskBody } from "@/lib/types";

export default function NewTaskPage() {
  const router = useRouter();
  const users = useUsers(); // atanan kişi listesi ve işlem yapan kişinin kontrolü için
  const createTask = useCreateTask();

  // Hata olursa mutateAsync hata fırlatır; form bunu yakalayıp ilgili alanın altına yazar.
  async function save(body: TaskBody) {
    const created = await createTask.mutateAsync(body);
    router.push(`/tasks/${created.id}`); // yeni görevin detay sayfası
  }

  function renderForm() {
    if (users.isPending) return <LoadingRows count={5} />;
    if (users.isError) return <ErrorState error={users.error} onRetry={() => users.refetch()} />;
    return <TaskForm users={users.data} onSave={save} />;
  }

  return (
    <div className="max-w-xl space-y-5">
      <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <ArrowLeftIcon />
        Görevler
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Yeni görev</h1>
      <Card>
        <CardContent>{renderForm()}</CardContent>
      </Card>
    </div>
  );
}

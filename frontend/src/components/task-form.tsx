"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useActor } from "@/lib/actor";
import { ApiError } from "@/lib/api";
import { todayInIstanbul, userLabel } from "@/lib/format";
import { PRIORITIES, STATUSES, type Task, type TaskBody, type User } from "@/lib/types";

// Formun alanları ve kuralları (zod). Seçim ve tarih kutuları metin döndürür; "" boş demek.
// Aynı kurallar backend'de de var; buradaki kontrol kullanıcıya anında mesaj göstermek için.
// originalDueDate: düzenlenen görevin kayıtlı son tarihi. Backend'deki gibi kural sadece
// değişen değere uygulanır; son tarihi geçmiş eski bir görevin diğer alanları kaydedilebilir.
function buildSchema(originalDueDate: string) {
  return z.object({
    title: z
      .string()
      .trim()
      .min(1, "Bu alan boş olamaz.")
      .max(200, "En fazla 200 karakter olabilir."),
    description: z.string(),
    status: z.enum(STATUSES),
    priority: z.enum(PRIORITIES),
    assignee_id: z.string(),
    due_date: z
      .string()
      .refine(
        (value) => !value || value === originalDueDate || value >= todayInIstanbul(),
        "Son tarih geçmişte olamaz.",
      ),
  });
}

type TaskFormValues = z.infer<ReturnType<typeof buildSchema>>;

const FORM_FIELDS = ["title", "description", "status", "priority", "assignee_id", "due_date"] as const;
type FormField = (typeof FORM_FIELDS)[number];

function isFormField(name: string): name is FormField {
  return (FORM_FIELDS as readonly string[]).includes(name);
}

/** Görev -> form değerleri. Kutular metinle çalıştığı için boş alanlar "" olur. */
function toFormValues(task?: Task): TaskFormValues {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: task?.status ?? "Yapılacak",
    priority: task?.priority ?? "Orta",
    assignee_id: task?.assignee_id ? String(task.assignee_id) : "",
    due_date: task?.due_date ?? "",
  };
}

/** Form değerleri -> API değerleri. Boş metin null olur, kişi id'si sayıya çevrilir. */
function toApiValues(values: TaskFormValues) {
  return {
    title: values.title,
    description: values.description.trim() || null,
    status: values.status,
    priority: values.priority,
    assignee_id: values.assignee_id ? Number(values.assignee_id) : null,
    due_date: values.due_date || null,
  };
}

type TaskFormProps = {
  task?: Task; // verilirse düzenleme formu, verilmezse yeni görev formu
  users: User[];
  onSave: (body: TaskBody) => Promise<unknown>;
};

export function TaskForm({ task, users, onSave }: TaskFormProps) {
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(buildSchema(task?.due_date ?? "")),
    defaultValues: toFormValues(task),
  });
  // formState'ten okunan alanlar render sırasında okunmalı; react-hook-form sadece
  // okunanları takip eder (dirtyFields okunmazsa hesaplanmaz).
  const { errors, isSubmitting, isDirty, dirtyFields } = form.formState;

  const { actorId } = useActor();
  // Kaydetmek için seçili kişi aktif bir kullanıcı olmalı.
  const actor = users.find((user) => user.id === actorId && user.is_active);

  // Yeni atama sadece aktif kişilere yapılabilir. Görev zaten pasif birine atanmışsa o kişi de
  // listede kalır; yoksa kutu boş görünür ve görev atanmamış sanılır.
  const assigneeOptions = users.filter((user) => user.is_active || user.id === task?.assignee_id);

  async function submit(values: TaskFormValues) {
    if (!actor) return;
    // Yeni görevde durum hariç her alan gider (backend her zaman "Yapılacak" ile başlatır).
    // Düzenlemede sadece kullanıcının değiştirdiği alanlar gider (PATCH).
    const fields = task
      ? FORM_FIELDS.filter((field) => dirtyFields[field])
      : FORM_FIELDS.filter((field) => field !== "status");
    const apiValues = toApiValues(values);
    const changes = Object.fromEntries(fields.map((field) => [field, apiValues[field]]));

    try {
      await onSave({ ...(changes as Partial<typeof apiValues>), actor_id: actor.id });
    } catch (error) {
      // Backend hatası {"detail", "field"}: alanla ilgiliyse o alanın altına
      // (örn. 409 -> "Durum"), değilse formun üstüne yazılır.
      if (error instanceof ApiError && error.field && isFormField(error.field)) {
        form.setError(error.field, { message: error.message });
      } else {
        const message = error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu";
        form.setError("root", { message });
      }
    }
  }

  return (
    // noValidate: tarayıcının kendi uyarıları yerine zod'un Türkçe mesajları görünsün.
    <form noValidate onSubmit={form.handleSubmit(submit)} className="grid gap-4">
      {errors.root && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {errors.root.message}
        </p>
      )}

      <Field id="title" label="Başlık *" error={errors.title?.message}>
        <Input id="title" aria-invalid={!!errors.title} {...form.register("title")} />
      </Field>

      <Field id="description" label="Açıklama" error={errors.description?.message}>
        <Textarea id="description" rows={3} {...form.register("description")} />
      </Field>

      {/* Yeni görev her zaman "Yapılacak" ile başlar; durum sadece düzenlemede seçilir. */}
      {task && (
        <Field id="status" label="Durum" error={errors.status?.message}>
          {/* Sadece mevcut durum ve izin verilen geçişler (backend'den gelen next_statuses). */}
          <NativeSelect id="status" aria-invalid={!!errors.status} {...form.register("status")}>
            {[task.status, ...task.next_statuses].map((status) => (
              <NativeSelectOption key={status} value={status}>
                {status}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      )}

      <Field id="priority" label="Öncelik *" error={errors.priority?.message}>
        <NativeSelect id="priority" aria-invalid={!!errors.priority} {...form.register("priority")}>
          {PRIORITIES.map((priority) => (
            <NativeSelectOption key={priority} value={priority}>
              {priority}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      <Field id="assignee_id" label="Atanan kişi" error={errors.assignee_id?.message}>
        <NativeSelect
          id="assignee_id"
          aria-invalid={!!errors.assignee_id}
          {...form.register("assignee_id")}
        >
          <NativeSelectOption value="">Atanmamış</NativeSelectOption>
          {assigneeOptions.map((user) => (
            <NativeSelectOption key={user.id} value={user.id}>
              {userLabel(user)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      <Field id="due_date" label="Son tarih" error={errors.due_date?.message}>
        {/* min: takvimde geçmiş günler seçilemez. Asıl kontrol zod'da. */}
        <Input
          id="due_date"
          type="date"
          min={todayInIstanbul()}
          className="w-fit"
          aria-invalid={!!errors.due_date}
          {...form.register("due_date")}
        />
      </Field>

      <div className="flex justify-end gap-2">
        {!task && (
          <Link href="/" className={buttonVariants({ variant: "ghost" })}>
            İptal
          </Link>
        )}
        {/* Düzenlemede bir alan değişmeden kaydedilemez. */}
        <Button type="submit" disabled={!actor || isSubmitting || (!!task && !isDirty)}>
          {isSubmitting ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </div>
      {!actor && (
        <p className="text-right text-sm text-muted-foreground">
          Kaydetmek için sağ üstten işlem yapan kişiyi seçin.
        </p>
      )}
    </form>
  );
}

/** Bir form alanı: etiket, kutu ve varsa hata mesajı (kutunun hemen altında). */
function Field(props: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={props.id}>{props.label}</Label>
      {props.children}
      {props.error && <p className="text-sm text-destructive">{props.error}</p>}
    </div>
  );
}

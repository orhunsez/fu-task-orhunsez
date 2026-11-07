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
import { todayInIstanbul } from "@/lib/format";
import { PRIORITIES, type TaskBody, type User } from "@/lib/types";

// Formun alanları ve kuralları (zod). Seçim ve tarih kutuları metin döndürür; "" boş demek.
// Aynı kurallar backend'de de var; buradaki kontrol kullanıcıya anında mesaj göstermek için.
const taskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Bu alan boş olamaz.")
    .max(200, "En fazla 200 karakter olabilir."),
  description: z.string(),
  priority: z.enum(PRIORITIES),
  assignee_id: z.string(),
  due_date: z
    .string()
    .refine((value) => !value || value >= todayInIstanbul(), "Son tarih geçmişte olamaz."),
});

type TaskFormValues = z.infer<typeof taskSchema>;

const FORM_FIELDS = ["title", "description", "priority", "assignee_id", "due_date"] as const;
type FormField = (typeof FORM_FIELDS)[number];

function isFormField(name: string): name is FormField {
  return (FORM_FIELDS as readonly string[]).includes(name);
}

type TaskFormProps = {
  users: User[];
  onSave: (body: TaskBody) => Promise<unknown>;
};

export function TaskForm({ users, onSave }: TaskFormProps) {
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: "", description: "", priority: "Orta", assignee_id: "", due_date: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const { actorId } = useActor();
  // Kaydetmek için seçili kişi aktif bir kullanıcı olmalı.
  const actor = users.find((user) => user.id === actorId && user.is_active);
  const activeUsers = users.filter((user) => user.is_active);

  async function submit(values: TaskFormValues) {
    if (!actor) return;
    try {
      await onSave({
        title: values.title,
        description: values.description.trim() || null,
        priority: values.priority,
        assignee_id: values.assignee_id ? Number(values.assignee_id) : null,
        due_date: values.due_date || null,
        actor_id: actor.id,
      });
    } catch (error) {
      // Backend hatası {"detail", "field"}: alanla ilgiliyse o alanın altına
      // (örn. pasif kişi -> "Atanan kişi"), değilse formun üstüne yazılır.
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
          {activeUsers.map((user) => (
            <NativeSelectOption key={user.id} value={user.id}>
              {user.full_name}
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
        <Link href="/" className={buttonVariants({ variant: "ghost" })}>
          İptal
        </Link>
        <Button type="submit" disabled={!actor || isSubmitting}>
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

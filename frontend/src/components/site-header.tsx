"use client";

import { WindIcon } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Avatar, UserAvatar } from "@/components/user-avatar";
import { useActor } from "@/lib/actor";
import { useUsers } from "@/lib/queries";

export function SiteHeader() {
  const { actorId, setActorId } = useActor();
  const users = useUsers();
  // Pasif kişi işlem yapamaz; listede sadece aktifler var.
  const activeUsers = users.data?.filter((user) => user.is_active) ?? [];
  const actor = activeUsers.find((user) => user.id === actorId);

  return (
    <header className="mx-auto w-full max-w-6xl px-4 pt-4">
      <Card className="flex-row flex-wrap items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-3 font-semibold">
          <Avatar className="size-9 bg-primary text-primary-foreground">
            <WindIcon className="size-5" />
          </Avatar>
          Saha Bakım Görev Takip
        </Link>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          İşlem yapan kişi
          {actor && <UserAvatar user={actor} />}
          <NativeSelect
            className="text-foreground"
            value={actorId ?? ""}
            onChange={(event) => setActorId(event.target.value ? Number(event.target.value) : null)}
          >
            <NativeSelectOption value="">Seçin…</NativeSelectOption>
            {activeUsers.map((user) => (
              <NativeSelectOption key={user.id} value={user.id}>
                {user.full_name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
      </Card>
    </header>
  );
}

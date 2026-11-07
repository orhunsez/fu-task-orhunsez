"use client";

import Link from "next/link";

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useActor } from "@/lib/actor";
import { useUsers } from "@/lib/queries";

export function SiteHeader() {
  const { actorId, setActorId } = useActor();
  const users = useUsers();
  // Pasif kişi işlem yapamaz; listede sadece aktifler var.
  const activeUsers = users.data?.filter((user) => user.is_active) ?? [];

  return (
    <header className="border-b">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-semibold">
          Saha Bakım Görev Takip
        </Link>
        <label className="flex items-center gap-2 text-sm">
          İşlem yapan kişi:
          <NativeSelect
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
      </div>
    </header>
  );
}

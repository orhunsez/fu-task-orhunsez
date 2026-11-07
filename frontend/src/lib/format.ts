import type { User } from "@/lib/types";

/** "2026-11-17" -> "17.11.2026". Date nesnesine çevirmeden böleriz; saat dilimi günü kaydıramaz. */
export function formatDate(isoDate: string | null): string {
  if (!isoDate) return "—";
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

/** Kişi id'sini ada çevirir. Boşsa "—"; pasif kişinin adına "(pasif)" eklenir. */
export function userName(users: User[] | undefined, id: number | null): string {
  if (id === null) return "—";
  const user = users?.find((candidate) => candidate.id === id);
  if (!user) return `Kişi #${id}`;
  return user.is_active ? user.full_name : `${user.full_name} (pasif)`;
}

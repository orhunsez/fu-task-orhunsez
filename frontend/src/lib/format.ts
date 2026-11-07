import type { User } from "@/lib/types";

/** "2026-11-17" -> "17.11.2026". Date nesnesine çevirmeden böleriz; saat dilimi günü kaydıramaz. */
export function formatDate(isoDate: string | null): string {
  if (!isoDate) return "—";
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

/** Bugünün tarihi İstanbul saatine göre, "YYYY-MM-DD" (en-CA biçimi bu sırayı verir). */
export function todayInIstanbul(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}

/** Seçim listelerinde ve tabloda kişinin görünen adı; pasif kişiye "(pasif)" eklenir. */
export function userLabel(user: User): string {
  return user.is_active ? user.full_name : `${user.full_name} (pasif)`;
}

/** Kişi id'sini ada çevirir. Boşsa "—"; listede olmayan id "Kişi #id" olarak görünür. */
export function userName(users: User[] | undefined, id: number | null): string {
  if (id === null) return "—";
  const user = users?.find((candidate) => candidate.id === id);
  return user ? userLabel(user) : `Kişi #${id}`;
}

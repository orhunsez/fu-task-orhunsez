import { cn } from "@/lib/utils";
import type { User } from "@/lib/types";

// Kişiler bir bakışta ayırt edilsin diye id'ye göre sabit bir yumuşak renk.
const AVATAR_COLORS = [
  "bg-emerald-100 text-emerald-800",
  "bg-sky-100 text-sky-800",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-800",
  "bg-violet-100 text-violet-800",
  "bg-teal-100 text-teal-800",
];

/** "Selin Aydın" -> "SA". */
function initials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toLocaleUpperCase("tr-TR"))
    .join("");
}

/** Yuvarlak rozet: kişi avatarı ve logo için ortak şekil. */
export function Avatar({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Kişinin baş harfleri; pasif kişi gri. */
export function UserAvatar({ user }: { user: User }) {
  const color = user.is_active ? AVATAR_COLORS[user.id % AVATAR_COLORS.length] : "bg-muted text-muted-foreground";
  return <Avatar className={color}>{initials(user.full_name)}</Avatar>;
}

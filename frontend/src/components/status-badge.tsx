import { Badge } from "@/components/ui/badge";
import type { TaskStatus } from "@/lib/types";

// Her durumun kendi yumuşak rengi var; tabloda ve takvimde bir bakışta ayırt edilsin.
const STATUS_COLORS: Record<TaskStatus, string> = {
  Yapılacak: "bg-slate-100 text-slate-700",
  "Devam ediyor": "bg-sky-100 text-sky-800",
  Beklemede: "bg-amber-100 text-amber-800",
  Bitti: "bg-emerald-100 text-emerald-800",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <Badge className={STATUS_COLORS[status]}>{status}</Badge>;
}

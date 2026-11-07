import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, userName } from "@/lib/format";
import type { Task, TaskStatus, User } from "@/lib/types";

// Her durumun kendi rengi var; tabloda bir bakışta ayırt edilsin.
const STATUS_COLORS: Record<TaskStatus, string> = {
  Yapılacak: "bg-slate-100 text-slate-700",
  "Devam ediyor": "bg-blue-100 text-blue-800",
  Beklemede: "bg-amber-100 text-amber-800",
  Bitti: "bg-green-100 text-green-800",
};

function StatusBadge({ status }: { status: TaskStatus }) {
  return <Badge className={STATUS_COLORS[status]}>{status}</Badge>;
}

type TaskTableProps = {
  tasks: Task[];
  users: User[] | undefined; // atanan kişinin adını göstermek için
};

export function TaskTable({ tasks, users }: TaskTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">#</TableHead>
          <TableHead>Başlık</TableHead>
          <TableHead>Durum</TableHead>
          <TableHead>Öncelik</TableHead>
          <TableHead>Atanan</TableHead>
          <TableHead>Son tarih</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => (
          <TableRow key={task.id}>
            <TableCell className="text-muted-foreground">{task.id}</TableCell>
            <TableCell className="font-medium">{task.title}</TableCell>
            <TableCell>
              <StatusBadge status={task.status} />
            </TableCell>
            <TableCell>{task.priority}</TableCell>
            <TableCell>{userName(users, task.assignee_id)}</TableCell>
            <TableCell>
              {/* Gecikme kararını backend verir (is_overdue); burada sadece gösterilir. */}
              {task.is_overdue ? (
                <span className="flex items-center gap-2 font-medium text-destructive">
                  {formatDate(task.due_date)}
                  <Badge variant="destructive">Gecikmiş</Badge>
                </span>
              ) : (
                formatDate(task.due_date)
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

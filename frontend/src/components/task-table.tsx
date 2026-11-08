"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserAvatar } from "@/components/user-avatar";
import { formatDate, userLabel, userName } from "@/lib/format";
import type { Task, User } from "@/lib/types";

/** Atanan kişi: yuvarlak avatar + isim. Atanmamışsa soluk "Atanmamış". */
function Assignee({ users, id }: { users: User[] | undefined; id: number | null }) {
  if (id === null) return <span className="text-muted-foreground">Atanmamış</span>;
  const user = users?.find((candidate) => candidate.id === id);
  if (!user) return userName(users, id); // kişi listesi henüz gelmediyse "Kişi #id"
  return (
    <span className="flex items-center gap-2.5">
      <UserAvatar user={user} />
      {userLabel(user)}
    </span>
  );
}

type TaskTableProps = {
  tasks: Task[];
  users: User[] | undefined; // atanan kişinin adını göstermek için
};

export function TaskTable({ tasks, users }: TaskTableProps) {
  const router = useRouter();

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
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
          // Satırın tamamı tıklanabilir; başlıktaki link klavye ve "yeni sekmede aç" için.
          <TableRow
            key={task.id}
            className="cursor-pointer"
            onClick={() => router.push(`/tasks/${task.id}`)}
          >
            <TableCell className="text-muted-foreground">{task.id}</TableCell>
            <TableCell className="font-medium">
              {/* stopPropagation: link tıklanınca satırın onClick'i ikinci kez gezinmesin. */}
              <Link
                href={`/tasks/${task.id}`}
                className="hover:text-primary"
                onClick={(event) => event.stopPropagation()}
              >
                {task.title}
              </Link>
            </TableCell>
            <TableCell>
              <StatusBadge status={task.status} />
            </TableCell>
            <TableCell>{task.priority}</TableCell>
            <TableCell>
              <Assignee users={users} id={task.assignee_id} />
            </TableCell>
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

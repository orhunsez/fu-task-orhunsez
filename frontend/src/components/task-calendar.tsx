"use client";

import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ErrorState, LoadingRows } from "@/components/query-states";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  addMonths,
  dayLabel,
  daysOfMonth,
  leadingBlanks,
  monthLabel,
  monthOf,
  WEEKDAY_NAMES,
  type YearMonth,
} from "@/lib/calendar";
import { todayInIstanbul } from "@/lib/format";
import { useTasksDueBetween } from "@/lib/queries";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Liste sayfasındaki "Takvim" butonu ve açılan ay görünümü. Yalnızca görüntüleme:
 * son tarihi olan görevler günlerinde nokta olarak görünür, güne tıklayınca o günün
 * görevleri listelenir. Liste filtrelerinden bağımsızdır.
 */
export function CalendarMenu() {
  // Ay ve seçili gün burada tutulur; popover kapanıp açılınca kalınan yerden devam eder.
  const [month, setMonth] = useState<YearMonth>(() => monthOf(todayInIstanbul()));
  const [selectedDay, setSelectedDay] = useState(() => todayInIstanbul());

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="lg" />}>
        <CalendarDaysIcon />
        Takvim
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        {/* Panel sadece açıkken çizilir; veri de ancak o zaman çekilir. */}
        <CalendarPanel
          month={month}
          onMonthChange={setMonth}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
        />
      </PopoverContent>
    </Popover>
  );
}

type CalendarPanelProps = {
  month: YearMonth;
  onMonthChange: (month: YearMonth) => void;
  selectedDay: string; // "YYYY-MM-DD"
  onSelectDay: (day: string) => void;
};

function CalendarPanel({ month, onMonthChange, selectedDay, onSelectDay }: CalendarPanelProps) {
  const today = todayInIstanbul();
  const days = daysOfMonth(month);
  // Sadece görünen ay çekilir: ayın ilk ve son günü, iki uç dahil.
  const tasks = useTasksDueBetween(days[0], days[days.length - 1]);

  // Görevler son tarihlerine göre gruplanır: "2026-11-10" -> [görev, ...]
  const tasksByDay = new Map<string, Task[]>();
  for (const task of tasks.data?.items ?? []) {
    if (!task.due_date) continue; // aralık filtresi son tarihsizleri zaten dışarıda bırakır
    tasksByDay.set(task.due_date, [...(tasksByDay.get(task.due_date) ?? []), task]);
  }

  function goToToday() {
    onMonthChange(monthOf(today));
    onSelectDay(today);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{monthLabel(month)}</span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Bugün
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Önceki ay"
            onClick={() => onMonthChange(addMonths(month, -1))}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Sonraki ay"
            onClick={() => onMonthChange(addMonths(month, 1))}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_NAMES.map((name) => (
          <span key={name} className="py-1 text-xs text-muted-foreground">
            {name}
          </span>
        ))}
        {/* Ayın 1'i doğru sütuna düşsün diye önce boş hücreler. */}
        {Array.from({ length: leadingBlanks(month) }, (_, index) => (
          <span key={`blank-${index}`} />
        ))}
        {days.map((day) => (
          <CalendarDay
            key={day}
            day={day}
            tasks={tasksByDay.get(day) ?? []}
            isToday={day === today}
            isSelected={day === selectedDay}
            onSelect={() => onSelectDay(day)}
          />
        ))}
      </div>

      {tasks.data && tasks.data.total > tasks.data.items.length && (
        <p className="text-xs text-muted-foreground">
          Bu ayda {tasks.data.total} görev var; ilk {tasks.data.items.length} tanesi gösteriliyor.
        </p>
      )}

      <div className="border-t pt-3">
        {days.includes(selectedDay) ? (
          <>
            <p className="mb-2 font-medium">{dayLabel(selectedDay)}</p>
            <DayTasks query={tasks} dayTasks={tasksByDay.get(selectedDay) ?? []} />
          </>
        ) : (
          <p className="text-muted-foreground">Görevleri görmek için bir gün seçin.</p>
        )}
      </div>
    </div>
  );
}

type CalendarDayProps = {
  day: string;
  tasks: Task[];
  isToday: boolean;
  isSelected: boolean;
  onSelect: () => void;
};

/** Izgaradaki bir gün: rakam ve altında en çok 3 nokta (her nokta bir görev). */
function CalendarDay({ day, tasks, isToday, isSelected, onSelect }: CalendarDayProps) {
  // Gecikme kararı backend'den gelir (is_overdue); burada hesaplanmaz.
  const hasOverdue = tasks.some((task) => task.is_overdue);

  return (
    <Button
      variant={isSelected ? "default" : "ghost"}
      size="icon-lg"
      aria-pressed={isSelected}
      aria-label={`${dayLabel(day)}, ${tasks.length} görev${hasOverdue ? ", gecikmiş görev var" : ""}`}
      className={cn(
        "mx-auto flex-col gap-0.5 font-normal",
        // Seçili gün dolu yeşil daire; seçili değilse bugün yeşil, gecikmiş günü kırmızı yazılır.
        !isSelected && isToday && "font-semibold text-primary",
        !isSelected && hasOverdue && "font-semibold text-destructive",
      )}
      onClick={onSelect}
    >
      {Number(day.slice(8))}
      <span className="flex h-1 gap-0.5" aria-hidden="true">
        {tasks.slice(0, 3).map((task) => (
          <span key={task.id} className={cn("size-1 rounded-full", dotColor(task, isSelected))} />
        ))}
      </span>
    </Button>
  );
}

/** Nokta rengi: seçili günde beyaz; gecikmiş kırmızı, bitmiş gri, diğerleri yeşil. */
function dotColor(task: Task, isSelected: boolean): string {
  if (isSelected) return "bg-primary-foreground";
  if (task.is_overdue) return "bg-destructive";
  if (task.status === "Bitti") return "bg-muted-foreground/50";
  return "bg-primary";
}

type DayTasksProps = {
  query: ReturnType<typeof useTasksDueBetween>;
  dayTasks: Task[];
};

/** Seçili günün görevleri: başlık + durum rozeti. Bitti soluk; tıklayınca detay sayfası. */
function DayTasks({ query, dayTasks }: DayTasksProps) {
  if (query.isPending) return <LoadingRows count={2} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (dayTasks.length === 0) {
    return <p className="text-muted-foreground">Bu güne son tarihli görev yok.</p>;
  }

  return (
    <ul className="space-y-1">
      {dayTasks.map((task) => (
        <li key={task.id}>
          <Link
            href={`/tasks/${task.id}`}
            className={cn(
              "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted",
              task.status === "Bitti" && "opacity-50",
            )}
          >
            {/* Uzun başlık kesilir; tamamı üzerine gelince görünür. */}
            <span
              title={task.title}
              className={cn("truncate", task.is_overdue && "text-destructive")}
            >
              {task.title}
            </span>
            <StatusBadge status={task.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

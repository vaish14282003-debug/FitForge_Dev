"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { FormError } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { useSaveAvailability } from "@/hooks/use-schedule";
import { WEEKDAYS } from "@/lib/schedule";
import type { Availability, WeeklyBlock } from "@/lib/types";
import { cn } from "@/lib/utils";

// Monday first, the way gyms plan the week.
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const timeClass =
  "h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm tabular-nums [color-scheme:dark] focus-visible:border-primary focus-visible:outline-none";

export function AvailabilityEditor({ initial }: { initial: Availability }) {
  const [weekly, setWeekly] = useState<WeeklyBlock[]>(initial.weekly);
  const [length, setLength] = useState(initial.sessionMinutes);
  const save = useSaveAvailability();
  const toast = useToast();

  const update = (index: number, patch: Partial<WeeklyBlock>) => setWeekly((w) => w.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  const blocksFor = (day: number) => weekly.map((b, i) => ({ ...b, i })).filter((b) => b.day === day);
  const hours = weekly.reduce((n, b) => n + Math.max(0, (Number(b.end.slice(0, 2)) * 60 + Number(b.end.slice(3)) - Number(b.start.slice(0, 2)) * 60 - Number(b.start.slice(3))) / 60), 0);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="text-foreground">Your hours</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{hours ? `${Math.round(hours)} hours a week. Members book in ${length}-minute slots.` : "Add the times clients can book you."}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Session length</span>
          <select value={length} onChange={(e) => setLength(Number(e.target.value) as Availability["sessionMinutes"])} className={timeClass}>
            {[30, 45, 60, 90].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
      </div>

      <ul className="mt-5 divide-y divide-white/5">
        {ORDER.map((day) => {
          const blocks = blocksFor(day);
          return (
            <li key={day} className="flex flex-wrap items-start gap-3 py-3">
              <span className={cn("w-24 pt-2 text-sm font-medium", blocks.length === 0 && "text-muted-foreground")}>{WEEKDAYS[day]}</span>
              <div className="flex flex-1 flex-col gap-2">
                {blocks.length === 0 && <span className="pt-2 text-sm text-muted-foreground">Off</span>}
                {blocks.map((b) => (
                  <div key={b.i} className="flex items-center gap-2">
                    <input type="time" value={b.start} onChange={(e) => update(b.i, { start: e.target.value })} aria-label={`${WEEKDAYS[day]} start`} className={timeClass} />
                    <span className="text-muted-foreground">–</span>
                    <input type="time" value={b.end} onChange={(e) => update(b.i, { end: e.target.value })} aria-label={`${WEEKDAYS[day]} end`} className={timeClass} />
                    <button
                      type="button"
                      onClick={() => setWeekly((w) => w.filter((_, i) => i !== b.i))}
                      aria-label={`Remove ${WEEKDAYS[day]} ${b.start} block`}
                      className="grid size-9 place-items-center rounded-full text-muted-foreground transition hover:bg-primary/15 hover:text-accent-text"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setWeekly((w) => [...w, blocks.length ? { day, start: "17:00", end: "21:00" } : { day, start: "07:00", end: "11:00" }])}
                className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
              >
                <Plus className="size-4" aria-hidden />
                Add hours
              </button>
            </li>
          );
        })}
      </ul>

      <FormError message={save.error?.message} />
      <div className="mt-4 flex justify-end">
        <Button loading={save.isPending} onClick={() => save.mutate({ weekly, sessionMinutes: length }, { onSuccess: () => toast({ title: "Hours saved", description: "Members see the new slots straight away." }) })}>
          Save hours
        </Button>
      </div>
    </Card>
  );
}

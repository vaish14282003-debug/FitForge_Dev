"use client";

import { useState } from "react";
import { CalendarX } from "lucide-react";
import { dayLabel, formatTime } from "@/lib/schedule";
import type { Slot, SlotDays } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Day tabs and time chips. Taken slots are shown (struck through) so the schedule reads truthfully. */
export function SlotPicker({ data, onPick }: { data: SlotDays; onPick: (slot: Slot) => void }) {
  const firstOpen = Math.max(0, data.days.findIndex((d) => d.slots.some((s) => s.available)));
  const [active, setActive] = useState(firstOpen);
  const day = data.days[active];

  return (
    <div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="tablist" aria-label="Day">
        {data.days.map((d, i) => {
          const open = d.slots.filter((s) => s.available).length;
          const date = new Date(`${d.date}T12:00:00`);
          return (
            <button
              key={d.date}
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={cn(
                "flex w-16 shrink-0 flex-col items-center rounded-2xl border py-2.5 transition",
                i === active ? "border-primary bg-primary text-white shadow-[0_6px_20px_-8px_var(--primary)]" : "border-white/10 bg-white/[0.04] hover:border-white/25",
                open === 0 && i !== active && "opacity-50",
              )}
            >
              <span className="text-xs font-medium opacity-80">{date.toLocaleDateString(undefined, { weekday: "short" })}</span>
              <span className="font-display text-xl font-semibold">{date.getDate()}</span>
              <span className={cn("text-[11px]", i === active ? "text-white/80" : "text-muted-foreground")}>{open ? `${open} open` : "full"}</span>
            </button>
          );
        })}
      </div>
      {day.slots.length === 0 ? (
        <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <CalendarX className="size-4" aria-hidden />
          No sessions on {dayLabel(day.date)}.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {day.slots.map((slot) => (
            <button
              key={slot.startsAt}
              type="button"
              disabled={!slot.available}
              onClick={() => onPick(slot)}
              aria-label={`${formatTime(slot.startsAt)}${slot.yours ? ", your session" : slot.available ? "" : ", taken"}`}
              className={cn(
                "rounded-xl border py-2.5 text-sm font-semibold tabular-nums transition",
                slot.yours
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                  : slot.available
                    ? "border-white/10 bg-white/[0.04] hover:border-primary hover:bg-primary/10"
                    : "cursor-not-allowed border-transparent bg-white/[0.02] text-muted-foreground/50 line-through",
              )}
            >
              {formatTime(slot.startsAt)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

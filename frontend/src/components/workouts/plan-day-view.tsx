"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Clock, Repeat, Timer, Weight } from "lucide-react";
import { MuscleIconTile, Tag } from "@/components/workouts/exercise-bits";
import type { PlanDay } from "@/lib/types";
import { cn } from "@/lib/utils";
import { equipmentLabel, estimateMinutes, formatRest, muscleLabel } from "@/lib/workout";

function Stat({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1 text-sm">
      <Icon className="size-3.5 text-accent-text" aria-hidden />
      {children}
    </span>
  );
}

/** Read-only day-by-day view of a plan, with expandable how-to for each exercise. */
export function PlanDayView({ days, action }: { days: PlanDay[]; action?: (dayIndex: number) => React.ReactNode }) {
  const [active, setActive] = useState(0);
  const [openRow, setOpenRow] = useState<number | null>(null);
  const day = days[active];

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Plan days">
        {days.map((d, i) => (
          <button
            key={`${d.name}-${i}`}
            role="tab"
            aria-selected={i === active}
            onClick={() => {
              setActive(i);
              setOpenRow(null);
            }}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition duration-200",
              i === active
                ? "border-primary bg-primary text-white shadow-[0_6px_20px_-8px_var(--primary)]"
                : "border-white/10 bg-white/[0.04] text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="mr-1.5 opacity-70">Day {i + 1}</span>
            {d.name}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-muted-foreground">
        <Stat icon={Clock}>~{estimateMinutes(day)} min</Stat>
        <Stat icon={Repeat}>{day.exercises.length} exercises</Stat>
        {action ? <span className="ml-auto">{action(active)}</span> : null}
      </div>

      <ol className="space-y-3">
        {day.exercises.map((item, i) => {
          const open = openRow === i;
          return (
            <motion.li
              key={`${active}-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
              className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl"
            >
              <button
                type="button"
                onClick={() => setOpenRow(open ? null : i)}
                aria-expanded={open}
                className="flex w-full flex-wrap items-center gap-x-4 gap-y-3 p-4 text-left sm:p-5"
              >
                <span className="font-display hidden w-6 text-center text-xl font-semibold text-muted-foreground sm:block">{i + 1}</span>
                <MuscleIconTile group={item.exercise.muscleGroup} imageUrl={item.exercise.imageUrl} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{item.exercise.name}</span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    <Tag tone="red">{muscleLabel(item.exercise.muscleGroup)}</Tag>
                    <Tag>{equipmentLabel(item.exercise.equipment)}</Tag>
                  </span>
                </span>
                <span className="order-last flex w-full flex-wrap gap-2 sm:order-none sm:w-auto">
                  <Stat icon={Repeat}>
                    {item.sets} × {item.reps}
                  </Stat>
                  {item.weight != null && <Stat icon={Weight}>{item.weight} kg</Stat>}
                  <Stat icon={Timer}>{formatRest(item.restSeconds)}</Stat>
                </span>
                <ChevronDown
                  className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
                  aria-hidden
                />
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2 border-t border-white/10 px-5 py-4 text-sm leading-relaxed text-muted-foreground sm:pl-[7.25rem]">
                      <p>{item.exercise.instructions || "No instructions added for this exercise."}</p>
                      {item.notes && (
                        <p className="text-foreground">
                          <span className="font-semibold text-accent-text">Coach&apos;s note: </span>
                          {item.notes}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}

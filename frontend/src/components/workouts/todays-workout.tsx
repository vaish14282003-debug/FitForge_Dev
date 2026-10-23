"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CircleCheck, Clock, Dumbbell, Play, Repeat } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import type { WorkoutPlan } from "@/lib/types";
import { estimateMinutes } from "@/lib/workout";

export const startHref = (planId: string, dayIndex: number) => `/workouts/session?plan=${planId}&day=${dayIndex}`;

/** The next day in the member's plan, one tap from starting it. */
export function TodaysWorkout({ plan, dayIndex, trainedToday }: { plan: WorkoutPlan; dayIndex: number; trainedToday: boolean }) {
  const day = plan.days[dayIndex] ?? plan.days[0];
  const minutes = estimateMinutes(day);

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl sm:p-8"
    >
      <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-primary/25 blur-[90px]" aria-hidden />
      <div className="relative flex flex-wrap items-start justify-between gap-6">
        <div>
          {trainedToday ? (
            <p className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
              <CircleCheck className="size-3.5" aria-hidden />
              Done for today · up next
            </p>
          ) : (
            <p className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-accent-text">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
              Today&apos;s workout
            </p>
          )}
          <h2 className="font-display mt-4 text-4xl font-semibold sm:text-5xl">{day.name}</h2>
          <p className="mt-1 text-muted-foreground">
            Day {dayIndex + 1} of {plan.days.length} · {plan.name}
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5">
              <Dumbbell className="size-4 text-accent-text" aria-hidden />
              {day.exercises.length} exercises
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5">
              <Clock className="size-4 text-accent-text" aria-hidden />~{minutes} min
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/workouts" className={buttonClass({ variant: "outline" })}>
            View plan
          </Link>
          <Link href={startHref(plan.id, dayIndex)} className={buttonClass()}>
            <Play className="size-4 fill-current" aria-hidden />
            Start workout
          </Link>
        </div>
      </div>

      <ol className="relative mt-6 grid gap-2 sm:grid-cols-2">
        {day.exercises.slice(0, 6).map((item, i) => (
          <li key={i} className="flex items-center gap-3 rounded-2xl bg-white/[0.03] px-4 py-3">
            <span className="font-display w-5 text-lg font-semibold text-muted-foreground">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{item.exercise.name}</span>
            <span className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
              <Repeat className="size-3.5" aria-hidden />
              {item.sets} × {item.reps}
            </span>
          </li>
        ))}
      </ol>
    </motion.section>
  );
}

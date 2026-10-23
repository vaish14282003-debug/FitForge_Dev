"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Trophy } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import type { TrainingSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/workout";

/** Last 7 days as bars. Height follows volume, so a big session reads as a big bar. */
export function WeekActivity({ week }: { week: TrainingSummary["week"] }) {
  const maxVolume = Math.max(1, ...week.map((d) => d.volume));
  const active = week.filter((d) => d.count > 0).length;

  return (
    <Card className="h-full">
      <div className="flex items-baseline justify-between">
        <CardTitle className="text-foreground">This week</CardTitle>
        <span className="text-sm text-muted-foreground">
          {active} of 7 days active
        </span>
      </div>
      <div className="mt-6 flex h-36 items-end gap-2 sm:gap-3" role="img" aria-label={`${active} active days in the last week`}>
        {week.map((day, i) => {
          const date = new Date(`${day.date}T12:00:00`);
          const isToday = i === week.length - 1;
          const height = day.count ? Math.max(18, (day.volume / maxVolume) * 100) : 6;
          return (
            <div key={day.date} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ duration: 0.6, delay: 0.2 + i * 0.05, ease: "easeOut" }}
                title={day.count ? `${day.count} workout${day.count > 1 ? "s" : ""}` : "Rest day"}
                className={cn(
                  "w-full max-w-10 rounded-xl",
                  day.count ? "bg-linear-to-t from-[#a8130a] to-primary shadow-[0_8px_24px_-10px_var(--primary)]" : "bg-white/[0.07]",
                )}
              />
              <span className={cn("text-xs", isToday ? "font-semibold text-foreground" : "text-muted-foreground")}>
                {date.toLocaleDateString(undefined, { weekday: "narrow" })}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function RecentPrs({ prs }: { prs: TrainingSummary["recentPrs"] }) {
  return (
    <Card className="h-full">
      <div className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Trophy className="size-4 text-amber-300" aria-hidden />
          Personal records
        </CardTitle>
        <Link href="/history" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground">
          History
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      {prs.length === 0 ? (
        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          Lift heavier than ever on any exercise and it lands here. Your first workout sets the baseline.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {prs.map((pr, i) => (
            <li key={`${pr.exercise}-${i}`} className="flex items-center gap-3 rounded-2xl bg-white/[0.03] px-3 py-2.5">
              <span className="grid size-8 place-items-center rounded-full bg-amber-400/15 text-amber-300">
                <Trophy className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{pr.exerciseName}</span>
                <span className="block text-xs text-muted-foreground">{formatDate(pr.achievedAt)}</span>
              </span>
              <span className="font-display text-lg font-semibold">
                {pr.weight}
                <span className="ml-0.5 text-sm text-muted-foreground">kg × {pr.reps}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

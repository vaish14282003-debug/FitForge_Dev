"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, History, MessageSquareQuote } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/stat-card";
import { buttonClass } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionDetail, SessionStats } from "@/components/workouts/session-detail";
import { StravaSessionLink } from "@/components/strava/strava-session-link";
import { useSessions } from "@/hooks/use-sessions";
import type { WorkoutSession } from "@/lib/types";

const monthLabel = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });

export default function WorkoutHistory() {
  const { data: sessions, isPending } = useSessions({ limit: 100 });
  const [open, setOpen] = useState<WorkoutSession | null>(null);

  // Group by month so a long history stays scannable.
  const groups: { month: string; items: WorkoutSession[] }[] = [];
  for (const session of sessions ?? []) {
    const month = monthLabel(session.completedAt);
    const group = groups.at(-1);
    if (group?.month === month) group.items.push(session);
    else groups.push({ month, items: [session] });
  }

  return (
    <>
      <PageHeader
        eyebrow="Training log"
        title={
          <>
            Workout <span className="text-primary">history</span>
          </>
        }
        subtitle="Every session you've finished, with your sets, personal records and your trainer's feedback."
      />

      {isPending ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-3xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState icon={History} title="No workouts logged yet">
          Finish your first workout and it will show up here.{" "}
          <Link href="/workouts" className={buttonClass({ size: "sm", className: "mt-4" })}>
            Go to my workouts
          </Link>
        </EmptyState>
      ) : (
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.month}>
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{group.month}</h2>
              <ul className="space-y-3">
                {group.items.map((session, i) => {
                  const date = new Date(session.completedAt);
                  return (
                    <motion.li
                      key={session.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 8) * 0.04 }}
                    >
                      <button
                        type="button"
                        onClick={() => setOpen(session)}
                        className="group flex w-full items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-left backdrop-blur-xl transition duration-200 hover:border-white/20 hover:bg-white/[0.05] sm:p-5"
                      >
                        <span className="grid w-14 shrink-0 place-items-center rounded-2xl bg-primary/10 py-2 text-center ring-1 ring-primary/20">
                          <span className="text-xs font-semibold text-accent-text uppercase">
                            {date.toLocaleDateString(undefined, { weekday: "short" })}
                          </span>
                          <span className="font-display text-2xl leading-none font-semibold">{date.getDate()}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate font-semibold">{session.dayName}</span>
                            {session.review.reviewedAt && (
                              <MessageSquareQuote className="size-4 shrink-0 text-accent-text" aria-label="Has trainer feedback" />
                            )}
                          </span>
                          <span className="block truncate text-sm text-muted-foreground">{session.planName}</span>
                          <SessionStats session={session} className="mt-2" />
                        </span>
                        <ChevronRight className="size-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" aria-hidden />
                      </button>
                    </motion.li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Dialog
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.dayName ?? ""}
        description={
          open
            ? `${new Date(open.completedAt).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} · ${open.planName}`
            : undefined
        }
        className="max-w-xl"
      >
        {open && (
          <>
            <SessionDetail session={open} />
            <StravaSessionLink session={open} className="mt-5 border-t border-white/10 pt-4" />
          </>
        )}
      </Dialog>
    </>
  );
}

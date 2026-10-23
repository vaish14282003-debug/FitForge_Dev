"use client";

import { Clock, Layers, MessageSquareQuote, Trophy, Weight } from "lucide-react";
import { MuscleIconTile } from "@/components/workouts/exercise-bits";
import type { WorkoutSession } from "@/lib/types";
import { formatDuration, formatVolume } from "@/lib/workout";

export function SessionStats({ session, className }: { session: WorkoutSession; className?: string }) {
  const cls = ["flex flex-wrap gap-2 text-sm", className].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1">
        <Clock className="size-3.5 text-accent-text" aria-hidden />
        {formatDuration(session.durationSeconds)}
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1">
        <Weight className="size-3.5 text-accent-text" aria-hidden />
        {formatVolume(session.totalVolume)}
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1">
        <Layers className="size-3.5 text-accent-text" aria-hidden />
        {session.completedSets} sets
      </span>
      {session.prs.length > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1 font-medium text-amber-300">
          <Trophy className="size-3.5" aria-hidden />
          {session.prs.length} PR{session.prs.length > 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

/** Everything logged in one workout: sets per exercise, PRs, the member's note and trainer feedback. */
export function SessionDetail({ session }: { session: WorkoutSession }) {
  const prIds = new Set(session.prs.map((pr) => pr.exercise));
  return (
    <div className="space-y-5">
      <SessionStats session={session} />
      <ol className="space-y-3">
        {session.entries.map((entry, i) => (
          <li key={`${entry.exercise}-${i}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-3">
              <MuscleIconTile group={entry.muscleGroup} className="size-9" />
              <p className="min-w-0 flex-1 truncate font-semibold">{entry.exerciseName}</p>
              {prIds.has(entry.exercise) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
                  <Trophy className="size-3" aria-hidden />
                  PR
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {entry.sets
                .filter((set) => set.done)
                .map((set, si) => (
                  <span key={si} className="rounded-xl bg-primary/10 px-3 py-1.5 text-sm tabular-nums">
                    {set.weight ? `${set.weight} kg × ${set.reps}` : `${set.reps} reps`}
                  </span>
                ))}
              {entry.sets.some((set) => !set.done) && (
                <span className="rounded-xl bg-white/[0.04] px-3 py-1.5 text-sm text-muted-foreground">
                  {entry.sets.every((set) => !set.done) ? "Skipped" : `+${entry.sets.filter((set) => !set.done).length} skipped`}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
      {session.notes ? (
        <div className="rounded-2xl bg-white/[0.04] p-4 text-sm">
          <p className="mb-1 font-semibold">Member&apos;s note</p>
          <p className="text-muted-foreground">{session.notes}</p>
        </div>
      ) : null}
      {session.review.reviewedAt ? (
        <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm">
          <p className="mb-1 flex items-center gap-2 font-semibold text-accent-text">
            <MessageSquareQuote className="size-4" aria-hidden />
            Feedback from {session.review.reviewedBy?.name ?? "your trainer"}
          </p>
          <p>{session.review.comment}</p>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, MousePointerClick, SearchX } from "lucide-react";
import { BodyMap, GROUPS_BY_SIDE, type BodySide } from "@/components/explorer/body-map";
import { EmptyState, PageHeader } from "@/components/stat-card";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ExerciseMeta, MuscleIconTile } from "@/components/workouts/exercise-bits";
import { useExercises } from "@/hooks/use-workouts";
import type { Exercise, MuscleGroup } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MUSCLE_GROUPS, equipmentLabel, muscleLabel } from "@/lib/workout";

function SideToggle({ side, onChange }: { side: BodySide; onChange: (s: BodySide) => void }) {
  return (
    <div className="mx-auto flex w-fit gap-1 rounded-full border border-white/10 bg-white/5 p-1" role="radiogroup" aria-label="Body view">
      {(["front", "back"] as const).map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={side === s}
          onClick={() => onChange(s)}
          className={cn(
            "rounded-full px-5 py-1.5 text-sm font-medium capitalize transition",
            side === s ? "bg-primary text-white shadow-[0_6px_20px_-8px_var(--primary)]" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function ExerciseDetail({ exercise }: { exercise: Exercise | null }) {
  if (!exercise) {
    return (
      <Card className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-white/[0.06] text-muted-foreground">
          <MousePointerClick className="size-5" aria-hidden />
        </span>
        <p className="font-medium">Pick an exercise</p>
        <p className="max-w-xs text-sm text-muted-foreground">Its muscles, equipment and how to do it will show here.</p>
      </Card>
    );
  }
  return (
    <AnimatePresence mode="wait">
      <motion.div key={exercise.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
        <Card className="overflow-hidden">
          {exercise.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- served by our API with auth cookies
            <img src={exercise.imageUrl} alt="" className="-mx-6 -mt-6 mb-5 aspect-video w-[calc(100%+3rem)] max-w-none object-cover" />
          )}
          <div className="flex items-start gap-4">
            <MuscleIconTile group={exercise.muscleGroup} />
            <div className="min-w-0">
              <h2 className="font-display text-2xl font-semibold">{exercise.name}</h2>
              <div className="mt-2">
                <ExerciseMeta exercise={exercise} />
              </div>
            </div>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-white/[0.04] p-3">
              <dt className="text-muted-foreground">Targets</dt>
              <dd className="mt-0.5 font-semibold">{muscleLabel(exercise.muscleGroup)}</dd>
            </div>
            <div className="rounded-2xl bg-white/[0.04] p-3">
              <dt className="text-muted-foreground">Equipment</dt>
              <dd className="mt-0.5 font-semibold">{equipmentLabel(exercise.equipment)}</dd>
            </div>
          </dl>
          <h3 className="mt-6 text-sm font-semibold">How to do it</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{exercise.instructions || "No instructions added for this exercise yet."}</p>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Explore the body, pick a muscle group, and see the exercises that train it.
 * Foundation for later steps: finer anatomy, demonstrations, and personal history per muscle.
 */
export default function MuscleExplorer() {
  const [side, setSide] = useState<BodySide>("front");
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const all = useExercises();
  const filtered = useExercises({ muscleGroup: group });
  const detailRef = useRef<HTMLDivElement>(null);

  const counts = Object.fromEntries(MUSCLE_GROUPS.map((m) => [m.value, (all.data ?? []).filter((e) => e.muscleGroup === m.value).length])) as Record<MuscleGroup, number>;
  const exercises = group ? (filtered.data ?? []).filter((e) => e.muscleGroup === group) : [];
  const selected = exercises.find((e) => e.id === exerciseId) ?? null;

  function chooseGroup(next: MuscleGroup) {
    setGroup(next);
    setExerciseId(null);
    // Picking a muscle that only exists on the other view (e.g. Glutes from a chip) flips the figure.
    if (!GROUPS_BY_SIDE[side].includes(next)) {
      const other: BodySide = side === "front" ? "back" : "front";
      if (GROUPS_BY_SIDE[other].includes(next)) setSide(other);
    }
  }

  // On phones the detail sits below the list; bring it into view when an exercise is picked.
  useEffect(() => {
    if (exerciseId && window.matchMedia("(max-width: 1023px)").matches) detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [exerciseId]);

  return (
    <>
      <PageHeader
        eyebrow="Explore"
        title={
          <>
            Muscle <span className="text-primary">explorer</span>
          </>
        }
        subtitle="Tap a muscle to see the exercises that train it. Switch between front and back."
        actions={
          <Link href="/muscle-intelligence" className={buttonClass({ variant: "outline" })}>
            Try the 3D view
          </Link>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="space-y-5 lg:sticky lg:top-28">
          <SideToggle side={side} onChange={setSide} />
          <BodyMap side={side} selected={group} onSelect={chooseGroup} counts={all.data ? counts : undefined} />
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Or choose a group</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Muscle groups">
              {MUSCLE_GROUPS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  aria-pressed={group === m.value}
                  onClick={() => chooseGroup(m.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
                    group === m.value ? "border-primary bg-primary text-white" : "border-white/10 bg-white/[0.04] text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m.label}
                  {all.data && <span className={cn("rounded-full px-1 text-[10px]", group === m.value ? "bg-white/20" : "bg-white/10")}>{counts[m.value]}</span>}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <section aria-live="polite">
          <h2 className="font-display mb-3 text-2xl font-semibold">{group ? muscleLabel(group) : "Exercises"}</h2>
          {!group ? (
            <Card className="text-sm text-muted-foreground">Pick a muscle on the body or from the list to see its exercises.</Card>
          ) : filtered.isPending ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-2xl" />
              ))}
            </div>
          ) : exercises.length === 0 ? (
            <EmptyState icon={SearchX} title="No exercises yet">
              There&apos;s nothing in the library for {muscleLabel(group).toLowerCase()} yet.
            </EmptyState>
          ) : (
            <ul className="space-y-2">
              {exercises.map((exercise, i) => (
                <motion.li key={exercise.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
                  <button
                    type="button"
                    aria-pressed={exercise.id === exerciseId}
                    onClick={() => setExerciseId(exercise.id)}
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition",
                      exercise.id === exerciseId ? "border-primary/50 bg-primary/10" : "border-white/10 bg-white/[0.03] hover:border-white/20",
                    )}
                  >
                    <MuscleIconTile group={exercise.muscleGroup} imageUrl={exercise.imageUrl} className="size-10" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{exercise.name}</span>
                      <span className="block text-sm text-muted-foreground">{equipmentLabel(exercise.equipment)}</span>
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5" aria-hidden />
                  </button>
                </motion.li>
              ))}
            </ul>
          )}
        </section>

        <section ref={detailRef} className="scroll-mt-28 lg:sticky lg:top-28">
          <h2 className="font-display mb-3 text-2xl font-semibold">Details</h2>
          <ExerciseDetail exercise={selected} />
        </section>
      </div>
    </>
  );
}

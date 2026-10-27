"use client";

import { useDeferredValue, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, Scan, SearchX } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/stat-card";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AddExerciseDialog } from "@/components/workouts/add-exercise-dialog";
import { ExerciseMeta, MuscleChips, MuscleIconTile, SearchBox } from "@/components/workouts/exercise-bits";
import { useSession } from "@/hooks/use-session";
import { useExercises } from "@/hooks/use-workouts";
import type { MuscleGroup } from "@/lib/types";

export default function ExerciseLibrary() {
  const { data: session } = useSession();
  const [q, setQ] = useState("");
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | null>(null);
  const [adding, setAdding] = useState(false);
  // Keeps typing smooth: the list catches up a beat after the keystroke.
  const deferredQ = useDeferredValue(q);
  const { data: exercises, isPending } = useExercises({ muscleGroup, q: deferredQ });

  return (
    <>
      <PageHeader
        eyebrow="Library"
        title={
          <>
            Exercise <span className="text-primary">library</span>
          </>
        }
        subtitle="The building blocks for every plan. Add your gym's own moves alongside the built-in ones."
        actions={
          <div className="flex flex-wrap gap-2">
            {session?.user.role === "TRAINER" && (
              <Link href="/muscle-explorer" className={buttonClass({ variant: "outline" })}>
                <Scan className="size-4" aria-hidden />
                Muscle explorer
              </Link>
            )}
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-4" aria-hidden />
              Add exercise
            </Button>
          </div>
        }
      />

      <div className="mb-8 space-y-4">
        <SearchBox value={q} onChange={setQ} placeholder="Search exercises" />
        <MuscleChips value={muscleGroup} onChange={setMuscleGroup} />
      </div>

      {!isPending && exercises?.length === 0 ? (
        <EmptyState icon={SearchX} title="No exercises found">
          Try a different search or muscle group, or add it as a new exercise.
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(exercises ?? []).map((exercise, i) => (
            <motion.div
              key={exercise.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.03 }}
            >
              <Card className="h-full overflow-hidden transition duration-300 hover:-translate-y-0.5 hover:border-white/20">
                {exercise.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- served by our API with auth cookies
                  <img src={exercise.imageUrl} alt="" loading="lazy" className="-mx-6 -mt-6 mb-5 aspect-video w-[calc(100%+3rem)] max-w-none object-cover" />
                )}
                <div className="flex items-start gap-4">
                  <MuscleIconTile group={exercise.muscleGroup} />
                  <div className="min-w-0 space-y-2">
                    <h2 className="text-base leading-snug font-semibold">{exercise.name}</h2>
                    <ExerciseMeta exercise={exercise} />
                  </div>
                </div>
                {exercise.instructions ? (
                  <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{exercise.instructions}</p>
                ) : null}
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <AddExerciseDialog open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

"use client";

import { useDeferredValue, useState } from "react";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ExerciseMeta, MuscleChips, MuscleIconTile, SearchBox } from "@/components/workouts/exercise-bits";
import { useExercises } from "@/hooks/use-workouts";
import type { Exercise, MuscleGroup } from "@/lib/types";
import { cn } from "@/lib/utils";

type ExercisePickerProps = {
  open: boolean;
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
  /** Exercise ids already in the day, shown as added. */
  pickedIds: Set<string>;
  dayName: string;
};

// Stays open so several exercises can be added in one go.
export function ExercisePicker({ open, onClose, onPick, pickedIds, dayName }: ExercisePickerProps) {
  const [q, setQ] = useState("");
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | null>(null);
  const deferredQ = useDeferredValue(q);
  const { data: exercises } = useExercises({ muscleGroup, q: deferredQ });

  return (
    <Dialog open={open} onClose={onClose} title={`Add to ${dayName || "this day"}`} description="Tap exercises to add them to this day. Tap one again to add it twice." className="max-w-2xl">
      <div className="space-y-4">
        <SearchBox value={q} onChange={setQ} placeholder="Search exercises" />
        <MuscleChips value={muscleGroup} onChange={setMuscleGroup} />
        <ul className="-mx-2 max-h-[45vh] space-y-1 overflow-y-auto px-2">
          {(exercises ?? []).map((exercise) => {
            const picked = pickedIds.has(exercise.id);
            return (
              <li key={exercise.id}>
                <button
                  type="button"
                  onClick={() => onPick(exercise)}
                  className={cn(
                    "flex w-full items-center gap-4 rounded-2xl border px-3 py-3 text-left transition duration-200",
                    picked ? "border-primary/40 bg-primary/10" : "border-transparent hover:bg-white/[0.05]",
                  )}
                >
                  <MuscleIconTile group={exercise.muscleGroup} imageUrl={exercise.imageUrl} className="size-10" />
                  <span className="min-w-0 flex-1 space-y-1.5">
                    <span className="block truncate font-medium">{exercise.name}</span>
                    <ExerciseMeta exercise={exercise} />
                  </span>
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-full transition",
                      picked ? "bg-primary text-white" : "bg-white/10 text-muted-foreground",
                    )}
                    aria-hidden
                  >
                    {picked ? <Check className="size-4" /> : <Plus className="size-4" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-end border-t border-white/10 pt-4">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Dialog>
  );
}

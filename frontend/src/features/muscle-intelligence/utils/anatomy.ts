import type { Exercise, MovementPattern } from "@/lib/types";
import { MUSCLES } from "../anatomy/muscles";
import type { Muscle, MuscleId } from "../types";

const BY_ID = new Map<string, Muscle>(MUSCLES.map((m) => [m.id, m]));

export const isMuscleId = (id: string): id is MuscleId => BY_ID.has(id);
export const getMuscle = (id: string): Muscle | undefined => BY_ID.get(id);

/** Lookup from 3D mesh name to muscle, built from the catalog, never from mesh order. */
export function buildMeshIndex(muscles: readonly Muscle[] = MUSCLES): Map<string, MuscleId> {
  const index = new Map<string, MuscleId>();
  for (const muscle of muscles) {
    for (const mesh of muscle.meshNames) {
      const owner = index.get(mesh);
      if (owner && owner !== muscle.id) throw new Error(`Mesh "${mesh}" is mapped to both ${owner} and ${muscle.id}`);
      index.set(mesh, muscle.id);
    }
  }
  return index;
}

export type Involvement = "primary" | "secondary";

/** How an exercise uses a muscle, or null if it doesn't. */
export function involvement(exercise: Pick<Exercise, "primaryMuscles" | "secondaryMuscles">, muscle: string): Involvement | null {
  if (exercise.primaryMuscles.includes(muscle)) return "primary";
  if (exercise.secondaryMuscles.includes(muscle)) return "secondary";
  return null;
}

/** Exercises that train a muscle, prime movers first, then by name. */
export function exercisesForMuscle<E extends Pick<Exercise, "name" | "primaryMuscles" | "secondaryMuscles">>(
  exercises: readonly E[],
  muscle: string,
): { exercise: E; role: Involvement }[] {
  return exercises
    .map((exercise) => ({ exercise, role: involvement(exercise, muscle) }))
    .filter((x): x is { exercise: E; role: Involvement } => x.role !== null)
    .sort((a, b) => (a.role === b.role ? a.exercise.name.localeCompare(b.exercise.name) : a.role === "primary" ? -1 : 1));
}

/** Highlight state for every muscle while an exercise is selected; primary wins over secondary. */
export function highlightMap(exercise: Pick<Exercise, "primaryMuscles" | "secondaryMuscles"> | null): Map<MuscleId, Involvement> {
  const map = new Map<MuscleId, Involvement>();
  if (!exercise) return map;
  for (const id of exercise.secondaryMuscles) if (isMuscleId(id)) map.set(id, "secondary");
  for (const id of exercise.primaryMuscles) if (isMuscleId(id)) map.set(id, "primary");
  return map;
}

/** Muscles that most often work alongside this one across the given exercises. */
export function relatedMuscles(exercises: readonly Pick<Exercise, "primaryMuscles" | "secondaryMuscles">[], muscle: string, limit = 4): Muscle[] {
  const counts = new Map<string, number>();
  for (const e of exercises) {
    if (!involvement(e, muscle)) continue;
    for (const other of [...e.primaryMuscles, ...e.secondaryMuscles]) if (other !== muscle) counts.set(other, (counts.get(other) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id]) => getMuscle(id))
    .filter((m): m is Muscle => !!m)
    .slice(0, limit);
}

/** Distinct movement patterns that train a muscle, for the info panel. */
export function movementPatternsFor(exercises: readonly Pick<Exercise, "movementPattern" | "primaryMuscles" | "secondaryMuscles">[], muscle: string): MovementPattern[] {
  return [...new Set(exercises.filter((e) => involvement(e, muscle) && e.movementPattern).map((e) => e.movementPattern!))];
}

export const MOVEMENT_LABELS: Record<MovementPattern, string> = {
  HORIZONTAL_PUSH: "Horizontal push",
  VERTICAL_PUSH: "Vertical push",
  HORIZONTAL_PULL: "Horizontal pull",
  VERTICAL_PULL: "Vertical pull",
  SQUAT: "Squat",
  HINGE: "Hinge",
  LUNGE: "Lunge",
  ISOLATION: "Isolation",
  CORE: "Core",
  FULL_BODY: "Full body",
  CARDIO: "Cardio",
};

/** Case-insensitive search over common and scientific names, for the text muscle list. */
export function searchMuscles(query: string, muscles: readonly Muscle[] = MUSCLES): Muscle[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...muscles];
  return muscles.filter((m) => m.name.toLowerCase().includes(q) || m.scientificName.toLowerCase().includes(q) || m.id.includes(q));
}

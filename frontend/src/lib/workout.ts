import { Activity, Dumbbell, Footprints, HeartPulse, Target, Zap, type LucideIcon } from "lucide-react";
import type { Equipment, MuscleGroup } from "./types";

export const MUSCLE_GROUPS: { value: MuscleGroup; label: string; icon: LucideIcon }[] = [
  { value: "CHEST", label: "Chest", icon: Dumbbell },
  { value: "BACK", label: "Back", icon: Dumbbell },
  { value: "SHOULDERS", label: "Shoulders", icon: Dumbbell },
  { value: "BICEPS", label: "Biceps", icon: Dumbbell },
  { value: "TRICEPS", label: "Triceps", icon: Dumbbell },
  { value: "LEGS", label: "Legs", icon: Footprints },
  { value: "GLUTES", label: "Glutes", icon: Activity },
  { value: "CORE", label: "Core", icon: Target },
  { value: "FULL_BODY", label: "Full body", icon: Zap },
  { value: "CARDIO", label: "Cardio", icon: HeartPulse },
];

export const EQUIPMENT: { value: Equipment; label: string }[] = [
  { value: "BARBELL", label: "Barbell" },
  { value: "DUMBBELL", label: "Dumbbell" },
  { value: "MACHINE", label: "Machine" },
  { value: "CABLE", label: "Cable" },
  { value: "KETTLEBELL", label: "Kettlebell" },
  { value: "BODYWEIGHT", label: "Bodyweight" },
  { value: "BAND", label: "Band" },
  { value: "OTHER", label: "Other" },
];

const muscleByValue = Object.fromEntries(MUSCLE_GROUPS.map((m) => [m.value, m]));
const equipmentByValue = Object.fromEntries(EQUIPMENT.map((e) => [e.value, e]));

export const muscleLabel = (value: MuscleGroup) => muscleByValue[value]?.label ?? value;
export const MUSCLE_ICONS = Object.fromEntries(MUSCLE_GROUPS.map((m) => [m.value, m.icon])) as Record<
  MuscleGroup,
  LucideIcon
>;
export const equipmentLabel = (value: Equipment) => equipmentByValue[value]?.label ?? value;

// Rough session length: about 40 seconds of work per set plus the programmed rest.
const WORK_SECONDS_PER_SET = 40;

export function estimateMinutes(day: { exercises: { sets: number; restSeconds: number }[] }) {
  const seconds = day.exercises.reduce((sum, e) => sum + e.sets * (WORK_SECONDS_PER_SET + e.restSeconds), 0);
  return Math.max(5, Math.round(seconds / 60 / 5) * 5);
}

export const formatRest = (seconds: number) =>
  seconds >= 60 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} min` : `${seconds}s`;

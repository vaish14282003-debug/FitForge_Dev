"use client";

import { Search } from "lucide-react";
import type { Exercise, MuscleGroup } from "@/lib/types";
import { MUSCLE_GROUPS, MUSCLE_ICONS, equipmentLabel, muscleLabel } from "@/lib/workout";
import { cn } from "@/lib/utils";

export function MuscleIconTile({ group, className }: { group: MuscleGroup; className?: string }) {
  const Icon = MUSCLE_ICONS[group];
  return (
    <span
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-accent-text ring-1 ring-primary/20",
        className,
      )}
    >
      <Icon className="size-5" aria-hidden />
    </span>
  );
}

export function Tag({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "red" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone === "red" ? "bg-primary/15 text-accent-text" : "bg-white/[0.06] text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function ExerciseMeta({ exercise }: { exercise: Exercise }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      <Tag tone="red">{muscleLabel(exercise.muscleGroup)}</Tag>
      <Tag>{equipmentLabel(exercise.equipment)}</Tag>
      {exercise.isCustom && <Tag>Custom</Tag>}
    </span>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block">
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-full border border-white/10 bg-white/[0.04] pr-4 pl-11 text-[15px] transition placeholder:text-muted-foreground/70 hover:border-white/20 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:outline-none"
      />
    </label>
  );
}

export function MuscleChips({ value, onChange }: { value: MuscleGroup | null; onChange: (v: MuscleGroup | null) => void }) {
  const chips: { value: MuscleGroup | null; label: string }[] = [{ value: null, label: "All" }, ...MUSCLE_GROUPS];
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filter by muscle group">
      {chips.map((chip) => {
        const active = chip.value === value;
        return (
          <button
            key={chip.label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(chip.value)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition duration-200",
              active
                ? "border-primary bg-primary text-white shadow-[0_6px_20px_-8px_var(--primary)]"
                : "border-white/10 bg-white/[0.04] text-muted-foreground hover:border-white/20 hover:text-foreground",
            )}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}

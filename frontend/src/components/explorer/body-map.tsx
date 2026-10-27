"use client";

import type { MuscleGroup } from "@/lib/types";
import { cn } from "@/lib/utils";

export type BodySide = "front" | "back";

type Shape =
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { kind: "path"; d: string };

/** One clickable area. Several shapes (left and right sides) share a region. */
type Region = { id: string; group: MuscleGroup; label: string; shapes: Shape[] };

const pair = (cx: number, cy: number, rx: number, ry: number, gap: number): Shape[] => [
  { kind: "ellipse", cx: cx - gap, cy, rx, ry },
  { kind: "ellipse", cx: cx + gap, cy, rx, ry },
];

// A simplified, original figure on a 200 × 440 grid. Regions map to the exercise library's
// muscle groups; finer anatomy (e.g. quads vs hamstrings) can be split out later.
const REGIONS: Record<BodySide, Region[]> = {
  front: [
    { id: "front-shoulders", group: "SHOULDERS", label: "Shoulders (front delts)", shapes: pair(100, 92, 15, 13, 39) },
    { id: "chest", group: "CHEST", label: "Chest (pectorals)", shapes: pair(100, 112, 18, 14, 18) },
    { id: "biceps", group: "BICEPS", label: "Biceps", shapes: pair(100, 136, 9, 20, 51) },
    {
      id: "core",
      group: "CORE",
      label: "Core (abs and obliques)",
      shapes: [{ kind: "path", d: "M84 130 Q100 126 116 130 L118 186 Q100 194 82 186 Z" }, ...pair(100, 160, 6, 22, 25)],
    },
    { id: "quads", group: "LEGS", label: "Legs (quads)", shapes: pair(100, 262, 15, 42, 15) },
    { id: "front-calves", group: "LEGS", label: "Legs (shins and calves)", shapes: pair(100, 348, 10, 30, 14) },
  ],
  back: [
    { id: "rear-shoulders", group: "SHOULDERS", label: "Shoulders (rear delts)", shapes: pair(100, 92, 15, 13, 39) },
    {
      id: "upper-back",
      group: "BACK",
      label: "Back (traps, lats and lower back)",
      shapes: [
        { kind: "path", d: "M100 76 L124 90 L114 120 L100 126 L86 120 L76 90 Z" },
        ...pair(100, 142, 13, 28, 20),
        { kind: "path", d: "M88 168 L112 168 L114 194 L86 194 Z" },
      ],
    },
    { id: "triceps", group: "TRICEPS", label: "Triceps", shapes: pair(100, 136, 9, 20, 51) },
    { id: "glutes", group: "GLUTES", label: "Glutes", shapes: pair(100, 214, 16, 15, 13) },
    { id: "hamstrings", group: "LEGS", label: "Legs (hamstrings)", shapes: pair(100, 270, 14, 38, 15) },
    { id: "back-calves", group: "LEGS", label: "Legs (calves)", shapes: pair(100, 348, 11, 30, 14) },
  ],
};

// The silhouette behind the muscles: head, neck, torso, arms and legs.
function Silhouette() {
  return (
    <g className="fill-white/[0.06] stroke-white/10" strokeWidth={1}>
      <circle cx={100} cy={36} r={20} />
      <rect x={91} y={54} width={18} height={18} rx={6} />
      <path d="M62 82 Q100 70 138 82 L146 120 L130 200 Q100 214 70 200 L54 120 Z" />
      <path d="M46 92 Q38 150 40 210 L52 212 Q56 160 62 110 Z" />
      <path d="M154 92 Q162 150 160 210 L148 212 Q144 160 138 110 Z" />
      <path d="M70 200 Q66 300 72 400 L96 402 L100 224 Z" />
      <path d="M130 200 Q134 300 128 400 L104 402 L100 224 Z" />
      <ellipse cx={44} cy={182} rx={8} ry={22} />
      <ellipse cx={156} cy={182} rx={8} ry={22} />
      <ellipse cx={84} cy={410} rx={12} ry={6} />
      <ellipse cx={116} cy={410} rx={12} ry={6} />
    </g>
  );
}

function ShapeEl({ shape }: { shape: Shape }) {
  return shape.kind === "ellipse" ? <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} /> : <path d={shape.d} />;
}

type BodyMapProps = {
  side: BodySide;
  selected: MuscleGroup | null;
  onSelect: (group: MuscleGroup) => void;
  /** Exercises per group, shown in each region's tooltip. */
  counts?: Partial<Record<MuscleGroup, number>>;
};

/** Front or back figure with selectable muscle regions. Each region is a keyboard-reachable button. */
export function BodyMap({ side, selected, onSelect, counts }: BodyMapProps) {
  return (
    <svg viewBox="0 0 200 440" className="mx-auto h-auto w-full max-w-[260px]" role="group" aria-label={`${side === "front" ? "Front" : "Back"} of the body`}>
      <Silhouette />
      {REGIONS[side].map((region) => {
        const active = selected === region.group;
        const count = counts?.[region.group];
        const name = `${region.label}${count !== undefined ? `, ${count} exercise${count === 1 ? "" : "s"}` : ""}`;
        return (
          <g
            key={region.id}
            role="button"
            tabIndex={0}
            aria-pressed={active}
            aria-label={name}
            onClick={() => onSelect(region.group)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(region.group);
              }
            }}
            className={cn(
              "cursor-pointer outline-none transition-[fill,stroke] duration-200",
              active ? "fill-primary stroke-white/70" : "fill-white/[0.14] stroke-white/20 hover:fill-primary/50 focus-visible:fill-primary/50",
            )}
            strokeWidth={active ? 1.5 : 1}
          >
            <title>{name}</title>
            {region.shapes.map((shape, i) => (
              <ShapeEl key={i} shape={shape} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

/** Groups with a place on each side of the body, for "switch sides" hints. */
export const GROUPS_BY_SIDE: Record<BodySide, MuscleGroup[]> = {
  front: [...new Set(REGIONS.front.map((r) => r.group))],
  back: [...new Set(REGIONS.back.map((r) => r.group))],
};

"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { useProgress } from "@react-three/drei";
import Link from "next/link";
import { motion } from "framer-motion";
import { Box, Info, Maximize2, RotateCcw, Search, TriangleAlert, X } from "lucide-react";
import { PageHeader } from "@/components/stat-card";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MuscleIconTile } from "@/components/workouts/exercise-bits";
import { useExercises } from "@/hooks/use-workouts";
import type { Exercise } from "@/lib/types";
import { cn } from "@/lib/utils";
import { equipmentLabel } from "@/lib/workout";
import { REGION_LABELS, UNMODELED_MUSCLES } from "../anatomy/muscles";
import { VIEW_PRESETS, type ViewPreset } from "../anatomy/procedural-body";
import type { MuscleId } from "../types";
import { MOVEMENT_LABELS, exercisesForMuscle, getMuscle, highlightMap, movementPatternsFor, relatedMuscles, searchMuscles, type Involvement } from "../utils/anatomy";
import { STATE_COLORS } from "../utils/highlight";
import type { AnatomyCanvasHandle } from "./anatomy-canvas";
import { ViewportBoundary, supportsWebGL } from "./viewport-boundary";

// three.js only loads when this page opens, and never on the server.
const AnatomyCanvas = dynamic(() => import("./anatomy-canvas"), {
  ssr: false,
  loading: () => <ViewportMessage busy>Loading 3D model…</ViewportMessage>,
});

/** Download progress for the anatomy model, shown over the viewport until it's ready. */
function ModelLoading() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center" role="status" aria-label="Loading anatomy model">
      <div className="w-48 text-center">
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${Math.round(progress)}%` }} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Loading anatomy… {Math.round(progress)}%</p>
      </div>
    </div>
  );
}

function ViewportMessage({ children, busy }: { children: React.ReactNode; busy?: boolean }) {
  return (
    <div className="grid h-full place-items-center p-6 text-center text-sm text-muted-foreground" role="status">
      <div className="flex flex-col items-center gap-3">
        {busy && <span className="size-8 animate-spin rounded-full border-2 border-white/10 border-t-primary" aria-hidden />}
        {children}
      </div>
    </div>
  );
}

const subscribeMotion = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const useReducedMotion = () => useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);

const noopSubscribe = () => () => {};
let webglSupport: boolean | undefined;
// Cached: creating a WebGL context to probe support is not free.
const supportsWebGLOnce = () => (webglSupport ??= supportsWebGL());

const LEGEND: { state: keyof typeof STATE_COLORS; label: string }[] = [
  { state: "selected", label: "Selected muscle" },
  { state: "primary", label: "Primary (prime mover)" },
  { state: "secondary", label: "Secondary (assists)" },
  { state: "default", label: "Not involved" },
];

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-label="Colour legend">
      {LEGEND.map(({ state, label }) => (
        <li key={state} className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-full ring-1 ring-white/20" style={{ background: STATE_COLORS[state].color }} aria-hidden />
          {label}
        </li>
      ))}
    </ul>
  );
}

function RoleTag({ role }: { role: Involvement }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", role === "primary" ? "bg-primary/15 text-accent-text" : "bg-amber-400/15 text-amber-300")}>
      {role === "primary" ? "Primary" : "Secondary"}
    </span>
  );
}

function MuscleChips({ ids, tone }: { ids: string[]; tone: Involvement }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {ids.map((id) => (
        <span key={id} className={cn("rounded-full px-2.5 py-0.5 text-xs", tone === "primary" ? "bg-primary/15 text-accent-text" : "bg-amber-400/15 text-amber-300")}>
          {getMuscle(id)?.name ?? id}
        </span>
      ))}
    </span>
  );
}

export default function MuscleIntelligence() {
  const [selected, setSelected] = useState<MuscleId | null>(null);
  const [hovered, setHovered] = useState<MuscleId | null>(null);
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewPreset>("default");
  const [variant, setVariant] = useState<"model" | "simple">("model");
  // Read once in the browser; null while rendering on the server.
  const webgl = useSyncExternalStore(noopSubscribe, supportsWebGLOnce, () => null);
  const reducedMotion = useReducedMotion();
  const canvas = useRef<AnatomyCanvasHandle>(null);
  const stage = useRef<HTMLDivElement>(null);
  const { data: exercises = [], isPending } = useExercises();

  // Only exercises with anatomy data take part; custom ones without it fall back to the library pages.
  const withAnatomy = useMemo(() => exercises.filter((e) => e.primaryMuscles?.length), [exercises]);
  const muscle = selected ? getMuscle(selected) : undefined;
  const related = useMemo(() => (selected ? exercisesForMuscle(withAnatomy, selected) : []), [withAnatomy, selected]);
  const exercise = withAnatomy.find((e) => e.id === exerciseId) ?? null;
  const exerciseHighlight = useMemo(() => highlightMap(exercise), [exercise]);
  const muscleList = useMemo(() => searchMuscles(query), [query]);

  function goTo(next: ViewPreset) {
    setView(next);
    canvas.current?.setView(next);
  }

  function selectMuscle(id: MuscleId | null) {
    setSelected(id);
    // Keep an exercise only if it still trains the newly selected muscle.
    if (id && exercise && !exercise.primaryMuscles.includes(id) && !exercise.secondaryMuscles.includes(id)) setExerciseId(null);
  }

  function selectExercise(e: Exercise) {
    setExerciseId(e.id === exerciseId ? null : e.id);
  }

  const viewport =
    webgl === null ? (
      <ViewportMessage busy>Checking 3D support…</ViewportMessage>
    ) : !webgl ? (
      <ViewportMessage>
        <TriangleAlert className="size-6 text-amber-300" aria-hidden />
        <span>This browser can&apos;t show 3D. Use the muscle list, or the 2D explorer.</span>
        <Link href="/muscle-explorer" className={buttonClass({ size: "sm", variant: "outline" })}>
          Open 2D explorer
        </Link>
      </ViewportMessage>
    ) : (
      <ViewportBoundary
        fallback={(retry) => (
          <ViewportMessage>
            <TriangleAlert className="size-6 text-amber-300" aria-hidden />
            <span>{variant === "model" ? "The anatomy model couldn't load." : "The 3D view stopped working."} The muscle list still works.</span>
            <span className="flex flex-wrap justify-center gap-2">
              <Button size="sm" variant="outline" onClick={retry}>
                Try again
              </Button>
              {variant === "model" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setVariant("simple");
                    retry();
                  }}
                >
                  Use the simplified figure
                </Button>
              )}
            </span>
          </ViewportMessage>
        )}
      >
        <AnatomyCanvas
          ref={canvas}
          variant={variant}
          selected={selected}
          hovered={hovered}
          exerciseHighlight={exerciseHighlight}
          onHover={setHovered}
          onSelect={selectMuscle}
          reducedMotion={reducedMotion}
        />
      </ViewportBoundary>
    );

  return (
    <>
      <PageHeader
        eyebrow="Explore"
        title={
          <>
            Muscle <span className="text-primary">Intelligence</span>
          </>
        }
        subtitle="Rotate the body, tap a muscle, and see which exercises train it as a prime mover or an assistant."
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="flex gap-1 rounded-full border border-white/10 bg-white/5 p-1" role="radiogroup" aria-label="Camera view">
                {(["front", "back", "side"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={view === v}
                    disabled={!webgl}
                    onClick={() => goTo(v)}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-sm font-medium transition disabled:opacity-40",
                      view === v ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {VIEW_PRESETS[v].label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" disabled={!webgl} onClick={() => goTo("default")} aria-label="Reset camera">
                  <RotateCcw className="size-4" aria-hidden />
                  Reset
                </Button>
                <Button size="sm" variant="ghost" disabled={!webgl} aria-label="Full screen" onClick={() => stage.current?.requestFullscreen?.()}>
                  <Maximize2 className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
            <motion.div
              ref={stage}
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="relative h-[480px] touch-pan-y bg-[radial-gradient(ellipse_at_50%_35%,#1d1210_0%,#0d0909_70%)] sm:h-[620px]"
            >
              {viewport}
              {webgl && variant === "model" && <ModelLoading />}
              <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2" aria-hidden>
                {hovered ? (
                  <span className="rounded-full bg-black/70 px-3 py-1 text-sm backdrop-blur">{getMuscle(hovered)?.name}</span>
                ) : (
                  <span />
                )}
                {muscle && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-black/70 px-3 py-1 text-sm backdrop-blur">
                    <span className="size-2 rounded-full bg-primary" />
                    {muscle.name}
                  </span>
                )}
              </div>
              {variant === "simple" && (
                <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-xs text-amber-300 backdrop-blur">
                  Simplified figure
                </span>
              )}
            </motion.div>
            <div className="space-y-2 border-t border-white/10 px-4 py-3">
              <Legend />
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                Drag to rotate, scroll or pinch to zoom, tap empty space to clear. Anatomy from BodyParts3D, © The Database Center for
                Life Science, CC BY 4.0, simplified for the web. For learning about training, not medical use.
              </p>
            </div>
          </Card>

          <Card>
            <label className="relative block">
              <span className="sr-only">Search muscles</span>
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search muscles, e.g. lats or gluteus"
                className="h-11 w-full rounded-full border border-white/10 bg-white/[0.04] pr-4 pl-10 text-sm placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:outline-none"
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Muscles">
              {muscleList.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={selected === m.id}
                  onClick={() => selectMuscle(selected === m.id ? null : m.id)}
                  onMouseEnter={() => setHovered(m.id)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(m.id)}
                  onBlur={() => setHovered(null)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition",
                    selected === m.id ? "border-primary bg-primary text-white" : "border-white/10 bg-white/[0.04] text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m.name}
                </button>
              ))}
              {muscleList.length === 0 && <p className="text-sm text-muted-foreground">No muscle matches “{query}”.</p>}
            </div>
          </Card>
        </div>

        <div className="space-y-4 xl:sticky xl:top-28">
          <Card aria-live="polite">
            {!muscle ? (
              <div className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/[0.06] text-muted-foreground">
                  <Box className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold">Pick a muscle</p>
                  <p className="mt-1 text-sm text-muted-foreground">Tap it on the model or choose it from the list to see what it does and how to train it.</p>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">{REGION_LABELS[muscle.region]}</p>
                    <h2 className="font-display text-3xl font-semibold">{muscle.name}</h2>
                    <p className="text-sm text-muted-foreground italic">{muscle.scientificName}</p>
                  </div>
                  <Button size="icon" variant="ghost" aria-label="Clear selected muscle" onClick={() => selectMuscle(null)}>
                    <X className="size-4" aria-hidden />
                  </Button>
                </div>
                <p className="mt-3 text-sm leading-relaxed">{muscle.description}</p>
                {UNMODELED_MUSCLES.includes(muscle.id) && (
                  <p className="mt-3 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                    The 3D model doesn&apos;t include this muscle, so it isn&apos;t highlighted on the body. Its exercises below are still accurate.
                  </p>
                )}
                {related.length > 0 && (
                  <dl className="mt-4 space-y-3 text-sm">
                    <div>
                      <dt className="mb-1.5 text-xs font-medium text-muted-foreground">Movement patterns</dt>
                      <dd className="flex flex-wrap gap-1.5">
                        {movementPatternsFor(withAnatomy, muscle.id).map((p) => (
                          <span key={p} className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs">
                            {MOVEMENT_LABELS[p]}
                          </span>
                        ))}
                      </dd>
                    </div>
                    <div>
                      <dt className="mb-1.5 text-xs font-medium text-muted-foreground">Often works with</dt>
                      <dd className="flex flex-wrap gap-1.5">
                        {relatedMuscles(withAnatomy, muscle.id).map((m) => (
                          <button key={m.id} type="button" onClick={() => selectMuscle(m.id)} className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs transition hover:bg-white/10">
                            {m.name}
                          </button>
                        ))}
                      </dd>
                    </div>
                  </dl>
                )}
              </div>
            )}
          </Card>

          {muscle && (
            <section>
              <h2 className="font-display mb-3 text-2xl font-semibold">Exercises</h2>
              {isPending ? (
                <Skeleton className="h-40 w-full rounded-3xl" />
              ) : related.length === 0 ? (
                <Card className="text-sm text-muted-foreground">No exercises in the library train this muscle yet.</Card>
              ) : (
                <ul className="space-y-2">
                  {related.map(({ exercise: e, role }) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        aria-pressed={e.id === exerciseId}
                        onClick={() => selectExercise(e)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition",
                          e.id === exerciseId ? "border-primary/50 bg-primary/10" : "border-white/10 bg-white/[0.03] hover:border-white/20",
                        )}
                      >
                        <MuscleIconTile group={e.muscleGroup} imageUrl={e.imageUrl} className="size-10" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{e.name}</span>
                          <span className="block text-sm text-muted-foreground">
                            {equipmentLabel(e.equipment)}
                            {e.movementPattern ? ` · ${MOVEMENT_LABELS[e.movementPattern]}` : ""}
                          </span>
                        </span>
                        <RoleTag role={role} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {exercise && (
            <Card>
              {exercise.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- served by our API with auth cookies
                <img src={exercise.imageUrl} alt="" className="-mx-6 -mt-6 mb-5 aspect-video w-[calc(100%+3rem)] max-w-none object-cover" />
              )}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-2xl font-semibold">{exercise.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {equipmentLabel(exercise.equipment)}
                    {exercise.movementPattern ? ` · ${MOVEMENT_LABELS[exercise.movementPattern]}` : ""}
                  </p>
                </div>
                <Button size="icon" variant="ghost" aria-label="Close exercise" onClick={() => setExerciseId(null)}>
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Primary muscles</p>
                  <MuscleChips ids={exercise.primaryMuscles} tone="primary" />
                </div>
                {exercise.secondaryMuscles.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">Secondary muscles</p>
                    <MuscleChips ids={exercise.secondaryMuscles} tone="secondary" />
                  </div>
                )}
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">How to do it</p>
                  <p className="leading-relaxed">{exercise.instructions || "No instructions added for this exercise yet."}</p>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">The model now shows this exercise: red for prime movers, amber for assisting muscles.</p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

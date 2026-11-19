"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Clock, Flag, Minus, Plus, Trash2 } from "lucide-react";
import { FormError } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { MuscleIconTile } from "@/components/workouts/exercise-bits";
import { RestTimer } from "@/components/workouts/rest-timer";
import { WorkoutComplete, WorkoutSavedOffline } from "@/components/workouts/workout-complete";
import { useSession } from "@/hooks/use-session";
import { useLogSession, usePreviousSets } from "@/hooks/use-sessions";
import { enqueueWorkout, isOfflineError } from "@/lib/offline";
import type { PlanDay, WorkoutPlan, WorkoutSession } from "@/lib/types";
import { cn, uuid } from "@/lib/utils";
import { formatRest } from "@/lib/workout";

type DraftSet = { weight: string; reps: string; done: boolean };
// clientId stays with the workout from the start, so every upload attempt uses the same one.
type Draft = { clientId: string; startedAt: string; notes: string; entries: { exerciseId: string; sets: DraftSet[] }[] };

const storageKey = (planId: string, dayIndex: number) => `ff-workout:${planId}:${dayIndex}`;

// Pre-fills each set from the plan: the lower end of a rep range and the programmed weight.
function freshDraft(day: PlanDay): Draft {
  return {
    clientId: uuid(),
    startedAt: new Date().toISOString(),
    notes: "",
    entries: day.exercises.map((e) => ({
      exerciseId: e.exercise.id,
      sets: Array.from({ length: e.sets }, () => ({
        weight: e.weight == null ? "" : String(e.weight),
        reps: e.reps.split("-")[0],
        done: false,
      })),
    })),
  };
}

// A saved draft is only reused if it still matches the plan's exercises.
function loadDraft(planId: string, dayIndex: number, day: PlanDay): Draft {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(planId, dayIndex)) ?? "null") as Draft | null;
    const sameExercises =
      saved?.entries.length === day.exercises.length &&
      saved.entries.every((entry, i) => entry.exerciseId === day.exercises[i].exercise.id);
    // Drafts saved before offline sync existed get their id now.
    if (saved && sameExercises) return { ...saved, clientId: saved.clientId ?? uuid() };
  } catch {
    // Storage unavailable or corrupt: start fresh.
  }
  return freshDraft(day);
}

function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const seconds = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return (
    <span className="tabular-nums">
      {h > 0 ? `${h}:${String(m).padStart(2, "0")}` : m}:{String(s).padStart(2, "0")}
    </span>
  );
}

const fieldClass =
  "h-11 w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.05] px-2 text-center text-base font-semibold tabular-nums transition " +
  "hover:border-white/20 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:outline-none";

export function WorkoutLogger({ plan, dayIndex }: { plan: WorkoutPlan; dayIndex: number }) {
  const router = useRouter();
  const toast = useToast();
  const day = plan.days[dayIndex];
  const [draft, setDraft] = useState<Draft>(() => loadDraft(plan.id, dayIndex, day));
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [saved, setSaved] = useState<WorkoutSession | null>(null);
  const [savedOffline, setSavedOffline] = useState(false);
  const { data: session } = useSession();
  const logSession = useLogSession();
  const previous = usePreviousSets(day.exercises.map((e) => e.exercise.id));

  // Keep progress across refreshes and accidental navigation.
  useEffect(() => {
    if (saved) return;
    try {
      localStorage.setItem(storageKey(plan.id, dayIndex), JSON.stringify(draft));
    } catch {
      // Storage full or blocked; the workout still works in memory.
    }
  }, [draft, plan.id, dayIndex, saved]);

  const totals = useMemo(() => {
    const all = draft.entries.flatMap((e) => e.sets);
    return { done: all.filter((s) => s.done).length, total: all.length };
  }, [draft]);

  const updateSet = (ei: number, si: number, patch: Partial<DraftSet>) =>
    setDraft((d) => ({
      ...d,
      entries: d.entries.map((entry, i) =>
        i === ei ? { ...entry, sets: entry.sets.map((set, j) => (j === si ? { ...set, ...patch } : set)) } : entry,
      ),
    }));

  function toggleDone(ei: number, si: number) {
    const set = draft.entries[ei].sets[si];
    updateSet(ei, si, { done: !set.done });
    if (!set.done) {
      const seconds = day.exercises[ei].restSeconds;
      if (seconds > 0) setRest({ endsAt: Date.now() + seconds * 1000, total: seconds });
      navigator.vibrate?.(30);
    }
  }

  function changeSetCount(ei: number, delta: 1 | -1) {
    setDraft((d) => ({
      ...d,
      entries: d.entries.map((entry, i) => {
        if (i !== ei) return entry;
        if (delta === -1) return entry.sets.length > 1 ? { ...entry, sets: entry.sets.slice(0, -1) } : entry;
        const last = entry.sets[entry.sets.length - 1];
        return { ...entry, sets: [...entry.sets, { weight: last?.weight ?? "", reps: last?.reps ?? "", done: false }] };
      }),
    }));
  }

  const skipRest = useCallback(() => setRest(null), []);

  function clearDraft() {
    try {
      localStorage.removeItem(storageKey(plan.id, dayIndex));
    } catch {
      // Nothing to clean up.
    }
  }

  function finish() {
    const body = {
      planId: plan.id,
      dayIndex,
      clientId: draft.clientId,
      startedAt: draft.startedAt,
      completedAt: new Date().toISOString(),
      notes: draft.notes.trim(),
        entries: draft.entries.map((entry) => ({
          exercise: entry.exerciseId,
          sets: entry.sets.map((s) => ({
            reps: Math.max(0, Math.round(Number(s.reps) || 0)),
            weight: s.weight.trim() === "" ? null : Math.max(0, Number(s.weight) || 0),
            done: s.done,
          })),
        })),
    };
    const done = () => {
      clearDraft();
      setFinishing(false);
      setRest(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    logSession.mutate(body, {
      onSuccess: (result) => {
        done();
        setSaved(result);
      },
      onError: (err) => {
        // No signal: keep it on this phone and upload it later (see OfflineSync).
        if (!isOfflineError(err) || !session) return;
        enqueueWorkout({
          id: body.clientId,
          userId: session.user.id,
          body,
          label: `${plan.name} · ${day.name}`,
          queuedAt: new Date().toISOString(),
        });
        logSession.reset();
        done();
        setSavedOffline(true);
      },
    });
  }

  function discard() {
    try {
      localStorage.removeItem(storageKey(plan.id, dayIndex));
    } catch {
      // Nothing to clean up.
    }
    toast({ title: "Workout discarded" });
    router.replace("/workouts");
  }

  if (saved) return <WorkoutComplete session={saved} />;
  if (savedOffline) return <WorkoutSavedOffline />;

  const progress = totals.total ? totals.done / totals.total : 0;

  return (
    <>
      <div className="sticky top-20 z-30 -mx-1 mb-6 rounded-3xl border border-white/10 bg-[#0d0808]/85 p-4 backdrop-blur-xl sm:top-24 sm:p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-muted-foreground">
              {plan.name} · Day {dayIndex + 1}
            </p>
            <h1 className="font-display truncate text-2xl font-semibold sm:text-3xl">{day.name}</h1>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3 py-2 text-sm font-semibold">
            <Clock className="size-4 text-accent-text" aria-hidden />
            <Elapsed since={draft.startedAt} />
          </span>
          <Button onClick={() => setFinishing(true)} disabled={totals.done === 0}>
            <Flag className="size-4" aria-hidden />
            Finish
          </Button>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={totals.done} aria-valuemax={totals.total} aria-label="Sets completed">
            <motion.div
              className="h-full rounded-full bg-linear-to-r from-primary to-[#ff7a4d]"
              animate={{ width: `${progress * 100}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
          <span className="text-sm font-medium text-muted-foreground tabular-nums">
            {totals.done}/{totals.total} sets
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {day.exercises.map((planned, ei) => {
          const entry = draft.entries[ei];
          const last = previous.data?.[planned.exercise.id]?.sets;
          const allDone = entry.sets.every((s) => s.done);
          return (
            <motion.section
              key={planned.exercise.id + ei}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ei * 0.05 }}
              className={cn(
                "rounded-3xl border bg-white/[0.03] p-4 backdrop-blur-xl transition-colors sm:p-5",
                allDone ? "border-emerald-500/30" : "border-white/10",
              )}
            >
              <div className="flex items-start gap-3">
                <MuscleIconTile group={planned.exercise.muscleGroup} imageUrl={planned.exercise.imageUrl} />
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{planned.exercise.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    Target {planned.sets} × {planned.reps}
                    {planned.weight != null ? ` @ ${planned.weight} kg` : ""} · {formatRest(planned.restSeconds)} rest
                  </p>
                  {planned.notes ? <p className="mt-1 text-sm text-accent-text">{planned.notes}</p> : null}
                </div>
                {allDone && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="grid size-8 place-items-center rounded-full bg-emerald-500/20 text-emerald-400"
                    aria-label="Exercise complete"
                  >
                    <Check className="size-4" aria-hidden />
                  </motion.span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_2.75rem] sm:grid-cols-[2.5rem_minmax(0,1fr)_7rem_7rem_3rem] items-center gap-2 px-1 text-xs font-medium text-muted-foreground  sm:gap-3">
                <span>Set</span>
                <span>Last time</span>
                <span className="text-center">kg</span>
                <span className="text-center">Reps</span>
                <span className="sr-only">Done</span>
              </div>
              <ul className="mt-2 space-y-2">
                <AnimatePresence initial={false}>
                  {entry.sets.map((set, si) => {
                    const prev = last?.[si];
                    return (
                      <motion.li
                        key={si}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className={cn(
                          "grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_2.75rem] sm:grid-cols-[2.5rem_minmax(0,1fr)_7rem_7rem_3rem] items-center gap-2 rounded-2xl px-1 py-1 transition-colors  sm:gap-3",
                          set.done && "bg-primary/10",
                        )}
                      >
                        <span className="font-display text-center text-lg font-semibold text-muted-foreground">{si + 1}</span>
                        <button
                          type="button"
                          disabled={!prev}
                          onClick={() =>
                            prev && updateSet(ei, si, { weight: prev.weight == null ? "" : String(prev.weight), reps: String(prev.reps) })
                          }
                          title={prev ? "Use last time's numbers" : undefined}
                          className="truncate rounded-lg px-1 py-2 text-left text-sm text-muted-foreground transition enabled:hover:text-foreground disabled:opacity-50"
                        >
                          {prev ? (prev.weight ? `${prev.weight} × ${prev.reps}` : `${prev.reps} reps`) : "–"}
                        </button>
                        <input
                          value={set.weight}
                          onChange={(e) => updateSet(ei, si, { weight: e.target.value })}
                          inputMode="decimal"
                          placeholder="–"
                          aria-label={`Set ${si + 1} weight in kg`}
                          className={fieldClass}
                        />
                        <input
                          value={set.reps}
                          onChange={(e) => updateSet(ei, si, { reps: e.target.value })}
                          inputMode="numeric"
                          aria-label={`Set ${si + 1} reps`}
                          className={fieldClass}
                        />
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.85 }}
                          onClick={() => toggleDone(ei, si)}
                          aria-pressed={set.done}
                          aria-label={`Mark set ${si + 1} ${set.done ? "not done" : "done"}`}
                          className={cn(
                            "grid size-11 place-items-center rounded-xl border transition-colors",
                            set.done
                              ? "border-primary bg-primary text-white shadow-[0_6px_20px_-8px_var(--primary)]"
                              : "border-white/15 text-muted-foreground hover:border-white/30 hover:text-foreground",
                          )}
                        >
                          <Check className="size-5" aria-hidden />
                        </motion.button>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
              <div className="mt-3 flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => changeSetCount(ei, 1)}>
                  <Plus className="size-4" aria-hidden />
                  Add set
                </Button>
                {entry.sets.length > 1 && (
                  <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => changeSetCount(ei, -1)}>
                    <Minus className="size-4" aria-hidden />
                    Remove set
                  </Button>
                )}
              </div>
            </motion.section>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          className={confirmDiscard ? "text-accent-text" : "text-muted-foreground"}
          onClick={() => {
            if (confirmDiscard) return discard();
            setConfirmDiscard(true);
            setTimeout(() => setConfirmDiscard(false), 4000);
          }}
        >
          <Trash2 className="size-4" aria-hidden />
          {confirmDiscard ? "Tap again to discard" : "Discard workout"}
        </Button>
        <Button size="lg" onClick={() => setFinishing(true)} disabled={totals.done === 0}>
          <Flag className="size-4" aria-hidden />
          Finish workout
        </Button>
      </div>

      <RestTimer
        endsAt={rest?.endsAt ?? null}
        total={rest?.total ?? 0}
        onAdd={(s) => setRest((r) => (r ? { endsAt: r.endsAt + s * 1000, total: r.total + s } : r))}
        onSkip={skipRest}
      />

      <Dialog
        open={finishing}
        onClose={() => setFinishing(false)}
        title="Finish workout?"
        description={
          totals.done < totals.total
            ? `${totals.total - totals.done} of ${totals.total} sets aren't ticked off. Only completed sets are saved.`
            : "Every set is done. Nice."
        }
      >
        <div className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-medium">How did it feel? (optional)</span>
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              rows={3}
              maxLength={500}
              placeholder="e.g. Shoulder felt tight on the last set"
              className="w-full rounded-xl border border-border bg-white/[0.04] px-4 py-3 text-[15px] transition placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:outline-none"
            />
          </label>
          <FormError message={logSession.error?.message} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setFinishing(false)}>
              Keep going
            </Button>
            <Button loading={logSession.isPending} onClick={finish}>
              Save workout
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, Reorder, motion, useDragControls } from "framer-motion";
import { Check, Clock, Dumbbell, GripVertical, Layers, Plus, Trash2, Users, X } from "lucide-react";
import { FormError } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { ExercisePicker } from "@/components/workouts/exercise-picker";
import { MuscleIconTile, Tag } from "@/components/workouts/exercise-bits";
import { useClients, useUsers } from "@/hooks/use-gym";
import { useSession } from "@/hooks/use-session";
import { useDeletePlan, useSavePlan } from "@/hooks/use-workouts";
import { can } from "@/lib/access";
import type { Exercise, PlanInput, WorkoutPlan } from "@/lib/types";
import { cn } from "@/lib/utils";
import { equipmentLabel, estimateMinutes, muscleLabel } from "@/lib/workout";

// Form state keeps numbers as strings so fields can be cleared while typing.
type DraftExercise = {
  key: string;
  exercise: Exercise;
  sets: string;
  reps: string;
  weight: string;
  restSeconds: string;
  notes: string;
};
type DraftDay = { key: string; name: string; exercises: DraftExercise[] };
type Draft = { name: string; description: string; days: DraftDay[] };

let keySeq = 0;
const newKey = () => `k${++keySeq}`;

const MAX_DAYS = 7;
const DEFAULT_DAY_NAMES = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"];

function toDraft(plan?: WorkoutPlan): Draft {
  if (!plan) return { name: "", description: "", days: [{ key: newKey(), name: "Day 1", exercises: [] }] };
  return {
    name: plan.name,
    description: plan.description,
    days: plan.days.map((day) => ({
      key: newKey(),
      name: day.name,
      exercises: day.exercises.map((e) => ({
        key: newKey(),
        exercise: e.exercise,
        sets: String(e.sets),
        reps: e.reps,
        weight: e.weight == null ? "" : String(e.weight),
        restSeconds: String(e.restSeconds),
        notes: e.notes,
      })),
    })),
  };
}

// Returns the first problem in plain words, or the API body when the plan is ready to save.
function toInput(draft: Draft): { error: string } | { body: PlanInput } {
  if (draft.name.trim().length < 2) return { error: "Give the plan a name." };
  for (const day of draft.days) {
    if (!day.name.trim()) return { error: "Every day needs a name." };
    if (day.exercises.length === 0) return { error: `Add at least one exercise to ${day.name}.` };
    for (const e of day.exercises) {
      const sets = Number(e.sets);
      if (!Number.isInteger(sets) || sets < 1 || sets > 10) return { error: `${e.exercise.name}: sets must be 1–10.` };
      if (!/^\d{1,3}(-\d{1,3})?$/.test(e.reps.trim())) return { error: `${e.exercise.name}: reps should look like 10 or 8-12.` };
      if (e.weight.trim() && !(Number(e.weight) >= 0)) return { error: `${e.exercise.name}: weight must be a number.` };
      const rest = Number(e.restSeconds);
      if (!Number.isInteger(rest) || rest < 0 || rest > 600) return { error: `${e.exercise.name}: rest must be 0–600 seconds.` };
    }
  }
  return {
    body: {
      name: draft.name.trim(),
      description: draft.description.trim(),
      days: draft.days.map((day) => ({
        name: day.name.trim(),
        exercises: day.exercises.map((e) => ({
          exercise: e.exercise.id,
          sets: Number(e.sets),
          reps: e.reps.trim(),
          weight: e.weight.trim() ? Number(e.weight) : null,
          restSeconds: Number(e.restSeconds),
          notes: e.notes.trim(),
        })),
      })),
    },
  };
}

function NumberField({
  label,
  value,
  onChange,
  inputMode = "numeric",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: "numeric" | "decimal" | "text";
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-medium transition placeholder:text-muted-foreground/60 hover:border-white/20 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:outline-none"
      />
    </label>
  );
}

function ExerciseRow({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: DraftExercise;
  index: number;
  onChange: (patch: Partial<DraftExercise>) => void;
  onRemove: () => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      whileDrag={{ scale: 1.02, boxShadow: "0 25px 50px -20px rgba(255,45,31,0.45)" }}
      className="relative mb-3 rounded-2xl border border-white/10 bg-[#0f0a0a] p-4"
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onPointerDown={(e) => controls.start(e)}
          aria-label={`Drag to reorder ${item.exercise.name}`}
          className="mt-2.5 cursor-grab touch-none text-muted-foreground transition hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-5" aria-hidden />
        </button>
        <MuscleIconTile group={item.exercise.muscleGroup} className="size-10" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            <span className="mr-2 text-muted-foreground">{index + 1}.</span>
            {item.exercise.name}
          </p>
          <p className="text-sm text-muted-foreground">
            {muscleLabel(item.exercise.muscleGroup)} · {equipmentLabel(item.exercise.equipment)}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${item.exercise.name}`}
          className="grid size-9 place-items-center rounded-full text-muted-foreground transition hover:bg-primary/15 hover:text-accent-text"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:pl-[5.25rem]">
        <NumberField label="Sets" value={item.sets} onChange={(sets) => onChange({ sets })} />
        <NumberField label="Reps" value={item.reps} onChange={(reps) => onChange({ reps })} inputMode="text" placeholder="8-12" />
        <NumberField label="Weight (kg)" value={item.weight} onChange={(weight) => onChange({ weight })} inputMode="decimal" placeholder="Optional" />
        <NumberField label="Rest (sec)" value={item.restSeconds} onChange={(restSeconds) => onChange({ restSeconds })} />
      </div>
      <div className="mt-3 sm:pl-[5.25rem]">
        <input
          value={item.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Add a coaching note (optional)"
          maxLength={200}
          className="h-9 w-full rounded-xl border border-transparent bg-transparent px-3 text-sm text-muted-foreground transition placeholder:text-muted-foreground/50 hover:border-white/10 focus-visible:border-primary focus-visible:text-foreground focus-visible:outline-none"
        />
      </div>
    </Reorder.Item>
  );
}

function AssignPanel({ selected, onToggle }: { selected: Set<string>; onToggle: (id: string) => void }) {
  const { data: session } = useSession();
  const ownerLevel = !!session && can(session, "gym:settings");
  // Owners can put any member on a plan; trainers only their own clients.
  const clients = useClients();
  const members = useUsers("MEMBER", ownerLevel);
  const people = ownerLevel ? members.data : clients.data;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Users className="size-4 text-accent-text" aria-hidden />
          Assign to
        </CardTitle>
        {selected.size > 0 && <Tag tone="red">{selected.size} selected</Tag>}
      </div>
      {people?.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {ownerLevel ? "No members in your gym yet." : "No clients assigned to you yet. Your gym owner assigns them."}
        </p>
      ) : (
        <ul className="-mx-2 max-h-72 space-y-1 overflow-y-auto px-2">
          {people?.map((person) => {
            const checked = selected.has(person.id);
            return (
              <li key={person.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-2xl px-2 py-2 transition",
                    checked ? "bg-primary/10" : "hover:bg-white/[0.05]",
                  )}
                >
                  <input type="checkbox" className="sr-only" checked={checked} onChange={() => onToggle(person.id)} />
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-accent-text">
                    {person.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{person.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{person.email}</span>
                  </span>
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-md border transition",
                      checked ? "border-primary bg-primary text-white" : "border-white/20",
                    )}
                    aria-hidden
                  >
                    {checked && <Check className="size-3.5" />}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function PlanEditor({ plan }: { plan?: WorkoutPlan }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => toDraft(plan));
  const [activeKey, setActiveKey] = useState(() => draft.days[0].key);
  const initialAssignees = plan?.assignedTo.map((u) => u.id) ?? [];
  const [assignees, setAssignees] = useState(() => new Set(initialAssignees));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [localError, setLocalError] = useState<string>();
  const [justSaved, setJustSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const savePlan = useSavePlan();
  const deletePlan = useDeletePlan();
  const toast = useToast();

  const activeIndex = Math.max(0, draft.days.findIndex((d) => d.key === activeKey));
  const activeDay = draft.days[activeIndex];

  const updateDay = (key: string, patch: Partial<DraftDay>) =>
    setDraft((d) => ({ ...d, days: d.days.map((day) => (day.key === key ? { ...day, ...patch } : day)) }));

  const updateExercise = (exKey: string, patch: Partial<DraftExercise>) =>
    updateDay(activeDay.key, {
      exercises: activeDay.exercises.map((e) => (e.key === exKey ? { ...e, ...patch } : e)),
    });

  function addDay() {
    const day = { key: newKey(), name: DEFAULT_DAY_NAMES[draft.days.length] ?? "New day", exercises: [] };
    setDraft((d) => ({ ...d, days: [...d.days, day] }));
    setActiveKey(day.key);
  }

  function removeDay(key: string) {
    const remaining = draft.days.filter((d) => d.key !== key);
    setDraft((d) => ({ ...d, days: remaining }));
    setActiveKey(remaining[Math.max(0, activeIndex - 1)].key);
  }

  function addExercise(exercise: Exercise) {
    updateDay(activeDay.key, {
      exercises: [
        ...activeDay.exercises,
        { key: newKey(), exercise, sets: "3", reps: "10", weight: "", restSeconds: "90", notes: "" },
      ],
    });
  }

  function toggleAssignee(id: string) {
    setAssignees((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    const result = toInput(draft);
    if ("error" in result) {
      setLocalError(result.error);
      return;
    }
    setLocalError(undefined);
    const ids = [...assignees];
    const assigneesChanged = ids.length !== initialAssignees.length || ids.some((id) => !initialAssignees.includes(id));
    savePlan.mutate(
      { id: plan?.id, body: result.body, memberIds: assigneesChanged ? ids : null },
      {
        onSuccess: (saved) => {
          toast({
            title: plan ? "Plan saved" : "Plan created",
            description: saved.assignedTo.length
              ? `Assigned to ${saved.assignedTo.length} ${saved.assignedTo.length === 1 ? "member" : "members"}.`
              : "Assign it to a client whenever you're ready.",
          });
          if (!plan) {
            router.replace(`/plans/${saved.id}`);
            return;
          }
          setJustSaved(true);
          setTimeout(() => setJustSaved(false), 2000);
        },
      },
    );
  }

  const totalExercises = draft.days.reduce((n, d) => n + d.exercises.length, 0);
  const minutes = activeDay.exercises.length
    ? estimateMinutes({
        exercises: activeDay.exercises.map((e) => ({ sets: Number(e.sets) || 0, restSeconds: Number(e.restSeconds) || 0 })),
      })
    : 0;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <Card className="space-y-4">
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Plan name, e.g. Push Pull Legs"
            aria-label="Plan name"
            maxLength={80}
            className="font-display w-full bg-transparent text-3xl font-semibold placeholder:text-white/25 focus-visible:outline-none sm:text-4xl"
          />
          <textarea
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="What is this plan for? (optional)"
            aria-label="Description"
            maxLength={500}
            rows={2}
            className="w-full resize-none bg-transparent text-[15px] text-muted-foreground placeholder:text-white/25 focus-visible:text-foreground focus-visible:outline-none"
          />
        </Card>

        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Plan days">
          {draft.days.map((day, i) => {
            const active = day.key === activeDay.key;
            return (
              <button
                key={day.key}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveKey(day.key)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition duration-200",
                  active
                    ? "border-primary bg-primary text-white shadow-[0_6px_20px_-8px_var(--primary)]"
                    : "border-white/10 bg-white/[0.04] text-muted-foreground hover:text-foreground",
                )}
              >
                {day.name || `Day ${i + 1}`}
                <span className={cn("rounded-full px-1.5 text-xs", active ? "bg-white/20" : "bg-white/10")}>
                  {day.exercises.length}
                </span>
              </button>
            );
          })}
          {draft.days.length < MAX_DAYS && (
            <button
              type="button"
              onClick={addDay}
              className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-white/20 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-white/40 hover:text-foreground"
            >
              <Plus className="size-4" aria-hidden />
              Add day
            </button>
          )}
        </div>

        <Card>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Input
              value={activeDay.name}
              onChange={(e) => updateDay(activeDay.key, { name: e.target.value })}
              aria-label="Day name"
              maxLength={40}
              className="h-11 max-w-xs font-semibold"
            />
            {minutes > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="size-4" aria-hidden />~{minutes} min
              </span>
            )}
            {draft.days.length > 1 && (
              <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={() => removeDay(activeDay.key)}>
                <Trash2 className="size-4" aria-hidden />
                Remove day
              </Button>
            )}
          </div>

          <Reorder.Group
            axis="y"
            values={activeDay.exercises}
            onReorder={(exercises) => updateDay(activeDay.key, { exercises })}
          >
            <AnimatePresence initial={false}>
              {activeDay.exercises.map((item, i) => (
                <ExerciseRow
                  key={item.key}
                  item={item}
                  index={i}
                  onChange={(patch) => updateExercise(item.key, patch)}
                  onRemove={() =>
                    updateDay(activeDay.key, { exercises: activeDay.exercises.filter((e) => e.key !== item.key) })
                  }
                />
              ))}
            </AnimatePresence>
          </Reorder.Group>

          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 py-5 text-sm font-semibold text-muted-foreground transition hover:border-primary/60 hover:bg-primary/5 hover:text-foreground"
          >
            <Plus className="size-4" aria-hidden />
            Add exercises
          </button>
        </Card>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-28">
        <Card>
          <CardTitle className="mb-4 text-foreground">Summary</CardTitle>
          <dl className="grid grid-cols-3 gap-3 text-center">
            {[
              { icon: Layers, label: "Days", value: draft.days.length },
              { icon: Dumbbell, label: "Exercises", value: totalExercises },
              { icon: Clock, label: "Today", value: minutes ? `${minutes}m` : "–" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-2xl bg-white/[0.04] px-2 py-3">
                <Icon className="mx-auto size-4 text-accent-text" aria-hidden />
                <dd className="font-display mt-1 text-2xl font-semibold">{value}</dd>
                <dt className="text-xs text-muted-foreground">{label}</dt>
              </div>
            ))}
          </dl>
        </Card>

        <AssignPanel selected={assignees} onToggle={toggleAssignee} />

        <AnimatePresence>
          {(localError || savePlan.error) && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <FormError message={localError ?? savePlan.error?.message} />
            </motion.div>
          )}
        </AnimatePresence>

        <Button className="w-full" size="lg" loading={savePlan.isPending} onClick={save}>
          {justSaved ? <Check className="size-5" aria-hidden /> : null}
          {justSaved ? "Saved" : plan ? "Save changes" : "Create plan"}
        </Button>

        {plan && (
          <Button
            variant="ghost"
            className={cn("w-full", confirmDelete ? "text-accent-text" : "text-muted-foreground")}
            loading={deletePlan.isPending}
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                setTimeout(() => setConfirmDelete(false), 4000);
                return;
              }
              deletePlan.mutate(plan.id, {
                onSuccess: () => {
                  toast({ title: "Plan deleted" });
                  router.replace("/plans");
                },
              });
            }}
          >
            <Trash2 className="size-4" aria-hidden />
            {confirmDelete ? "Tap again to delete" : "Delete plan"}
          </Button>
        )}
      </aside>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addExercise}
        pickedIds={new Set(activeDay.exercises.map((e) => e.exercise.id))}
        dayName={activeDay.name}
      />
    </div>
  );
}

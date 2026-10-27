"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Droplet, Minus, Plus, Target, Trash2 } from "lucide-react";
import { FormError } from "@/components/auth/auth-card";
import { CalorieWeekChart, MACROS, MacroBar } from "@/components/extras/nutrition-bits";
import { ChartCard, DataTable } from "@/components/progress/chart-card";
import { PageHeader } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { todayKey, useAddFood, useDeleteFood, useNutrition, useSetNutritionGoals, useSetWater } from "@/hooks/use-extras";
import { dayLabel } from "@/lib/schedule";
import type { Meal, NutritionGoals } from "@/lib/types";
import { cn } from "@/lib/utils";

const MEALS: { value: Meal; label: string }[] = [
  { value: "BREAKFAST", label: "Breakfast" },
  { value: "LUNCH", label: "Lunch" },
  { value: "DINNER", label: "Dinner" },
  { value: "SNACK", label: "Snacks" },
];
const GLASS_ML = 250;

const shiftDay = (day: string, by: number) => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + by);
  return d.toLocaleDateString("en-CA");
};

const num = (v: string) => (v.trim() === "" ? 0 : Number(v));

function AddFoodDialog({ meal, day, onClose }: { meal: Meal | null; day: string; onClose: () => void }) {
  return (
    <Dialog open={!!meal} onClose={onClose} title={`Add to ${MEALS.find((m) => m.value === meal)?.label.toLowerCase() ?? ""}`} description={dayLabel(day)}>
      {meal && <FoodForm key={meal} meal={meal} day={day} onDone={onClose} />}
    </Dialog>
  );
}

function FoodForm({ meal, day, onDone }: { meal: Meal; day: string; onDone: () => void }) {
  const [form, setForm] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "" });
  const add = useAddFood();
  const toast = useToast();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: k === "name" ? e.target.value : e.target.value.replace(/[^\d.]/g, "") }));
  const valid = form.name.trim() && form.calories.trim() !== "";

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        add.mutate(
          { day, meal, name: form.name.trim(), calories: num(form.calories), protein: num(form.protein), carbs: num(form.carbs), fat: num(form.fat) },
          { onSuccess: () => (toast({ title: `${form.name.trim()} logged`, description: `${num(form.calories)} kcal` }), onDone()) },
        );
      }}
    >
      <Field label="Food" htmlFor="f-name">
        <Input id="f-name" value={form.name} onChange={set("name")} placeholder="e.g. Paneer bhurji with 2 rotis" autoFocus maxLength={80} />
      </Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["calories", "Calories"],
            ["protein", "Protein (g)"],
            ["carbs", "Carbs (g)"],
            ["fat", "Fat (g)"],
          ] as const
        ).map(([k, label]) => (
          <Field key={k} label={label} htmlFor={`f-${k}`}>
            <Input id={`f-${k}`} inputMode="decimal" value={form[k]} onChange={set(k)} placeholder={k === "calories" ? "Required" : "0"} />
          </Field>
        ))}
      </div>
      <FormError message={add.error?.message} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={add.isPending} disabled={!valid}>
          Add food
        </Button>
      </div>
    </form>
  );
}

function GoalsDialog({ open, goals, onClose }: { open: boolean; goals: NutritionGoals; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Daily goals" description="Your trainer can see these alongside what you log.">
      {open && <GoalsForm goals={goals} onDone={onClose} />}
    </Dialog>
  );
}

function GoalsForm({ goals, onDone }: { goals: NutritionGoals; onDone: () => void }) {
  const [form, setForm] = useState(() => Object.fromEntries(Object.entries(goals).map(([k, v]) => [k, v == null ? "" : String(v)])) as Record<keyof NutritionGoals, string>);
  const save = useSetNutritionGoals();
  const toast = useToast();
  const fields: [keyof NutritionGoals, string, string][] = [
    ["calories", "Calories", "2000"],
    ["protein", "Protein (g)", "110"],
    ["carbs", "Carbs (g)", "220"],
    ["fat", "Fat (g)", "60"],
    ["waterMl", "Water (ml)", "3000"],
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {fields.map(([k, label, ph]) => (
          <Field key={k} label={label} htmlFor={`g-${k}`}>
            <Input id={`g-${k}`} inputMode="numeric" value={form[k]} placeholder={ph} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value.replace(/\D/g, "") }))} />
          </Field>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Leave a box empty for no goal. Not sure? Ask your trainer.</p>
      <FormError message={save.error?.message} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          loading={save.isPending}
          onClick={() =>
            save.mutate(Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === "" ? null : Number(v)])), {
              onSuccess: () => (toast({ title: "Goals saved" }), onDone()),
            })
          }
        >
          Save goals
        </Button>
      </div>
    </div>
  );
}

export default function NutritionPage() {
  const [day, setDay] = useState(todayKey);
  const [adding, setAdding] = useState<Meal | null>(null);
  const [editingGoals, setEditingGoals] = useState(false);
  const { data, isPending } = useNutrition(day);
  const setWater = useSetWater();
  const remove = useDeleteFood();
  const isToday = day === todayKey();

  const water = data?.log.waterMl ?? 0;
  const waterGoal = data?.goals.waterMl ?? 3000;
  const glasses = Math.max(8, Math.ceil(waterGoal / GLASS_ML));

  return (
    <>
      <PageHeader
        eyebrow="Nutrition"
        title={
          <>
            Fuel your <span className="text-primary">training</span>
          </>
        }
        subtitle="Log what you eat and drink. Your trainer sees your totals, not your diary."
        actions={
          <Button variant="outline" onClick={() => setEditingGoals(true)}>
            <Target className="size-4" aria-hidden />
            Daily goals
          </Button>
        }
      />

      <div className="mb-6 flex items-center gap-2">
        <Button size="icon" variant="outline" aria-label="Previous day" onClick={() => setDay((d) => shiftDay(d, -1))}>
          <ChevronLeft className="size-5" aria-hidden />
        </Button>
        <p className="min-w-40 text-center font-semibold">{dayLabel(day)}</p>
        <Button size="icon" variant="outline" aria-label="Next day" disabled={isToday} onClick={() => setDay((d) => shiftDay(d, 1))}>
          <ChevronRight className="size-5" aria-hidden />
        </Button>
        {!isToday && (
          <Button size="sm" variant="ghost" onClick={() => setDay(todayKey())}>
            Today
          </Button>
        )}
      </div>

      {isPending || !data ? (
        <Skeleton className="h-40 w-full rounded-3xl" />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {MACROS.map((m, i) => (
              <MacroBar key={m.key} label={m.label} unit={m.unit} value={data.totals[m.key]} goal={data.goals[m.key]} highlight={i === 0} />
            ))}
          </div>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-semibold">Water</h2>
                <p className="text-sm text-muted-foreground">
                  {(water / 1000).toFixed(water % 1000 ? 2 : 1)} L of {(waterGoal / 1000).toFixed(1)} L · tap a glass for {GLASS_ML} ml
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="icon" variant="outline" aria-label="Remove a glass" disabled={water <= 0} onClick={() => setWater.mutate({ day, waterMl: Math.max(0, water - GLASS_ML) })}>
                  <Minus className="size-4" aria-hidden />
                </Button>
                <Button size="icon" aria-label="Add a glass" onClick={() => setWater.mutate({ day, waterMl: water + GLASS_ML })}>
                  <Plus className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {Array.from({ length: glasses }, (_, i) => {
                const full = (i + 1) * GLASS_ML <= water;
                return (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Set water to ${(i + 1) * GLASS_ML} ml`}
                    onClick={() => setWater.mutate({ day, waterMl: (i + 1) * GLASS_ML === water ? i * GLASS_ML : (i + 1) * GLASS_ML })}
                    className={cn("grid h-12 w-9 place-items-center rounded-xl border transition", full ? "border-sky-400/40 bg-sky-500/20 text-sky-300" : "border-white/10 bg-white/[0.03] text-muted-foreground/40 hover:border-white/25")}
                  >
                    <Droplet className={cn("size-4", full && "fill-current")} aria-hidden />
                  </button>
                );
              })}
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {MEALS.map((meal) => {
              const entries = data.log.entries.filter((e) => e.meal === meal.value);
              const kcal = entries.reduce((n, e) => n + e.calories, 0);
              return (
                <Card key={meal.value}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      {meal.label} <span className="text-sm font-normal text-muted-foreground">· {Math.round(kcal)} kcal</span>
                    </h3>
                    <Button size="sm" variant="ghost" onClick={() => setAdding(meal.value)}>
                      <Plus className="size-4" aria-hidden />
                      Add
                    </Button>
                  </div>
                  {entries.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">Nothing logged.</p>
                  ) : (
                    <ul className="mt-2 divide-y divide-white/5">
                      {entries.map((e) => (
                        <li key={e.id} className="flex items-center gap-3 py-2.5">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{e.name}</span>
                            <span className="block text-xs text-muted-foreground">
                              P {Math.round(e.protein)} g · C {Math.round(e.carbs)} g · F {Math.round(e.fat)} g
                            </span>
                          </span>
                          <span className="text-sm font-semibold tabular-nums">{Math.round(e.calories)}</span>
                          <button
                            type="button"
                            aria-label={`Remove ${e.name}`}
                            onClick={() => remove.mutate(e.id)}
                            className="grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-primary/15 hover:text-accent-text"
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>

          <ChartCard
            title="Last 7 days"
            subtitle="Calories per day"
            table={<DataTable head={["Day", "kcal", "Protein", "Water"]} rows={[...data.week].reverse().map((d) => [dayLabel(d.day), Math.round(d.calories), `${Math.round(d.protein)} g`, `${d.waterMl} ml`])} />}
          >
            <CalorieWeekChart week={data.week} goal={data.goals.calories} />
          </ChartCard>
        </div>
      )}

      <AddFoodDialog meal={adding} day={day} onClose={() => setAdding(null)} />
      {data && <GoalsDialog open={editingGoals} goals={data.goals} onClose={() => setEditingGoals(false)} />}
    </>
  );
}

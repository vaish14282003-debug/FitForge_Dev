"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART, ChartTooltip, axisTick } from "@/components/progress/chart-card";
import type { Macros, NutritionDay, NutritionGoals } from "@/lib/types";
import { cn } from "@/lib/utils";

export const MACROS: { key: keyof Macros; label: string; unit: string }[] = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "carbs", label: "Carbs", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
];

/** One macro against its goal: the number leads, the bar shows how far along, red past the goal for calories. */
export function MacroBar({ label, value, goal, unit, highlight }: { label: string; value: number; goal: number | null; unit: string; highlight?: boolean }) {
  const pct = goal ? Math.min(100, (value / goal) * 100) : 0;
  const over = !!goal && value > goal;
  return (
    <div className={cn("rounded-3xl border border-white/10 bg-white/[0.03] p-5", highlight && "border-transparent bg-linear-to-br from-primary to-[#a8130a]")}>
      <p className={cn("text-sm", highlight ? "text-white/85" : "text-muted-foreground")}>{label}</p>
      <p className="font-display mt-2 text-3xl font-semibold tabular-nums">
        {Math.round(value)}
        <span className={cn("ml-1 text-base", highlight ? "text-white/80" : "text-muted-foreground")}>{goal ? `/ ${goal} ${unit}` : unit}</span>
      </p>
      <div className={cn("mt-3 h-2 overflow-hidden rounded-full", highlight ? "bg-white/25" : "bg-white/10")} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} towards goal`}>
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", highlight ? "bg-white" : over ? "bg-amber-400" : "bg-linear-to-r from-primary to-[#ff7a4d]")}
          style={{ width: `${goal ? pct : 0}%` }}
        />
      </div>
      <p className={cn("mt-2 text-xs", highlight ? "text-white/80" : "text-muted-foreground")}>
        {!goal ? "No goal set" : over ? `${Math.round(value - goal)} ${unit} over` : `${Math.round(goal - value)} ${unit} to go`}
      </p>
    </div>
  );
}

export function CalorieWeekChart({ week, goal }: { week: NutritionDay["week"]; goal: number | null }) {
  const label = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" });
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={week} margin={{ top: 10, right: 12, bottom: 0, left: 0 }} barCategoryGap="25%">
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="day" tickFormatter={label} tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={48} />
        {goal ? <ReferenceLine y={goal} stroke={CHART.reference} strokeDasharray="5 5" label={{ value: "Goal", position: "insideTopRight", fill: CHART.reference, fontSize: 12 }} /> : null}
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <ChartTooltip
                title={new Date(`${payload[0].payload.day}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
                rows={[
                  { label: "kcal", value: String(Math.round(payload[0].payload.calories)) },
                  { label: "protein", value: `${Math.round(payload[0].payload.protein)} g` },
                ]}
              />
            ) : null
          }
        />
        <Bar dataKey="calories" fill={CHART.series} radius={[4, 4, 0, 0]} maxBarSize={36} animationDuration={600} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Seven-day averages over days that were logged, for trainers and the dashboard. */
export function weeklyAverages(week: NutritionDay["week"]) {
  const logged = week.filter((d) => d.logged);
  const avg = (k: keyof Macros) => (logged.length ? Math.round(logged.reduce((n, d) => n + d[k], 0) / logged.length) : 0);
  return { days: logged.length, calories: avg("calories"), protein: avg("protein"), carbs: avg("carbs"), fat: avg("fat") };
}

export const hasGoals = (g: NutritionGoals) => Object.values(g).some((v) => v != null);

"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Dumbbell, Minus, Plus, Scale, Target, Trash2, Trophy } from "lucide-react";
import { AttendanceCalendar } from "@/components/progress/attendance-calendar";
import { ChartCard, ChartEmpty, DataTable, shortDate } from "@/components/progress/chart-card";
import { StrengthChart, VolumeChart, WeightChart, type StrengthMetric } from "@/components/progress/charts";
import { GoalDialog, LogMetricDialog } from "@/components/progress/metric-dialogs";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useDeleteMetric, useMetrics, useStrength, useTrainingProgress } from "@/hooks/use-progress";
import type { BodyMetric, Measurements } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatVolume } from "@/lib/workout";

const MEASUREMENT_LABELS: Record<keyof Measurements, string> = {
  chest: "Chest",
  waist: "Waist",
  hips: "Hips",
  arm: "Arm",
  thigh: "Thigh",
};

const signed = (n: number, unit: string) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(Math.round(n * 10) / 10)} ${unit}`;

/** How far from the starting weight towards the goal, 0–100. Works for losing or gaining. */
function goalProgress(start: number, current: number, target: number) {
  if (start === target) return current === target ? 100 : 0;
  return Math.round(Math.min(1, Math.max(0, (start - current) / (start - target))) * 100);
}

function Change({ value, unit, goodWhenDown }: { value: number; unit: string; goodWhenDown?: boolean }) {
  const Icon = value === 0 ? Minus : value < 0 ? ArrowDownRight : ArrowUpRight;
  const good = goodWhenDown === undefined ? null : goodWhenDown ? value < 0 : value > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-sm font-medium tabular-nums",
        good === null || value === 0 ? "text-muted-foreground" : good ? "text-emerald-400" : "text-accent-text",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {signed(value, unit)}
    </span>
  );
}

function MeasurementsCard({ metrics }: { metrics: BodyMetric[] }) {
  const rows = (Object.keys(MEASUREMENT_LABELS) as (keyof Measurements)[])
    .map((key) => {
      const logged = metrics.filter((m) => m.measurements?.[key] != null);
      if (logged.length === 0) return null;
      const first = logged[0].measurements[key] as number;
      const last = logged[logged.length - 1].measurements[key] as number;
      return { key, label: MEASUREMENT_LABELS[key], first, last, since: logged[0].day };
    })
    .filter((r) => r !== null);

  return (
    <Card>
      <h2 className="font-display text-2xl font-semibold">Measurements</h2>
      <p className="mt-1 text-sm text-muted-foreground">Latest compared with your first entry.</p>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No measurements yet. Add them when you log a weigh-in.</p>
      ) : (
        <ul className="mt-4 divide-y divide-white/5">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-3 py-3">
              <span className="font-medium">{row.label}</span>
              <span className="flex items-center gap-3">
                <span className="font-display text-xl font-semibold tabular-nums">
                  {row.last}
                  <span className="ml-0.5 text-sm text-muted-foreground">cm</span>
                </span>
                <Change value={row.last - row.first} unit="cm" />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function WeighIns({ metrics, editable }: { metrics: BodyMetric[]; editable: boolean }) {
  const remove = useDeleteMetric();
  const toast = useToast();
  const recent = [...metrics].reverse().slice(0, 6);
  return (
    <Card>
      <h2 className="font-display text-2xl font-semibold">Recent entries</h2>
      {recent.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nothing logged yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-white/5">
          {recent.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2.5">
              <span className="w-16 shrink-0 text-sm text-muted-foreground">{shortDate(m.day)}</span>
              <span className="min-w-0 flex-1 truncate text-sm">
                {[m.weight != null && `${m.weight} kg`, m.bodyFat != null && `${m.bodyFat}% fat`].filter(Boolean).join(" · ") || "Measurements"}
              </span>
              {editable && (
                <button
                  type="button"
                  aria-label={`Delete entry from ${m.day}`}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(m.id, { onSuccess: () => toast({ title: "Entry deleted" }) })}
                  className="grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-primary/15 hover:text-accent-text"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * The full progress picture for one member. Members see their own (and can log);
 * trainers and owners pass `memberId` and get a read-only view.
 */
export function ProgressView({ memberId }: { memberId?: string }) {
  const editable = !memberId;
  const metricsQuery = useMetrics(memberId);
  const training = useTrainingProgress(memberId);
  const [picked, setPicked] = useState<string | null>(null);
  const [metric, setMetric] = useState<StrengthMetric>("e1rm");
  const [logging, setLogging] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);

  const exercises = training.data?.exercises ?? [];
  const exerciseId = picked ?? exercises[0]?.exercise ?? null;
  const strength = useStrength(exerciseId, memberId);

  const metrics = metricsQuery.data?.metrics ?? [];
  const goal = metricsQuery.data?.goal.targetWeight ?? null;
  const weighIns = metrics.filter((m) => m.weight != null);
  const first = weighIns[0];
  const latest = weighIns.at(-1);
  const workouts12w = training.data?.weekly.reduce((n, w) => n + w.workouts, 0);
  const bestLift = [...exercises].sort((a, b) => (b.bestWeight ?? 0) - (a.bestWeight ?? 0))[0];
  const goalPct = first && latest && goal != null ? goalProgress(first.weight!, latest.weight!, goal) : null;

  const points = strength.data?.points.filter((p) => p[metric] != null) ?? [];
  const strengthChange = points.length > 1 ? (points.at(-1)![metric] as number) - (points[0][metric] as number) : null;
  const volumeTotal = training.data?.weekly.reduce((n, w) => n + w.volume, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          index={0}
          highlight
          label="Body weight"
          icon={Scale}
          loading={metricsQuery.isPending}
          value={latest ? `${latest.weight} kg` : "Not logged"}
          hint={first && latest && first !== latest ? `${signed(latest.weight! - first.weight!, "kg")} since ${shortDate(first.day)}` : undefined}
        />
        <StatCard
          index={1}
          label="Goal"
          icon={Target}
          loading={metricsQuery.isPending}
          value={goal != null ? `${goal} kg` : "Not set"}
          hint={goalPct != null ? `${goalPct}% of the way there` : editable ? "Set a target weight" : undefined}
        />
        <StatCard index={2} label="Workouts" icon={Dumbbell} loading={training.isPending} value={workouts12w} hint="in the last 12 weeks" />
        <StatCard
          index={3}
          label="Best lift"
          icon={Trophy}
          loading={training.isPending}
          value={bestLift?.bestWeight ? `${bestLift.bestWeight} kg` : "–"}
          hint={bestLift?.bestWeight ? bestLift.name : "Log a workout to see it"}
        />
      </div>

      {goalPct != null && (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted-foreground">
              {first!.weight} kg → <span className="font-semibold text-foreground">{goal} kg</span>
            </span>
            <span className="font-semibold">{goalPct}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={goalPct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to goal weight">
            <div className="h-full rounded-full bg-linear-to-r from-primary to-[#ff7a4d] transition-[width] duration-700" style={{ width: `${goalPct}%` }} />
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Body weight"
          subtitle={latest ? `${weighIns.length} weigh-ins` : "Track it weekly for a clear trend."}
          actions={
            editable && (
              <>
                <Button size="sm" variant="outline" onClick={() => setEditingGoal(true)}>
                  <Target className="size-4" aria-hidden />
                  {goal != null ? "Edit goal" : "Set goal"}
                </Button>
                <Button size="sm" onClick={() => setLogging(true)}>
                  <Plus className="size-4" aria-hidden />
                  Log weigh-in
                </Button>
              </>
            )
          }
          table={<DataTable head={["Date", "Weight", "Body fat"]} rows={[...weighIns].reverse().map((m) => [shortDate(m.day), `${m.weight} kg`, m.bodyFat != null ? `${m.bodyFat}%` : "–"])} />}
        >
          {metricsQuery.isPending ? (
            <Skeleton className="h-64 w-full" />
          ) : weighIns.length < 2 ? (
            <ChartEmpty>{weighIns.length === 0 ? "No weigh-ins yet." : "One more weigh-in and your trend line appears."}</ChartEmpty>
          ) : (
            <WeightChart metrics={metrics} goal={goal} />
          )}
        </ChartCard>
        <MeasurementsCard metrics={metrics} />
      </div>

      <ChartCard
        title="Strength"
        subtitle={
          strength.data && strengthChange != null ? (
            <>
              {strength.data.exercise.name} · <span className="text-foreground">{signed(strengthChange, "kg")}</span> since{" "}
              {shortDate(points[0].date)}
            </>
          ) : (
            "Pick an exercise to see how your lifts have moved."
          )
        }
        actions={
          <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5" role="group" aria-label="Strength measure">
            {(
              [
                ["e1rm", "Est. 1RM"],
                ["bestWeight", "Heaviest"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={metric === value}
                onClick={() => setMetric(value)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition",
                  metric === value ? "bg-white text-black" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        }
        table={
          <DataTable
            head={["Date", "Est. 1RM", "Heaviest", "Volume"]}
            rows={[...(strength.data?.points ?? [])].reverse().map((p) => [
              shortDate(p.date),
              p.e1rm != null ? `${p.e1rm} kg` : "–",
              p.bestWeight != null ? `${p.bestWeight} kg` : "–",
              formatVolume(p.volume),
            ])}
          />
        }
      >
        {exercises.length > 0 && (
          <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Exercise">
            {exercises.map((e) => (
              <button
                key={e.exercise}
                type="button"
                aria-pressed={e.exercise === exerciseId}
                onClick={() => setPicked(e.exercise)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                  e.exercise === exerciseId
                    ? "border-primary bg-primary text-white"
                    : "border-white/10 bg-white/[0.04] text-muted-foreground hover:text-foreground",
                )}
              >
                {e.name}
              </button>
            ))}
          </div>
        )}
        {training.isPending || (exerciseId && strength.isPending) ? (
          <Skeleton className="h-64 w-full" />
        ) : !exerciseId ? (
          <ChartEmpty>Finish a workout with weights and your strength chart starts here.</ChartEmpty>
        ) : points.length < 2 ? (
          <ChartEmpty>Log this exercise with weight in one more workout to see a trend.</ChartEmpty>
        ) : (
          <StrengthChart series={strength.data!} metric={metric} />
        )}
      </ChartCard>

      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Weekly volume"
          subtitle={`${formatVolume(volumeTotal)} lifted over 12 weeks (weight × reps)`}
          table={
            <DataTable
              head={["Week of", "Workouts", "Volume"]}
              rows={[...(training.data?.weekly ?? [])].reverse().map((w) => [shortDate(w.weekStart), w.workouts, formatVolume(w.volume)])}
            />
          }
        >
          {training.isPending ? <Skeleton className="h-64 w-full" /> : <VolumeChart weekly={training.data!.weekly} />}
        </ChartCard>
        <WeighIns metrics={metrics} editable={editable} />
      </div>

      <AttendanceCalendar memberId={memberId} />

      {editable && (
        <>
          <LogMetricDialog key={`log-${logging}`} open={logging} onClose={() => setLogging(false)} lastWeight={latest?.weight ?? null} />
          <GoalDialog key={`goal-${editingGoal}`} open={editingGoal} onClose={() => setEditingGoal(false)} current={goal} />
        </>
      )}
    </div>
  );
}

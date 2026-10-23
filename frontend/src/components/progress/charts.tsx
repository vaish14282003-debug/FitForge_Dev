"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART, ChartTooltip, axisTick, shortDate } from "@/components/progress/chart-card";
import type { BodyMetric, StrengthSeries, TrainingProgress } from "@/lib/types";
import { formatVolume } from "@/lib/workout";

const HEIGHT = 260;
const margin = { top: 10, right: 12, bottom: 0, left: 0 };

export function WeightChart({ metrics, goal }: { metrics: BodyMetric[]; goal: number | null }) {
  const data = metrics.filter((m) => m.weight != null).map((m) => ({ day: m.day, weight: m.weight as number }));
  const values = data.map((d) => d.weight).concat(goal != null ? [goal] : []);
  const domain = [Math.floor(Math.min(...values) - 1), Math.ceil(Math.max(...values) + 1)];

  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <AreaChart data={data} margin={margin}>
        <defs>
          <linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.series} stopOpacity={0.28} />
            <stop offset="100%" stopColor={CHART.series} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="day" tickFormatter={shortDate} tick={axisTick} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis domain={domain} tick={axisTick} tickLine={false} axisLine={false} width={58} unit=" kg" />
        {goal != null && (
          <ReferenceLine
            y={goal}
            stroke={CHART.reference}
            strokeDasharray="5 5"
            label={{ value: `Goal ${goal} kg`, position: "insideTopRight", fill: CHART.reference, fontSize: 12 }}
          />
        )}
        <Tooltip
          cursor={{ stroke: "rgba(255,255,255,0.25)", strokeWidth: 1 }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <ChartTooltip title={shortDate(payload[0].payload.day)} rows={[{ label: "body weight", value: `${payload[0].value} kg` }]} />
            ) : null
          }
        />
        <Area
          type="monotone"
          dataKey="weight"
          stroke={CHART.series}
          strokeWidth={2}
          fill="url(#weight-fill)"
          dot={{ r: 4, fill: CHART.series, stroke: CHART.surface, strokeWidth: 2 }}
          activeDot={{ r: 6, fill: CHART.series, stroke: CHART.surface, strokeWidth: 2 }}
          animationDuration={700}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export type StrengthMetric = "e1rm" | "bestWeight";

export function StrengthChart({ series, metric }: { series: StrengthSeries; metric: StrengthMetric }) {
  const data = series.points.filter((p) => p[metric] != null).map((p) => ({ ...p, value: p[metric] as number }));
  const label = metric === "e1rm" ? "est. 1-rep max" : "heaviest set";

  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <LineChart data={data} margin={margin}>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis domain={["dataMin - 5", "dataMax + 5"]} tick={axisTick} tickLine={false} axisLine={false} width={58} unit=" kg" allowDecimals={false} />
        <Tooltip
          cursor={{ stroke: "rgba(255,255,255,0.25)", strokeWidth: 1 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const point = payload[0].payload as (typeof data)[number];
            const rows = [{ label, value: `${point.value} kg` }];
            if (point.topSet) rows.push({ label: "top set", value: `${point.topSet.weight} kg × ${point.topSet.reps}` });
            return <ChartTooltip title={shortDate(point.date)} rows={rows} />;
          }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={CHART.series}
          strokeWidth={2}
          dot={{ r: 4, fill: CHART.series, stroke: CHART.surface, strokeWidth: 2 }}
          activeDot={{ r: 6, fill: CHART.series, stroke: CHART.surface, strokeWidth: 2 }}
          animationDuration={700}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function VolumeChart({ weekly }: { weekly: TrainingProgress["weekly"] }) {
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <BarChart data={weekly} margin={margin} barCategoryGap="22%">
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="weekStart" tickFormatter={shortDate} tick={axisTick} tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={58} tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}t` : String(v))} />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const week = payload[0].payload as TrainingProgress["weekly"][number];
            return (
              <ChartTooltip
                title={`Week of ${shortDate(week.weekStart)}`}
                rows={[
                  { label: "volume", value: formatVolume(week.volume) },
                  { label: week.workouts === 1 ? "workout" : "workouts", value: String(week.workouts) },
                ]}
              />
            );
          }}
        />
        <Bar dataKey="volume" fill={CHART.series} radius={[4, 4, 0, 0]} maxBarSize={36} animationDuration={700} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CheckInChart({ daily }: { daily: { day: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={daily} margin={margin} barCategoryGap="20%">
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="day" tickFormatter={shortDate} tick={axisTick} tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <ChartTooltip
                title={shortDate(payload[0].payload.day)}
                rows={[{ label: payload[0].value === 1 ? "check-in" : "check-ins", value: String(payload[0].value) }]}
              />
            ) : null
          }
        />
        <Bar dataKey="count" fill={CHART.series} radius={[4, 4, 0, 0]} maxBarSize={32} animationDuration={700} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const monthLabel = (month: string) => new Date(`${month}-15T12:00:00`).toLocaleDateString(undefined, { month: "short" });
const inrShort = (v: number) => (v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`);

export function RevenueChart({ months }: { months: { month: string; amount: number; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={months} margin={margin} barCategoryGap="28%">
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="month" tickFormatter={monthLabel} tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={58} tickFormatter={inrShort} />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0].payload as { month: string; amount: number; count: number };
            return (
              <ChartTooltip
                title={new Date(`${row.month}-15T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                rows={[
                  { label: "collected", value: `₹${row.amount.toLocaleString("en-IN")}` },
                  { label: row.count === 1 ? "payment" : "payments", value: String(row.count) },
                ]}
              />
            );
          }}
        />
        <Bar dataKey="amount" fill={CHART.series} radius={[4, 4, 0, 0]} maxBarSize={44} animationDuration={700} />
      </BarChart>
    </ResponsiveContainer>
  );
}

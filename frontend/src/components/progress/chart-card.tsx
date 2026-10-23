"use client";

import { useState } from "react";
import { BarChart3, Table2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Literal values of the theme tokens: chart libraries draw SVG attributes, which can't read Tailwind classes.
export const CHART = {
  series: "#ff2d1f",
  seriesSoft: "rgba(255, 45, 31, 0.18)",
  grid: "rgba(255, 255, 255, 0.06)",
  axis: "#8f8585",
  reference: "rgba(255, 255, 255, 0.45)",
  surface: "#0f0a0a",
};

export const axisTick = { fill: CHART.axis, fontSize: 12 };

export const shortDate = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

type ChartCardProps = {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** The same numbers as a table, so nothing is only reachable by hovering. */
  table: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

export function ChartCard({ title, subtitle, actions, table, className, children }: ChartCardProps) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <button
            type="button"
            onClick={() => setAsTable((v) => !v)}
            aria-pressed={asTable}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-white/20 hover:text-foreground"
          >
            {asTable ? <BarChart3 className="size-3.5" aria-hidden /> : <Table2 className="size-3.5" aria-hidden />}
            {asTable ? "Chart" : "Table"}
          </button>
        </div>
      </div>
      {asTable ? <div className="max-h-72 overflow-y-auto">{table}</div> : children}
    </Card>
  );
}

export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-left text-sm">
      <thead className="sticky top-0 bg-[#120b0b] text-xs text-muted-foreground">
        <tr>
          {head.map((h, i) => (
            <th key={h} className={cn("py-2 font-medium", i > 0 && "text-right")}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-white/5">
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, i) => (
              <td key={i} className={cn("py-2", i > 0 && "text-right tabular-nums")}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type TooltipRow = { label: string; value: string };

/** Tooltip body: the value leads, the label follows; series keyed with a short line, not a box. */
export function ChartTooltip({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#160d0c]/95 px-3.5 py-2.5 shadow-2xl backdrop-blur-xl">
      <p className="mb-1 text-xs text-muted-foreground">{title}</p>
      {rows.map((row) => (
        <p key={row.label} className="flex items-center gap-2 text-sm">
          <span className="h-0.5 w-3 rounded-full" style={{ background: CHART.series }} aria-hidden />
          <span className="font-semibold tabular-nums">{row.value}</span>
          <span className="text-muted-foreground">{row.label}</span>
        </p>
      ))}
    </div>
  );
}

export function ChartEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-64 place-items-center rounded-2xl border border-dashed border-white/10 px-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

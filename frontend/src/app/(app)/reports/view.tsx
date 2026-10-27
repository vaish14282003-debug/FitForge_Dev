"use client";

import { useState } from "react";
import { CalendarCheck, CreditCard, Download, Users } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { todayKey, useTrainerPerformance } from "@/hooks/use-extras";
import { cn } from "@/lib/utils";

const shift = (day: string, days: number) => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
};

const RANGES = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

const EXPORTS = [
  { path: "members.csv", title: "Members", body: "Everyone, with trainer and current membership.", icon: Users, ranged: false },
  { path: "payments.csv", title: "Payments", body: "Memberships sold and payments collected in the period.", icon: CreditCard, ranged: true },
  { path: "attendance.csv", title: "Attendance", body: "Every check-in in the period, QR or front desk.", icon: CalendarCheck, ranged: true },
];

const fmt = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

export default function ReportsPage() {
  const [days, setDays] = useState(30);
  const to = todayKey();
  const from = shift(to, -(days - 1));
  const perf = useTrainerPerformance(from, to);
  const query = `from=${from}&to=${to}&tz=${new Date().getTimezoneOffset()}`;

  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title={
          <>
            Gym <span className="text-primary">reports</span>
          </>
        }
        subtitle="Export your data as spreadsheets and see how each trainer is doing."
      />

      <div className="mb-8 flex flex-wrap items-center gap-2" role="group" aria-label="Period">
        {RANGES.map((r) => (
          <button
            key={r.days}
            type="button"
            aria-pressed={days === r.days}
            onClick={() => setDays(r.days)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition",
              days === r.days ? "border-primary bg-primary text-white" : "border-white/10 bg-white/[0.04] text-muted-foreground hover:text-foreground",
            )}
          >
            {r.label}
          </button>
        ))}
        <span className="ml-1 text-sm text-muted-foreground">
          {fmt(from)} – {fmt(to)}
        </span>
      </div>

      <section className="mb-12">
        <h2 className="font-display mb-4 text-3xl font-semibold">Export</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {EXPORTS.map(({ path, title, body, icon: Icon, ranged }) => (
            <Card key={path} className="flex flex-col">
              <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-accent-text ring-1 ring-primary/20">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">
                {body}
                {ranged ? "" : " Not limited to the period."}
              </p>
              <a
                href={`/api/reports/${path}?${query}`}
                download
                className="mt-4 inline-flex h-10 w-fit items-center gap-2 rounded-full bg-white/[0.06] px-4 text-sm font-semibold transition hover:bg-white/10"
              >
                <Download className="size-4" aria-hidden />
                Download CSV
              </a>
            </Card>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">CSV files open in Excel, Google Sheets or Numbers.</p>
      </section>

      <section>
        <h2 className="font-display mb-4 text-3xl font-semibold">Trainer performance</h2>
        {perf.isPending ? (
          <Skeleton className="h-48 w-full rounded-3xl" />
        ) : perf.data?.trainers.length === 0 ? (
          <EmptyState icon={Users} title="No trainers yet">
            Add trainers from the Team page to see how they&apos;re doing.
          </EmptyState>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-white/10">
                  {["Trainer", "Clients", "Active plans", "1-on-1s done", "No-shows", "Classes", "Class fill", "Reviews", "Client workouts", "Client visits / wk"].map((h, i) => (
                    <th key={h} className={cn("px-4 py-3 font-medium", i > 0 && "text-right")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {perf.data!.trainers.map((t) => {
                  const noShowRate = t.sessions.completed + t.sessions.noShow ? t.sessions.noShow / (t.sessions.completed + t.sessions.noShow) : 0;
                  return (
                    <tr key={t.trainer.id} className={cn(!t.trainer.isActive && "opacity-55")}>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-3 font-medium">
                          <Avatar name={t.trainer.name} src={t.trainer.avatarUrl} />
                          {t.trainer.name}
                          {!t.trainer.isActive && <span className="text-xs font-normal text-muted-foreground">(deactivated)</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{t.clients}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{t.activePlans}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{t.sessions.completed}</td>
                      <td className={cn("px-4 py-3 text-right tabular-nums", noShowRate > 0.2 && "text-amber-300")}>{t.sessions.noShow}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{t.classes.taught}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{t.classes.fillRate == null ? "–" : `${t.classes.fillRate}%`}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{t.reviewsGiven}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{t.clientWorkouts}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{t.clientVisitsPerWeek ?? "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Counts cover the selected period. Client visits per week averages gym check-ins across a trainer&apos;s current clients. No-shows above 20% are highlighted.
        </p>
      </section>
    </>
  );
}

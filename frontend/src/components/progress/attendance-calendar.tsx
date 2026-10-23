"use client";

import { ChartCard, DataTable, shortDate } from "@/components/progress/chart-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAttendanceSummary } from "@/hooks/use-attendance";
import { cn } from "@/lib/utils";

const WEEKS = 12;
const ROW_LABELS = ["M", "", "W", "", "F", "", "S"];

/** Twelve weeks of visits as a grid: one column per week, Monday at the top. */
export function AttendanceCalendar({ memberId }: { memberId?: string }) {
  const { data, isPending } = useAttendanceSummary(memberId);
  const visited = new Set(data?.days ?? []);
  const today = new Date();
  const todayKey = today.toLocaleDateString("en-CA");
  const mondayOffset = (today.getDay() + 6) % 7;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset - (WEEKS - 1) * 7);

  const weeks = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d);
      const key = date.toLocaleDateString("en-CA");
      return { key, future: key > todayKey, visited: visited.has(key), isToday: key === todayKey };
    }),
  );

  return (
    <ChartCard
      title="Gym visits"
      subtitle={data ? `${data.last30Days} in the last 30 days · ${data.total} in total` : "Check-ins over the last 12 weeks."}
      table={<DataTable head={["Visited on"]} rows={(data?.days ?? []).map((d) => [shortDate(d)])} />}
    >
      {isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 sm:gap-2" role="img" aria-label={`${data?.last30Days ?? 0} visits in the last 30 days`}>
            <div className="grid shrink-0 grid-rows-7 gap-1.5 pr-1 text-[10px] text-muted-foreground sm:gap-2">
              {ROW_LABELS.map((label, i) => (
                <span key={i} className="flex h-4 items-center sm:h-5">
                  {label}
                </span>
              ))}
            </div>
            {weeks.map((days, w) => (
              <div key={w} className="grid shrink-0 grid-rows-7 gap-1.5 sm:gap-2">
                {days.map((day) => (
                  <span
                    key={day.key}
                    title={day.future ? undefined : `${shortDate(day.key)}: ${day.visited ? "visited" : "no visit"}`}
                    className={cn(
                      "size-4 rounded-[5px] transition-colors sm:size-5",
                      day.future ? "bg-transparent" : day.visited ? "bg-primary shadow-[0_0_12px_-2px_var(--primary)]" : "bg-white/[0.07]",
                      day.isToday && "ring-2 ring-white/60 ring-offset-2 ring-offset-[#0f0a0a]",
                    )}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-[4px] bg-primary" aria-hidden /> Visited
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-[4px] bg-white/[0.07]" aria-hidden /> No visit
            </span>
          </div>
        </div>
      )}
    </ChartCard>
  );
}

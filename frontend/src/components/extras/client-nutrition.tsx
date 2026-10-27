"use client";

import { Salad } from "lucide-react";
import { CalorieWeekChart, hasGoals, weeklyAverages } from "@/components/extras/nutrition-bits";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { todayKey, useNutrition } from "@/hooks/use-extras";

/** Read-only nutrition snapshot of a client for their trainer. */
export function ClientNutrition({ memberId }: { memberId: string }) {
  const { data, isPending } = useNutrition(todayKey(), memberId);
  if (isPending) return <Skeleton className="h-48 w-full rounded-3xl" />;
  if (!data) return null;
  const avg = weeklyAverages(data.week);
  const goal = (v: number | null, unit: string) => (v == null ? "no goal" : `goal ${v} ${unit}`);

  return (
    <Card>
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-400">
          <Salad className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="font-display text-2xl font-semibold">Nutrition</h2>
          <p className="text-sm text-muted-foreground">{avg.days ? `Logged ${avg.days} of the last 7 days` : "Nothing logged in the last 7 days"}</p>
        </div>
      </div>
      {avg.days > 0 && (
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["Avg calories", avg.calories, goal(data.goals.calories, "kcal")],
              ["Avg protein", `${avg.protein} g`, goal(data.goals.protein, "g")],
              ["Avg carbs", `${avg.carbs} g`, goal(data.goals.carbs, "g")],
              ["Avg fat", `${avg.fat} g`, goal(data.goals.fat, "g")],
            ] as const
          ).map(([label, value, sub]) => (
            <div key={label} className="rounded-2xl bg-white/[0.04] p-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="font-display text-2xl font-semibold">{value}</dd>
              <dd className="text-xs text-muted-foreground">{sub}</dd>
            </div>
          ))}
        </dl>
      )}
      {avg.days > 0 ? (
        <div className="mt-4">
          <CalorieWeekChart week={data.week} goal={data.goals.calories} />
        </div>
      ) : (
        !hasGoals(data.goals) && <p className="mt-3 text-sm text-muted-foreground">They haven&apos;t set nutrition goals yet either. A good thing to agree on together.</p>
      )}
    </Card>
  );
}

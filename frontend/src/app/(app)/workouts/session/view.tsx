"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { EmptyState } from "@/components/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkoutLogger } from "@/components/workouts/workout-logger";
import { usePlan } from "@/hooks/use-workouts";

export default function WorkoutSessionPage() {
  const params = useSearchParams();
  const planId = params.get("plan") ?? undefined;
  const dayIndex = Number(params.get("day") ?? 0);
  const { data: plan, isPending, isError } = usePlan(planId);
  const day = plan?.days[dayIndex];

  // A narrower column keeps the set rows easy to scan mid-workout.
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/workouts" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        My workouts
      </Link>
      {!planId || isError || (plan && !day) ? (
        <EmptyState icon={FileQuestion} title="Workout not found">
          This plan or day isn&apos;t available. Pick a workout from your plan instead.
        </EmptyState>
      ) : isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-3xl" />
          <Skeleton className="h-64 w-full rounded-3xl" />
        </div>
      ) : (
        <WorkoutLogger key={`${plan.id}-${dayIndex}`} plan={plan} dayIndex={dayIndex} />
      )}
    </div>
  );
}

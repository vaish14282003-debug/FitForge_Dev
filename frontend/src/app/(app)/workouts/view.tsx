"use client";

import { useState } from "react";
import Link from "next/link";
import { Dumbbell, History, Play } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/stat-card";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { startHref } from "@/components/workouts/todays-workout";
import { PlanDayView } from "@/components/workouts/plan-day-view";
import { ResourceList } from "@/components/extras/resource-list";
import { useResources } from "@/hooks/use-extras";
import { usePlans } from "@/hooks/use-workouts";
import { cn } from "@/lib/utils";

export default function MyWorkouts() {
  const { data: plans, isPending } = usePlans();
  const resources = useResources();
  const [selected, setSelected] = useState(0);
  const plan = plans?.[Math.min(selected, (plans?.length ?? 1) - 1)];

  return (
    <>
      <PageHeader
        eyebrow="Training"
        title={
          <>
            My <span className="text-primary">workouts</span>
          </>
        }
        subtitle="The plan your trainer built for you, day by day. Tap an exercise to see how to do it."
        actions={
          <Link href="/history" className={buttonClass({ variant: "outline" })}>
            <History className="size-4" aria-hidden />
            History
          </Link>
        }
      />

      {isPending ? null : !plan ? (
        <EmptyState icon={Dumbbell} title="No plan assigned yet">
          When your trainer assigns you a workout plan, it will appear here.
        </EmptyState>
      ) : (
        <>
          {plans && plans.length > 1 && (
            <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Your plans">
              {plans.map((p, i) => (
                <button
                  key={p.id}
                  role="tab"
                  aria-selected={p.id === plan.id}
                  onClick={() => setSelected(i)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition",
                    p.id === plan.id ? "bg-white text-black" : "bg-white/[0.06] text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          <Card className="mb-6 bg-linear-to-br from-primary/20 via-white/[0.03] to-transparent">
            <p className="text-sm text-muted-foreground">Your plan · from {plan.createdBy.name}</p>
            <h2 className="font-display mt-1 text-3xl font-semibold sm:text-4xl">{plan.name}</h2>
            {plan.description ? <p className="mt-2 max-w-2xl text-muted-foreground">{plan.description}</p> : null}
          </Card>
          <PlanDayView
            key={plan.id}
            days={plan.days}
            action={(dayIndex) => (
              <Link href={startHref(plan.id, dayIndex)} className={buttonClass({ size: "sm" })}>
                <Play className="size-3.5 fill-current" aria-hidden />
                Start this workout
              </Link>
            )}
          />
        </>
      )}
      {(resources.data?.length ?? 0) > 0 && (
        <section id="resources" className="mt-12 scroll-mt-28">
          <h2 className="font-display mb-4 text-3xl font-semibold">From your trainer</h2>
          <ResourceList resources={resources.data!} canDelete={() => false} />
        </section>
      )}
    </>
  );
}

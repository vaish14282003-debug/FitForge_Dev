"use client";

import { useState } from "react";
import { Dumbbell } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/stat-card";
import { Card } from "@/components/ui/card";
import { PlanDayView } from "@/components/workouts/plan-day-view";
import { usePlans } from "@/hooks/use-workouts";
import { cn } from "@/lib/utils";

export default function MyWorkouts() {
  const { data: plans, isPending } = usePlans();
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
          <PlanDayView key={plan.id} days={plan.days} />
        </>
      )}
    </>
  );
}

"use client";

import { useParams } from "next/navigation";
import { FileQuestion } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/stat-card";
import { BackToPlans } from "@/components/workouts/back-to-plans";
import { PlanEditor } from "@/components/workouts/plan-editor";
import { usePlan } from "@/hooks/use-workouts";

export default function EditPlan() {
  const { id } = useParams<{ id: string }>();
  const { data: plan, isPending, isError } = usePlan(id);

  return (
    <>
      <BackToPlans />
      {isError ? (
        <EmptyState icon={FileQuestion} title="Plan not found">
          It may have been deleted, or it belongs to another trainer.
        </EmptyState>
      ) : isPending ? (
        <div className="grid h-64 place-items-center" role="status" aria-label="Loading plan">
          <span className="size-9 animate-spin rounded-full border-2 border-white/10 border-t-primary" />
        </div>
      ) : (
        <>
          <PageHeader eyebrow="Edit plan" title={plan.name} subtitle={`By ${plan.createdBy.name}`} />
          {/* Keyed so the form resets if a different plan loads. */}
          <PlanEditor key={plan.id} plan={plan} />
        </>
      )}
    </>
  );
}

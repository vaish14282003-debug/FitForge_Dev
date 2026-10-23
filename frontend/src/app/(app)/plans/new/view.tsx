"use client";

import { PageHeader } from "@/components/stat-card";
import { BackToPlans } from "@/components/workouts/back-to-plans";
import { PlanEditor } from "@/components/workouts/plan-editor";

export default function NewPlan() {
  return (
    <>
      <BackToPlans />
      <PageHeader
        eyebrow="Plan builder"
        title={
          <>
            Build a <span className="text-primary">new plan</span>
          </>
        }
        subtitle="Add days, fill them with exercises, then assign the plan to your clients."
      />
      <PlanEditor />
    </>
  );
}

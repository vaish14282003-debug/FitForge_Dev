"use client";

import { ProgressView } from "@/components/progress/progress-view";
import { PageHeader } from "@/components/stat-card";

export default function MyProgress() {
  return (
    <>
      <PageHeader
        eyebrow="Progress"
        title={
          <>
            Your <span className="text-primary">progress</span>
          </>
        }
        subtitle="Body weight, strength and training volume over time. Small, steady changes add up."
      />
      <ProgressView />
    </>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, MessageSquareQuote, UserX } from "lucide-react";
import { ClientNotes } from "@/components/extras/client-notes";
import { ClientNutrition } from "@/components/extras/client-nutrition";
import { ProgressView } from "@/components/progress/progress-view";
import { EmptyState, PageHeader } from "@/components/stat-card";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionDetail, SessionStats } from "@/components/workouts/session-detail";
import { useMetrics } from "@/hooks/use-progress";
import { useSessions } from "@/hooks/use-sessions";
import type { WorkoutSession } from "@/lib/types";
import { formatDate } from "@/lib/workout";

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const metrics = useMetrics(id);
  const sessions = useSessions({ member: id, limit: 10 });
  const [open, setOpen] = useState<WorkoutSession | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back
      </button>

      {metrics.isError ? (
        <EmptyState icon={UserX} title="Client not found">
          This member isn&apos;t one of your clients, or they no longer exist.
        </EmptyState>
      ) : (
        <>
          {metrics.data ? (
            <PageHeader
              eyebrow="Client progress"
              title={<span className="text-primary">{metrics.data.member.name}</span>}
              subtitle="Read-only view of their weigh-ins, lifts and training volume."
            />
          ) : (
            <Skeleton className="mb-10 h-24 w-80" />
          )}

          <div className="mb-6 grid items-start gap-6 xl:grid-cols-2">
            <ClientNotes memberId={id} />
            <ClientNutrition memberId={id} />
          </div>

          <ProgressView memberId={id} />

          <h2 className="font-display mt-12 mb-4 text-3xl font-semibold">Recent workouts</h2>
          {sessions.data?.length === 0 ? (
            <Card className="text-sm text-muted-foreground">No workouts logged yet.</Card>
          ) : (
            <ul className="space-y-3">
              {(sessions.data ?? []).map((session) => (
                <li key={session.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(session)}
                    className="group flex w-full items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-white/20 sm:p-5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 font-semibold">
                        {session.dayName}
                        {session.review.reviewedAt && <MessageSquareQuote className="size-4 text-accent-text" aria-label="Reviewed" />}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {formatDate(session.completedAt)} · {session.planName}
                      </span>
                      <SessionStats session={session} className="mt-2" />
                    </span>
                    <ChevronRight className="size-5 text-muted-foreground transition group-hover:translate-x-0.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-sm text-muted-foreground">
            Review new workouts from your{" "}
            <Link href="/trainer" className="text-foreground underline-offset-4 hover:underline">
              dashboard
            </Link>
            .
          </p>
        </>
      )}

      <Dialog
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.dayName ?? ""}
        description={open ? `${formatDate(open.completedAt)} · ${open.planName}` : undefined}
        className="max-w-xl"
      >
        {open && <SessionDetail session={open} />}
      </Dialog>
    </>
  );
}

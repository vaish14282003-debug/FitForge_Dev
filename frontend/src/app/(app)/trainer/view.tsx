"use client";

import Link from "next/link";
import { CalendarClock, ChevronRight, ClipboardCheck, ClipboardList, Users } from "lucide-react";
import { EmptyState, PageHeader, StatCard } from "@/components/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ReviewQueue } from "@/components/workouts/review-queue";
import { useClients } from "@/hooks/use-gym";
import { useSessions } from "@/hooks/use-sessions";
import { useSession } from "@/hooks/use-session";
import { usePlans } from "@/hooks/use-workouts";
import { firstName, greeting } from "@/lib/utils";

export default function TrainerDashboard() {
  const { data: session } = useSession();
  const { data: clients, isPending: clientsPending } = useClients();
  const { data: plans, isPending: plansPending } = usePlans();
  const pending = useSessions({ pendingReview: true, limit: 20 });
  // A plan counts as active once at least one client is following it.
  const activePlans = plans?.filter((p) => p.assignedTo.length > 0).length;
  if (!session) return null;

  return (
    <>
      <PageHeader
        eyebrow="Trainer"
        title={
          <>
            {greeting()}, <span className="text-primary">{firstName(session.user.name)}</span>
          </>
        }
        subtitle="Your clients and what needs you today."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} highlight label="My clients" icon={Users} loading={clientsPending} value={clients?.length} />
        <StatCard index={1} label="Active plans" icon={ClipboardList} loading={plansPending} value={activePlans} />
        <StatCard index={2} label="Today's sessions" icon={CalendarClock} />
        <StatCard index={3} label="Pending reviews" icon={ClipboardCheck} loading={pending.isPending} value={pending.data?.length} />
      </div>

      <h2 className="font-display mt-12 mb-4 text-3xl font-semibold">Needs your review</h2>
      <ReviewQueue sessions={pending.data} loading={pending.isPending} />

      <h2 className="font-display mt-12 mb-4 text-3xl font-semibold">Clients</h2>
      {clients?.length === 0 ? (
        <EmptyState icon={Users} title="No clients yet">
          Members appear here once your gym owner assigns them to you.
        </EmptyState>
      ) : (
        <Card className="p-2">
          <ul>
            {clients?.map((client) => (
              <li key={client.id}>
                <Link
                  href={`/clients/${client.id}`}
                  className="group flex items-center gap-4 rounded-2xl px-4 py-3 transition-colors hover:bg-white/[0.04]"
                >
                <Avatar name={client.name} src={client.avatarUrl} />
                <span className="font-medium">{client.name}</span>
                <span className="ml-auto hidden truncate text-sm text-muted-foreground sm:block">{client.email}</span>
                <span className="text-sm text-muted-foreground transition group-hover:text-foreground">Progress</span>
                <ChevronRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

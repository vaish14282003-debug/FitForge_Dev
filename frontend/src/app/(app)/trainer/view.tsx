"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarClock, ChevronRight, ClipboardCheck, ClipboardList, MessageSquare, Users } from "lucide-react";
import { EmptyState, PageHeader, StatCard } from "@/components/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { LatestAnnouncement, MessageClientsDialog } from "@/components/notifications/announcement-bits";
import { Agenda } from "@/components/schedule/agenda";
import { Button } from "@/components/ui/button";
import { ReviewQueue } from "@/components/workouts/review-queue";
import { Skeleton } from "@/components/ui/skeleton";
import { useClients } from "@/hooks/use-gym";
import { useBookings, useClasses } from "@/hooks/use-schedule";
import { useSessions } from "@/hooks/use-sessions";
import { localDay } from "@/lib/schedule";
import { useSession } from "@/hooks/use-session";
import { usePlans } from "@/hooks/use-workouts";
import { firstName, greeting } from "@/lib/utils";

export default function TrainerDashboard() {
  const { data: session } = useSession();
  const { data: clients, isPending: clientsPending } = useClients();
  const { data: plans, isPending: plansPending } = usePlans();
  const pending = useSessions({ pendingReview: true, limit: 20 });
  const [messaging, setMessaging] = useState(false);
  const bookings = useBookings(1);
  const classes = useClasses(1);
  const today = new Date().toLocaleDateString("en-CA");
  const todaysBookings = (bookings.data ?? []).filter((b) => b.status !== "CANCELLED" && localDay(b.startsAt) === today);
  const todaysClasses = (classes.data ?? []).filter((c) => !c.cancelledAt && c.trainer?.id === session?.user.id && localDay(c.startsAt) === today);
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
        actions={
          <Button variant="outline" disabled={!clients?.length} onClick={() => setMessaging(true)}>
            <MessageSquare className="size-4" aria-hidden />
            Message clients
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} highlight label="My clients" icon={Users} loading={clientsPending} value={clients?.length} />
        <StatCard index={1} label="Active plans" icon={ClipboardList} loading={plansPending} value={activePlans} />
        <StatCard index={2} label="Today's sessions" icon={CalendarClock} loading={bookings.isPending || classes.isPending} value={todaysBookings.length + todaysClasses.length} hint={`${todaysBookings.length} 1-on-1 · ${todaysClasses.length} class${todaysClasses.length === 1 ? "" : "es"}`} />
        <StatCard index={3} label="Pending reviews" icon={ClipboardCheck} loading={pending.isPending} value={pending.data?.length} />
      </div>

      <LatestAnnouncement />

      <div className="mt-12 mb-4 flex items-baseline justify-between">
        <h2 className="font-display text-3xl font-semibold">Today</h2>
        <Link href="/schedule" className="text-sm text-muted-foreground transition hover:text-foreground">
          Full schedule
        </Link>
      </div>
      {bookings.isPending || classes.isPending ? (
        <Skeleton className="h-24 w-full rounded-3xl" />
      ) : (
        <Agenda bookings={todaysBookings} classes={todaysClasses} viewer="trainer" emptyText="Nothing on today. Clients book from your weekly hours on the Schedule page." />
      )}

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
      <MessageClientsDialog open={messaging} clients={clients ?? []} onClose={() => setMessaging(false)} />
    </>
  );
}

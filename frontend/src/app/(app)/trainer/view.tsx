"use client";

import { CalendarClock, ClipboardCheck, ClipboardList, Users } from "lucide-react";
import { EmptyState, PageHeader, StatCard } from "@/components/stat-card";
import { Card } from "@/components/ui/card";
import { useClients } from "@/hooks/use-gym";
import { useSession } from "@/hooks/use-session";
import { firstName, greeting } from "@/lib/utils";

export default function TrainerDashboard() {
  const { data: session } = useSession();
  const { data: clients } = useClients();
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
        <StatCard index={0} highlight label="My clients" icon={Users} value={clients?.length ?? "…"} />
        <StatCard index={1} label="Active plans" icon={ClipboardList} />
        <StatCard index={2} label="Today's sessions" icon={CalendarClock} />
        <StatCard index={3} label="Pending reviews" icon={ClipboardCheck} />
      </div>

      <h2 className="font-display mt-12 mb-4 text-3xl font-semibold">Clients</h2>
      {clients?.length === 0 ? (
        <EmptyState icon={Users} title="No clients yet">
          Members appear here once your gym owner assigns them to you.
        </EmptyState>
      ) : (
        <Card className="p-2">
          <ul>
            {clients?.map((client) => (
              <li
                key={client.id}
                className="flex items-center gap-4 rounded-2xl px-4 py-3 transition-colors hover:bg-white/[0.04]"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-accent-text">
                  {client.name.charAt(0).toUpperCase()}
                </span>
                <span className="font-medium">{client.name}</span>
                <span className="ml-auto truncate text-sm text-muted-foreground">{client.email}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

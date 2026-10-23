"use client";

import { Building2, CalendarCheck, Dumbbell, Flame, UserRound } from "lucide-react";
import { EmptyState, PageHeader, StatCard } from "@/components/stat-card";
import { TodaysWorkout } from "@/components/workouts/todays-workout";
import { useGym } from "@/hooks/use-gym";
import { useSession } from "@/hooks/use-session";
import { usePlans } from "@/hooks/use-workouts";
import { firstName, greeting } from "@/lib/utils";

export default function MemberDashboard() {
  const { data: session } = useSession();
  const { data: gym } = useGym();
  const { data: plans, isPending: plansPending } = usePlans();
  if (!session) return null;
  const { user } = session;

  return (
    <>
      <PageHeader
        eyebrow={gym ? `Member at ${gym.name}` : "Member"}
        title={
          <>
            {greeting()}, <span className="text-primary">{firstName(user.name)}</span>
          </>
        }
        subtitle="Stronger every day starts here. This is where you stand today."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} highlight label="Your gym" icon={Building2} value={gym?.name ?? "…"} />
        <StatCard index={1} label="Your trainer" icon={UserRound} value={user.trainer?.name ?? "Not assigned"} />
        <StatCard index={2} label="Streak" icon={Flame} />
        <StatCard index={3} label="Attendance" icon={CalendarCheck} />
      </div>
      <div className="mt-6">
        {plansPending ? null : plans?.[0] ? (
          <TodaysWorkout plan={plans[0]} />
        ) : (
          <EmptyState icon={Dumbbell} title="No workout assigned yet">
            Once your trainer assigns a plan, today&apos;s workout will show up here.
          </EmptyState>
        )}
      </div>
    </>
  );
}

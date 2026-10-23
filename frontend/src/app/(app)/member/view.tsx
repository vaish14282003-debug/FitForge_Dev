"use client";

import { CalendarCheck, Dumbbell, Flame, MapPin, UserRound } from "lucide-react";
import { EmptyState, PageHeader, StatCard } from "@/components/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { TodaysWorkout } from "@/components/workouts/todays-workout";
import { RecentPrs, WeekActivity } from "@/components/workouts/training-cards";
import { useAttendanceSummary } from "@/hooks/use-attendance";
import { useGym } from "@/hooks/use-gym";
import { useTrainingSummary } from "@/hooks/use-sessions";
import { useSession } from "@/hooks/use-session";
import { usePlans } from "@/hooks/use-workouts";
import { firstName, greeting } from "@/lib/utils";

export default function MemberDashboard() {
  const { data: session } = useSession();
  const { data: gym } = useGym();
  const { data: plans, isPending: plansPending } = usePlans();
  const { data: summary, isPending: summaryPending } = useTrainingSummary();
  const visits = useAttendanceSummary();
  if (!session) return null;
  const { user } = session;

  const plan = plans?.[0];
  const next = summary?.nextUp.find((n) => n.planId === plan?.id);
  const weekCount = summary?.week.reduce((n, d) => n + d.count, 0);

  const streakHint = !summary
    ? undefined
    : summary.trainedToday
      ? "Done today. Back tomorrow to extend it"
      : summary.streak > 0
        ? "Train today to keep it alive"
        : "Finish a workout to start one";

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
        <StatCard
          index={0}
          highlight
          label="Day streak"
          icon={Flame}
          loading={summaryPending}
          value={summary?.streak}
          hint={streakHint}
        />
        <StatCard index={1} label="This week" icon={CalendarCheck} loading={summaryPending} value={weekCount} hint="workouts in the last 7 days" />
        <StatCard
          index={2}
          label="Gym visits"
          icon={MapPin}
          loading={visits.isPending}
          value={visits.data?.thisMonth}
          hint={
            visits.data?.checkedInToday && visits.data.todayAt
              ? `this month · checked in at ${new Date(visits.data.todayAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
              : "this month · scan the desk QR when you arrive"
          }
        />
        <StatCard index={3} label="Your trainer" icon={UserRound} value={user.trainer?.name ?? "Not assigned"} />
      </div>

      <div className="mt-6">
        {plansPending || summaryPending ? (
          <Skeleton className="h-72 w-full rounded-3xl" />
        ) : plan ? (
          <TodaysWorkout plan={plan} dayIndex={next?.dayIndex ?? 0} trainedToday={!!summary?.trainedToday} />
        ) : (
          <EmptyState icon={Dumbbell} title="No workout assigned yet">
            Once your trainer assigns a plan, today&apos;s workout will show up here.
          </EmptyState>
        )}
      </div>

      {summary && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <WeekActivity week={summary.week} />
          <RecentPrs prs={summary.recentPrs} />
        </div>
      )}
    </>
  );
}

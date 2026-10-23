"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { CalendarCheck, CalendarDays, ChevronRight, CircleAlert, CreditCard, Dumbbell, Flame, MapPin } from "lucide-react";
import { EmptyState, PageHeader, StatCard } from "@/components/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { TodaysWorkout } from "@/components/workouts/todays-workout";
import { RecentPrs, WeekActivity } from "@/components/workouts/training-cards";
import { useAttendanceSummary } from "@/hooks/use-attendance";
import { useGym } from "@/hooks/use-gym";
import { useMyMembership } from "@/hooks/use-memberships";
import { useBookings, useClasses } from "@/hooks/use-schedule";
import { dayLabel, formatTime } from "@/lib/schedule";
import { formatDay, STANDING_LABEL } from "@/lib/membership";
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
  const membership = useMyMembership();
  const bookings = useBookings(14);
  const classes = useClasses(14);
  if (!session) return null;
  const { user } = session;

  // The next thing on the member's calendar: a 1-on-1 or a class they joined.
  const now = new Date();
  const nextUp = [
    ...(bookings.data ?? []).filter((b) => b.status === "BOOKED" && new Date(b.startsAt) > now).map((b) => ({ at: b.startsAt, label: `1-on-1 with ${b.trainer.name}` })),
    ...(classes.data ?? [])
      .filter((c) => !c.cancelledAt && c.attendees.includes(user.id) && new Date(c.startsAt) > now)
      .map((c) => ({ at: c.startsAt, label: `${c.title}${c.location ? ` · ${c.location}` : ""}` })),
  ].sort((a, b) => a.at.localeCompare(b.at))[0];

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
        eyebrow={[gym ? `Member at ${gym.name}` : "Member", user.trainer && `Trainer: ${user.trainer.name}`].filter(Boolean).join(" · ")}
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
        <StatCard
          index={3}
          label="Membership"
          icon={CreditCard}
          loading={membership.isPending}
          value={membership.data ? STANDING_LABEL[membership.data.status] : undefined}
          hint={
            membership.data?.current
              ? `${membership.data.current.planName} · until ${formatDay((membership.data.upcoming ?? membership.data.current).endDate, true)}`
              : membership.data?.latest
                ? `Ended ${formatDay(membership.data.latest.endDate, true)}`
                : "Ask at the front desk"
          }
        />
      </div>

      <Link
        href="/schedule"
        className="group mt-6 flex items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20 sm:p-5"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sky-500/15 text-sky-300">
          <CalendarDays className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-muted-foreground">Up next</span>
          <span className="block truncate font-semibold">
            {nextUp ? `${dayLabel(nextUp.at)}, ${formatTime(nextUp.at)} · ${nextUp.label}` : "Nothing booked. Book a session or join a class"}
          </span>
        </span>
        <ChevronRight className="size-5 text-muted-foreground transition group-hover:translate-x-0.5" aria-hidden />
      </Link>

      {(membership.data?.status === "EXPIRING" || membership.data?.status === "EXPIRED") && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          role="status"
          className="mt-6 flex items-start gap-3 rounded-3xl border border-amber-400/30 bg-amber-400/10 p-4 sm:items-center sm:p-5"
        >
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-amber-300 sm:mt-0" aria-hidden />
          <p className="text-sm">
            {membership.data.status === "EXPIRING" && membership.data.current ? (
              <>
                Your {membership.data.current.planName.toLowerCase()} membership ends{" "}
                <strong>{membership.data.current.daysLeft === 0 ? "today" : `in ${membership.data.current.daysLeft} day${membership.data.current.daysLeft === 1 ? "" : "s"}`}</strong>{" "}
                ({formatDay(membership.data.current.endDate)}). Renew at the front desk to keep training without a break.
              </>
            ) : (
              <>Your membership has ended. Renew at the front desk to pick up where you left off.</>
            )}
          </p>
        </motion.div>
      )}

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

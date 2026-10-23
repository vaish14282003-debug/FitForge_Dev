"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarCheck, CalendarClock, Check, ClipboardList, Copy, IdCard, IndianRupee, RefreshCw, ScanLine, UserCog, Users } from "lucide-react";
import { ChartCard, DataTable, shortDate } from "@/components/progress/chart-card";
import { CheckInChart, RevenueChart } from "@/components/progress/charts";
import { PageHeader, StatCard } from "@/components/stat-card";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useAttendanceStats } from "@/hooks/use-attendance";
import { useGym, useGymOverview, useRotateJoinCode } from "@/hooks/use-gym";
import { useMembershipOverview } from "@/hooks/use-memberships";
import { formatDay, formatINR } from "@/lib/membership";

function JoinCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const rotate = useRotateJoinCode();
  const toast = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast({ title: "Join code copied", description: "Share it with new members." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Couldn't copy", description: "Select the code and copy it manually.", tone: "error" });
    }
  }

  function newCode() {
    if (!confirmRotate) {
      setConfirmRotate(true);
      setTimeout(() => setConfirmRotate(false), 4000);
      return;
    }
    rotate.mutate(undefined, {
      onSuccess: (gym) => {
        setConfirmRotate(false);
        toast({ title: "New join code created", description: `The old code no longer works. New code: ${gym.joinCode}` });
      },
    });
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.35 }}
      className="relative mt-6 flex flex-wrap items-center justify-between gap-6 overflow-hidden rounded-3xl bg-linear-to-br from-primary to-[#a8130a] p-8 shadow-[0_30px_60px_-30px_var(--primary)]"
    >
      <div className="pointer-events-none absolute -right-16 -bottom-24 size-72 rounded-full border-[28px] border-white/10" aria-hidden />
      <div className="relative">
        <p className="text-sm font-medium text-white/80">Member join code</p>
        <p className="mt-2 font-mono text-4xl font-bold tracking-[0.3em]">{code}</p>
        <p className="mt-3 max-w-md text-sm text-white/80">
          Members enter this code when they sign up, and land straight in your gym. Make a new one if the old
          code was shared too widely; existing members stay put.
        </p>
      </div>
      <div className="relative flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="border-white/30 bg-white/10 hover:bg-white/20"
          loading={rotate.isPending}
          onClick={newCode}
        >
          {!rotate.isPending && <RefreshCw className="size-4" aria-hidden />}
          {confirmRotate ? "Tap again to replace" : "New code"}
        </Button>
        <Button className="bg-white text-black shadow-none hover:bg-white/90 hover:brightness-100" onClick={copy}>
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? "Copied" : "Copy code"}
        </Button>
      </div>
    </motion.section>
  );
}

export default function OwnerDashboard() {
  const { data: gym } = useGym();
  const { data: overview, isPending } = useGymOverview();
  const attendance = useAttendanceStats(14, true);
  const memberships = useMembershipOverview();
  const revenue = memberships.data?.revenue;
  const revenueChange = revenue ? revenue.thisMonth - revenue.lastMonth : 0;

  return (
    <>
      <PageHeader
        eyebrow="Gym overview"
        title={
          gym ? (
            <>
              <span className="text-primary">{gym.name}</span> at a glance
            </>
          ) : (
            "Your gym at a glance"
          )
        }
        subtitle="Members, trainers and the numbers that keep your gym running."
        actions={
          <Link href="/plans" className={buttonClass({ variant: "outline" })}>
            <ClipboardList className="size-4" aria-hidden />
            Training plans
          </Link>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard index={0} highlight label="Members" icon={Users} loading={isPending} value={overview?.members} />
        <StatCard index={1} label="Trainers" icon={UserCog} loading={isPending} value={overview?.trainers} />
        <StatCard index={2} label="Staff" icon={IdCard} loading={isPending} value={overview?.staff} />
        <StatCard
          index={3}
          label="Monthly revenue"
          icon={IndianRupee}
          loading={memberships.isPending}
          value={revenue ? formatINR(revenue.thisMonth) : undefined}
          hint={revenue ? `${revenueChange >= 0 ? "+" : "−"}${formatINR(Math.abs(revenueChange))} vs last month` : undefined}
        />
        <StatCard index={4} label="Today's attendance" icon={CalendarCheck} loading={attendance.isPending} value={attendance.data?.today} hint="members checked in" />
        <StatCard
          index={5}
          label="Expiring memberships"
          icon={CalendarClock}
          loading={memberships.isPending}
          value={memberships.data?.expiringSoon.length}
          hint={memberships.data ? `in the next ${memberships.data.expiringDays} days` : undefined}
        />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Revenue"
          subtitle={revenue ? `${formatINR(revenue.months.reduce((n, m) => n + m.amount, 0))} collected over 6 months` : "Membership payments collected per month"}
          table={<DataTable head={["Month", "Payments", "Collected"]} rows={[...(revenue?.months ?? [])].reverse().map((m) => [m.month, m.count, formatINR(m.amount)])} />}
        >
          {memberships.isPending ? <Skeleton className="h-60 w-full" /> : <RevenueChart months={revenue!.months} />}
        </ChartCard>
        <Card className="flex flex-col">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-2xl font-semibold">Expiring soon</h2>
            <Link href="/memberships?filter=expiring" className="text-sm text-muted-foreground transition hover:text-foreground">
              See all
            </Link>
          </div>
          {memberships.isPending ? (
            <Skeleton className="mt-4 h-40 w-full" />
          ) : memberships.data!.expiringSoon.length === 0 ? (
            <p className="mt-4 flex-1 text-sm text-muted-foreground">Nobody&apos;s membership ends in the next week.</p>
          ) : (
            <ul className="mt-4 flex-1 space-y-1">
              {memberships.data!.expiringSoon.slice(0, 5).map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-2xl px-2 py-2">
                  <span className="grid size-9 place-items-center rounded-full bg-amber-400/15 text-sm font-semibold text-amber-300">
                    {m.member.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{m.member.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {m.planName} · ends {formatDay(m.endDate)}
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-amber-300">{m.daysLeft === 0 ? "today" : `${m.daysLeft}d`}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/memberships?filter=expiring" className={buttonClass({ size: "sm", className: "mt-4 w-full" })}>
            Renew memberships
          </Link>
        </Card>
      </div>

      {gym?.joinCode ? <JoinCode code={gym.joinCode} /> : null}

      <ChartCard
        className="mt-6"
        title="Check-ins"
        subtitle={
          attendance.data
            ? `${attendance.data.daily.reduce((n, d) => n + d.count, 0)} visits over the last 14 days`
            : "Daily visits over the last 14 days"
        }
        actions={
          <Link href="/front-desk" className={buttonClass({ size: "sm" })}>
            <ScanLine className="size-4" aria-hidden />
            Open front desk
          </Link>
        }
        table={<DataTable head={["Day", "Check-ins"]} rows={[...(attendance.data?.daily ?? [])].reverse().map((d) => [shortDate(d.day), d.count])} />}
      >
        {attendance.isPending ? <Skeleton className="h-56 w-full" /> : <CheckInChart daily={attendance.data!.daily} />}
      </ChartCard>
    </>
  );
}

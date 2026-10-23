"use client";

import { useDeferredValue, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Archive, BadgeIndianRupee, CalendarClock, CreditCard, History, Pencil, Plus, RotateCcw, Search, Users } from "lucide-react";
import { HistoryDialog, MarkPaidDialog, PlanDialog } from "@/components/memberships/membership-dialogs";
import { Avatar } from "@/components/ui/avatar";
import { SellDialog } from "@/components/memberships/sell-dialog";
import { EmptyState, PageHeader, StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useMembershipOverview, useMembershipPlans, useRoster, useSavePlan } from "@/hooks/use-memberships";
import { useSession } from "@/hooks/use-session";
import { can } from "@/lib/access";
import { durationLabel, formatDay, formatINR, STANDING_LABEL } from "@/lib/membership";
import type { Membership, MembershipPlan, RosterEntry, Standing } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filter = "ALL" | Standing | "PENDING";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "EXPIRING", label: "Expiring" },
  { value: "ACTIVE", label: "Active" },
  { value: "EXPIRED", label: "Expired" },
  { value: "NONE", label: "No membership" },
  { value: "PENDING", label: "Payment pending" },
];

const STANDING_STYLE: Record<Standing, string> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-400",
  EXPIRING: "bg-amber-400/15 text-amber-300",
  UPCOMING: "bg-sky-500/15 text-sky-300",
  EXPIRED: "bg-primary/15 text-accent-text",
  NONE: "bg-white/[0.06] text-muted-foreground",
};

function detail(entry: RosterEntry) {
  const { current, upcoming, latest } = entry;
  switch (entry.status) {
    case "ACTIVE":
      return upcoming ? `${current!.planName} · renewed to ${formatDay(upcoming.endDate, true)}` : `${current!.planName} · until ${formatDay(current!.endDate, true)}`;
    case "EXPIRING":
      return `${current!.planName} · ${current!.daysLeft === 0 ? "ends today" : `${current!.daysLeft} day${current!.daysLeft === 1 ? "" : "s"} left`}`;
    case "UPCOMING":
      return `${upcoming!.planName} · starts ${formatDay(upcoming!.startDate)}`;
    case "EXPIRED":
      return `${latest!.planName} · ended ${formatDay(latest!.endDate, true)}`;
    default:
      return "Never had a membership";
  }
}

/** The first pending payment for a roster entry, if any. */
const pendingOf = (entry: RosterEntry): Membership | null =>
  [entry.current, entry.upcoming, entry.latest].find((m) => m?.payment.status === "PENDING") ?? null;

function MembersTab() {
  const initial = (useSearchParams().get("filter")?.toUpperCase() as Filter) || "ALL";
  const [filter, setFilter] = useState<Filter>(FILTERS.some((f) => f.value === initial) ? initial : "ALL");
  const [q, setQ] = useState("");
  const deferred = useDeferredValue(q.trim().toLowerCase());
  const roster = useRoster();
  const [selling, setSelling] = useState<RosterEntry | null>(null);
  const [paying, setPaying] = useState<{ membership: Membership; name: string } | null>(null);
  const [history, setHistory] = useState<{ id: string; name: string } | null>(null);

  const entries = roster.data?.roster ?? [];
  const counts = Object.fromEntries(
    FILTERS.map((f) => [f.value, f.value === "ALL" ? entries.length : f.value === "PENDING" ? entries.filter((e) => e.pendingPayments).length : entries.filter((e) => e.status === f.value).length]),
  );
  const shown = entries
    .filter((e) => (filter === "ALL" ? true : filter === "PENDING" ? e.pendingPayments > 0 : e.status === filter))
    .filter((e) => !deferred || e.member.name.toLowerCase().includes(deferred) || e.member.email.toLowerCase().includes(deferred))
    // Most urgent first: expiring, then expired, then the rest by name.
    .sort((a, b) => {
      const rank = (s: Standing) => ["EXPIRING", "EXPIRED", "NONE", "UPCOMING", "ACTIVE"].indexOf(s);
      return rank(a.status) - rank(b.status) || a.member.name.localeCompare(b.member.name);
    });

  return (
    <>
      <div className="mb-6 space-y-4">
        <label className="relative block">
          <span className="sr-only">Search members</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search members"
            className="h-12 w-full rounded-full border border-white/10 bg-white/[0.04] pr-4 pl-11 text-[15px] transition placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:outline-none"
          />
        </label>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filter members">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                filter === f.value ? "border-primary bg-primary text-white" : "border-white/10 bg-white/[0.04] text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
              <span className={cn("rounded-full px-1.5 text-xs", filter === f.value ? "bg-white/20" : "bg-white/10")}>{counts[f.value] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {roster.isPending ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-3xl" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <EmptyState icon={Users} title="Nobody here">
          {filter === "ALL" ? "No members match that search." : "No members in this group right now."}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {shown.map((entry, i) => {
            const pending = pendingOf(entry);
            return (
              <motion.li
                key={entry.member.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 10) * 0.03 }}
                className="flex flex-wrap items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl sm:p-5"
              >
                <Avatar name={entry.member.name} src={entry.member.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold">{entry.member.name}</span>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STANDING_STYLE[entry.status])}>{STANDING_LABEL[entry.status]}</span>
                    {pending && <span className="rounded-full bg-amber-400/15 px-2.5 py-0.5 text-xs font-medium text-amber-300">{formatINR(pending.price)} due</span>}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{detail(entry)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {entry.latest && (
                    <Button size="sm" variant="ghost" aria-label={`History for ${entry.member.name}`} onClick={() => setHistory({ id: entry.member.id, name: entry.member.name })}>
                      <History className="size-4" aria-hidden />
                    </Button>
                  )}
                  {pending && (
                    <Button size="sm" variant="outline" onClick={() => setPaying({ membership: pending, name: entry.member.name })}>
                      <BadgeIndianRupee className="size-4" aria-hidden />
                      Record payment
                    </Button>
                  )}
                  <Button size="sm" variant={entry.status === "EXPIRING" || entry.status === "EXPIRED" || entry.status === "NONE" ? "primary" : "outline"} onClick={() => setSelling(entry)}>
                    {entry.latest ? <RotateCcw className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                    {entry.latest ? "Renew" : "Add membership"}
                  </Button>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}

      <SellDialog entry={selling} onClose={() => setSelling(null)} />
      <MarkPaidDialog key={paying?.membership.id} membership={paying?.membership ?? null} memberName={paying?.name ?? ""} onClose={() => setPaying(null)} />
      <HistoryDialog member={history} onClose={() => setHistory(null)} />
    </>
  );
}

function PlansTab({ canEdit }: { canEdit: boolean }) {
  const plans = useMembershipPlans();
  const save = useSavePlan();
  const toast = useToast();
  const [editing, setEditing] = useState<{ plan: MembershipPlan | null } | null>(null);

  return (
    <>
      {canEdit && (
        <div className="mb-6 flex justify-end">
          <Button onClick={() => setEditing({ plan: null })}>
            <Plus className="size-4" aria-hidden />
            New plan
          </Button>
        </div>
      )}
      {plans.isPending ? (
        <Skeleton className="h-48 w-full rounded-3xl" />
      ) : plans.data?.length === 0 ? (
        <EmptyState icon={CreditCard} title="No plans yet">
          {canEdit ? "Create your first plan, like Monthly or Quarterly, to start selling memberships." : "The owner hasn't set up any plans yet."}
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {plans.data?.map((plan, i) => (
            <motion.div key={plan.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className={cn("flex h-full flex-col", !plan.isActive && "opacity-60")}>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold">{plan.name}</h2>
                  {!plan.isActive && <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs text-muted-foreground">Archived</span>}
                </div>
                <p className="font-display mt-3 text-4xl font-semibold">{formatINR(plan.price)}</p>
                <p className="text-sm text-muted-foreground">
                  {durationLabel(plan.durationMonths)}
                  {plan.durationMonths > 1 ? ` · ${formatINR(Math.round(plan.price / plan.durationMonths))}/month` : ""}
                </p>
                {plan.description ? <p className="mt-3 flex-1 text-sm text-muted-foreground">{plan.description}</p> : <span className="flex-1" />}
                {canEdit && (
                  <div className="mt-5 flex gap-2 border-t border-white/10 pt-4">
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ plan })}>
                      <Pencil className="size-4" aria-hidden />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground"
                      loading={save.isPending && save.variables?.id === plan.id}
                      onClick={() =>
                        save.mutate(
                          { id: plan.id, isActive: !plan.isActive },
                          { onSuccess: (p) => toast({ title: p.isActive ? `${p.name} is on sale again` : `${p.name} archived`, description: p.isActive ? undefined : "Existing memberships are unaffected." }) },
                        )
                      }
                    >
                      {plan.isActive ? <Archive className="size-4" aria-hidden /> : <RotateCcw className="size-4" aria-hidden />}
                      {plan.isActive ? "Archive" : "Restore"}
                    </Button>
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      )}
      <PlanDialog plan={editing?.plan ?? null} open={!!editing} onClose={() => setEditing(null)} />
    </>
  );
}

export default function MembershipsPage() {
  const { data: session } = useSession();
  const overview = useMembershipOverview();
  const [tab, setTab] = useState<"members" | "plans">("members");
  const isOwner = !!session && can(session, "gym:settings");
  const o = overview.data;

  return (
    <>
      <PageHeader
        eyebrow="Front desk & billing"
        title={
          <>
            <span className="text-primary">Memberships</span>
          </>
        }
        subtitle="Who's active, who's about to lapse, and who still owes. Renewals continue right where the last membership ends."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} highlight label="Active members" icon={Users} loading={overview.isPending} value={o?.activeMembers} hint="with a current membership" />
        <StatCard index={1} label="Expiring soon" icon={CalendarClock} loading={overview.isPending} value={o?.expiringSoon.length} hint={o ? `in the next ${o.expiringDays} days` : undefined} />
        <StatCard
          index={2}
          label="Payments due"
          icon={BadgeIndianRupee}
          loading={overview.isPending}
          value={o ? formatINR(o.pendingPayments.amount) : undefined}
          hint={o ? `${o.pendingPayments.count} pending` : undefined}
        />
        {isOwner ? (
          <StatCard index={3} label="Revenue this month" icon={CreditCard} loading={overview.isPending} value={o?.revenue ? formatINR(o.revenue.thisMonth) : undefined} hint={o?.revenue ? `${formatINR(o.revenue.lastMonth)} last month` : undefined} />
        ) : (
          <StatCard index={3} label="Lapsed (30 days)" icon={History} loading={overview.isPending} value={o?.recentlyExpired} hint="haven't renewed yet" />
        )}
      </div>

      <div className="mb-6 flex w-fit gap-1 rounded-full border border-white/10 bg-white/5 p-1" role="tablist">
        {(
          [
            ["members", "Members"],
            ["plans", "Plans"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "rounded-full px-5 py-2 text-sm font-medium transition",
              tab === value ? "bg-primary text-white shadow-[0_6px_20px_-8px_var(--primary)]" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "members" ? <MembersTab /> : <PlansTab canEdit={isOwner} />}
    </>
  );
}

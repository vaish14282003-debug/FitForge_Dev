"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, ClipboardList, Clock, Dumbbell, Layers, Plus } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/stat-card";
import { buttonClass } from "@/components/ui/button";
import { Tag } from "@/components/workouts/exercise-bits";
import { useSession } from "@/hooks/use-session";
import { usePlans } from "@/hooks/use-workouts";
import { can } from "@/lib/access";
import { estimateMinutes } from "@/lib/workout";

function Avatars({ people }: { people: { id: string; name: string }[] }) {
  if (people.length === 0) return <span className="text-sm text-muted-foreground">Not assigned yet</span>;
  const shown = people.slice(0, 4);
  return (
    <span className="flex items-center">
      {shown.map((p, i) => (
        <span
          key={p.id}
          title={p.name}
          className="grid size-8 place-items-center rounded-full bg-[#2a1312] text-xs font-semibold text-accent-text ring-2 ring-background"
          style={{ marginLeft: i === 0 ? 0 : -8 }}
        >
          {p.name.charAt(0).toUpperCase()}
        </span>
      ))}
      <span className="ml-2 text-sm text-muted-foreground">
        {people.length === 1 ? people[0].name : `${people.length} members`}
      </span>
    </span>
  );
}

export default function PlansList() {
  const { data: session } = useSession();
  const { data: plans, isPending } = usePlans();
  const ownerLevel = !!session && can(session, "gym:settings");

  const newPlan = (
    <Link href="/plans/new" className={buttonClass()}>
      <Plus className="size-4" aria-hidden />
      New plan
    </Link>
  );

  return (
    <>
      <PageHeader
        eyebrow={ownerLevel ? "All plans in your gym" : "Your plans"}
        title={
          <>
            Workout <span className="text-primary">plans</span>
          </>
        }
        subtitle="Build a plan once, then assign it to as many clients as you like."
        actions={newPlan}
      />

      {!isPending && plans?.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No plans yet">
          Create your first plan: add training days, fill them with exercises, and assign it to a client.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(plans ?? []).map((plan, i) => {
            const exercises = plan.days.reduce((n, d) => n + d.exercises.length, 0);
            const avgMinutes = Math.round(plan.days.reduce((n, d) => n + estimateMinutes(d), 0) / Math.max(1, plan.days.length));
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.05 }}
              >
                <Link
                  href={`/plans/${plan.id}`}
                  className="group block h-full rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_20px_50px_-30px_var(--primary)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="font-display truncate text-2xl font-semibold">{plan.name}</h2>
                      {plan.description ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{plan.description}</p>
                      ) : null}
                    </div>
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/[0.06] transition group-hover:bg-primary group-hover:text-white">
                      <ArrowUpRight className="size-4" aria-hidden />
                    </span>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {plan.days.map((day, d) => (
                      <Tag key={`${day.name}-${d}`} tone="red">
                        {day.name}
                      </Tag>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Layers className="size-4" aria-hidden />
                      {plan.days.length} {plan.days.length === 1 ? "day" : "days"}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Dumbbell className="size-4" aria-hidden />
                      {exercises} exercises
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="size-4" aria-hidden />~{avgMinutes} min / session
                    </span>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                    <Avatars people={plan.assignedTo} />
                    {ownerLevel && <span className="text-xs text-muted-foreground">by {plan.createdBy.name}</span>}
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </>
  );
}

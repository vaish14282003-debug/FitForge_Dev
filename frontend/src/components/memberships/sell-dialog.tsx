"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { FormError } from "@/components/auth/auth-card";
import { MethodChips, referenceInputClass } from "@/components/memberships/payment-fields";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useMembershipPlans, useRenewMembership, useSellMembership } from "@/hooks/use-memberships";
import { addDay, durationLabel, formatDay, formatINR, previewEnd } from "@/lib/membership";
import type { PaymentMethod, RosterEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const todayKey = () => new Date().toLocaleDateString("en-CA");

/** Sells a first membership, or renews from where the member's latest one ends. */
export function SellDialog({ entry, onClose }: { entry: RosterEntry | null; onClose: () => void }) {
  return (
    <Dialog
      open={!!entry}
      onClose={onClose}
      title={entry?.latest ? `Renew ${entry.member.name.split(" ")[0]}` : `Membership for ${entry?.member.name.split(" ")[0] ?? ""}`}
      description={entry?.member.email}
      className="max-w-xl"
    >
      {entry && <SellForm key={entry.member.id} entry={entry} onDone={onClose} />}
    </Dialog>
  );
}

function SellForm({ entry, onDone }: { entry: RosterEntry; onDone: () => void }) {
  const plans = useMembershipPlans();
  const active = (plans.data ?? []).filter((p) => p.isActive);
  const renewing = !!entry.latest;
  const [planId, setPlanId] = useState<string | null>(entry.latest?.plan ?? null);
  const [startDate, setStartDate] = useState(todayKey);
  const [paid, setPaid] = useState(true);
  const [method, setMethod] = useState<PaymentMethod | null>("UPI");
  const [reference, setReference] = useState("");
  const sell = useSellMembership();
  const renew = useRenewMembership();
  const toast = useToast();
  const mutation = renewing ? renew : sell;

  const plan = active.find((p) => p.id === planId) ?? active[0];
  // Renewals continue the day after the latest period ends, or today if it has lapsed.
  const latestEnd = entry.upcoming?.endDate ?? entry.latest?.endDate;
  const start = renewing && latestEnd ? (addDay(latestEnd) > todayKey() ? addDay(latestEnd) : todayKey()) : startDate;
  const end = plan ? previewEnd(start, plan.durationMonths) : null;

  function submit() {
    if (!plan) return;
    const payment = paid ? { status: "PAID" as const, method, reference } : { status: "PENDING" as const, reference };
    const onSuccess = () => {
      toast({
        title: renewing ? "Membership renewed" : "Membership added",
        description: `${entry.member.name}: ${plan.name}, ${formatDay(start)} to ${formatDay(end!, true)}${paid ? "" : " · payment pending"}`,
      });
      onDone();
    };
    if (renewing) {
      const base = entry.upcoming ?? entry.current ?? entry.latest!;
      renew.mutate({ id: base.id, planId: plan.id, payment }, { onSuccess });
    } else {
      sell.mutate({ memberId: entry.member.id, planId: plan.id, startDate, payment }, { onSuccess });
    }
  }

  if (plans.isSuccess && active.length === 0) {
    return <p className="text-sm text-muted-foreground">There are no plans on sale yet. The owner can add them on the Plans tab.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm font-medium">Plan</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {active.map((p) => {
            const selected = p.id === plan?.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlanId(p.id)}
                aria-pressed={selected}
                className={cn(
                  "relative rounded-2xl border p-4 text-left transition",
                  selected ? "border-primary bg-primary/10" : "border-white/10 bg-white/[0.03] hover:border-white/25",
                )}
              >
                {selected && (
                  <span className="absolute top-3 right-3 grid size-5 place-items-center rounded-full bg-primary text-white">
                    <Check className="size-3" aria-hidden />
                  </span>
                )}
                <span className="block font-semibold">{p.name}</span>
                <span className="font-display mt-1 block text-2xl font-semibold">{formatINR(p.price)}</span>
                <span className="block text-xs text-muted-foreground">
                  {durationLabel(p.durationMonths)}
                  {p.durationMonths > 1 ? ` · ${formatINR(Math.round(p.price / p.durationMonths))}/month` : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {!renewing && (
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Starts on</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={referenceInputClass} />
        </label>
      )}

      <div>
        <p className="mb-3 text-sm font-medium">Payment</p>
        <div className="mb-3 flex rounded-full border border-white/10 bg-white/5 p-1" role="radiogroup" aria-label="Payment status">
          {[
            [true, "Paid now"],
            [false, "Pay later"],
          ].map(([value, label]) => (
            <button
              key={String(value)}
              type="button"
              role="radio"
              aria-checked={paid === value}
              onClick={() => setPaid(value as boolean)}
              className={cn("flex-1 rounded-full py-2 text-sm font-medium transition", paid === value ? "bg-white text-black" : "text-muted-foreground")}
            >
              {label as string}
            </button>
          ))}
        </div>
        {paid && (
          <div className="space-y-3">
            <MethodChips value={method} onChange={setMethod} />
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              maxLength={100}
              placeholder="Reference, e.g. UPI transaction ID (optional)"
              className={referenceInputClass}
            />
          </div>
        )}
      </div>

      {plan && end && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-sm">
              {formatDay(start, true)} <ArrowRight className="size-4 text-muted-foreground" aria-hidden /> {formatDay(end, true)}
            </span>
            <span className="font-display text-2xl font-semibold">{formatINR(plan.price)}</span>
          </div>
          {renewing && latestEnd && (
            <p className="mt-1 text-xs text-muted-foreground">Continues straight after the current membership ({formatDay(latestEnd)}).</p>
          )}
        </div>
      )}

      <FormError message={mutation.error?.message} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button loading={mutation.isPending} disabled={!plan || (paid && !method)} onClick={submit}>
          {renewing ? "Renew" : "Add membership"}
          {plan ? ` · ${formatINR(plan.price)}` : ""}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Ban } from "lucide-react";
import { FormError } from "@/components/auth/auth-card";
import { MethodChips, referenceInputClass } from "@/components/memberships/payment-fields";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useCancelMembership, useMarkPaid, useMemberMemberships, useSavePlan } from "@/hooks/use-memberships";
import { durationLabel, formatDay, formatINR, PAYMENT_METHODS } from "@/lib/membership";
import type { Membership, MembershipPlan, PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MarkPaidDialog({ membership, memberName, onClose }: { membership: Membership | null; memberName: string; onClose: () => void }) {
  const [method, setMethod] = useState<PaymentMethod | null>("UPI");
  const [reference, setReference] = useState("");
  const markPaid = useMarkPaid();
  const toast = useToast();

  return (
    <Dialog
      open={!!membership}
      onClose={onClose}
      title="Record payment"
      description={membership ? `${memberName} · ${membership.planName} · ${formatINR(membership.price)}` : undefined}
    >
      {membership && (
        <div className="space-y-5">
          <MethodChips value={method} onChange={setMethod} />
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Reference (optional)" className={referenceInputClass} />
          <FormError message={markPaid.error?.message} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              loading={markPaid.isPending}
              disabled={!method}
              onClick={() =>
                markPaid.mutate(
                  { id: membership.id, method: method!, reference },
                  {
                    onSuccess: () => {
                      toast({ title: "Payment recorded", description: `${formatINR(membership.price)} from ${memberName}` });
                      onClose();
                    },
                  },
                )
              }
            >
              Mark {formatINR(membership.price)} paid
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

const STATUS_STYLE: Record<Membership["status"], string> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-400",
  UPCOMING: "bg-sky-500/15 text-sky-300",
  EXPIRED: "bg-white/[0.06] text-muted-foreground",
  CANCELLED: "bg-white/[0.06] text-muted-foreground line-through",
};

export function HistoryDialog({ member, onClose }: { member: { id: string; name: string } | null; onClose: () => void }) {
  const history = useMemberMemberships(member?.id ?? null);
  const cancel = useCancelMembership();
  const toast = useToast();
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <Dialog open={!!member} onClose={onClose} title={member ? `${member.name}'s memberships` : ""} className="max-w-xl">
      {history.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : history.data?.length === 0 ? (
        <p className="text-sm text-muted-foreground">No memberships yet.</p>
      ) : (
        <ul className="space-y-2">
          {history.data?.map((m) => (
            <li key={m.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">
                  {m.planName} <span className="font-normal text-muted-foreground">· {formatINR(m.price)}</span>
                </span>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_STYLE[m.status])}>{m.status.toLowerCase()}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatDay(m.startDate, true)} – {formatDay(m.endDate, true)} ·{" "}
                {m.payment.status === "PAID"
                  ? `paid by ${PAYMENT_METHODS.find((p) => p.value === m.payment.method)?.label ?? "—"}${m.payment.reference ? ` (${m.payment.reference})` : ""}`
                  : "payment pending"}
              </p>
              {(m.status === "ACTIVE" || m.status === "UPCOMING") && (
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn("mt-2 -ml-3", confirming === m.id ? "text-accent-text" : "text-muted-foreground")}
                  loading={cancel.isPending && cancel.variables === m.id}
                  onClick={() => {
                    if (confirming !== m.id) {
                      setConfirming(m.id);
                      setTimeout(() => setConfirming(null), 4000);
                      return;
                    }
                    cancel.mutate(m.id, { onSuccess: () => toast({ title: "Membership cancelled" }) });
                  }}
                >
                  <Ban className="size-4" aria-hidden />
                  {confirming === m.id ? "Tap again to cancel it" : "Cancel membership"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

const DURATIONS = [1, 3, 6, 12];

export function PlanDialog({ plan, open, onClose }: { plan: MembershipPlan | null; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title={plan ? `Edit ${plan.name}` : "New plan"} description="Existing memberships keep the price they were sold at.">
      {open && <PlanForm key={plan?.id ?? "new"} plan={plan} onDone={onClose} />}
    </Dialog>
  );
}

function PlanForm({ plan, onDone }: { plan: MembershipPlan | null; onDone: () => void }) {
  const [name, setName] = useState(plan?.name ?? "");
  const [months, setMonths] = useState(String(plan?.durationMonths ?? 1));
  const [price, setPrice] = useState(plan ? String(plan.price) : "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const save = useSavePlan();
  const toast = useToast();
  const valid = name.trim().length >= 2 && /^\d+$/.test(price.trim());

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="plan-name">
          <Input id="plan-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Quarterly" autoFocus />
        </Field>
        <Field label="Price (₹)" htmlFor="plan-price">
          <Input id="plan-price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} placeholder="4000" />
        </Field>
      </div>
      <Field label="Length" htmlFor="plan-months" hint={plan ? "Length can't change once a plan exists; create a new plan instead." : undefined}>
        <Select id="plan-months" value={months} disabled={!!plan} onChange={(e) => setMonths(e.target.value)}>
          {DURATIONS.map((m) => (
            <option key={m} value={m}>
              {durationLabel(m)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Description" htmlFor="plan-desc">
        <Input id="plan-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="Optional" />
      </Field>
      <FormError message={save.error?.message} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          loading={save.isPending}
          disabled={!valid}
          onClick={() =>
            save.mutate(
              plan
                ? { id: plan.id, name: name.trim(), price: Number(price), description: description.trim() }
                : { name: name.trim(), durationMonths: Number(months), price: Number(price), description: description.trim() },
              {
                onSuccess: (saved) => {
                  toast({ title: plan ? "Plan updated" : "Plan created", description: `${saved.name} · ${formatINR(saved.price)}` });
                  onDone();
                },
              },
            )
          }
        >
          {plan ? "Save" : "Create plan"}
        </Button>
      </div>
    </div>
  );
}

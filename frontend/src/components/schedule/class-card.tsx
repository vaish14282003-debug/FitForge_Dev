"use client";

import { Clock, MapPin, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useClassAction } from "@/hooks/use-schedule";
import { dayLabel, formatTime } from "@/lib/schedule";
import type { GymClass } from "@/lib/types";
import { cn } from "@/lib/utils";

/** One class with live capacity. Members join/leave; trainers and owners can cancel. */
export function ClassCard({ gymClass, userId, canJoin, canCancel }: { gymClass: GymClass; userId: string; canJoin: boolean; canCancel: boolean }) {
  const action = useClassAction();
  const toast = useToast();
  const joined = gymClass.attendees.includes(userId);
  const taken = gymClass.capacity - gymClass.spotsLeft;
  const started = new Date(gymClass.startsAt) <= new Date();
  const cancelled = !!gymClass.cancelledAt;

  function run(kind: "join" | "leave" | "cancel") {
    action.mutate(
      { id: gymClass.id, action: kind },
      {
        onSuccess: () =>
          toast({
            title: kind === "join" ? `You're in ${gymClass.title}` : kind === "leave" ? `You left ${gymClass.title}` : `${gymClass.title} cancelled`,
            description: kind === "join" ? `${formatTime(gymClass.startsAt)}${gymClass.location ? ` · ${gymClass.location}` : ""}` : undefined,
          }),
        onError: (err) => toast({ title: "Couldn't update the class", description: err.message, tone: "error" }),
      },
    );
  }

  return (
    <div className={cn("rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl", joined && "border-emerald-500/30", cancelled && "opacity-60")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-3.5" aria-hidden />
            <span className="font-medium text-foreground">{dayLabel(gymClass.startsAt)}</span> · {formatTime(gymClass.startsAt)} – {formatTime(gymClass.endsAt)}
          </p>
          <h3 className={cn("font-display mt-1 text-xl font-semibold", cancelled && "line-through")}>{gymClass.title}</h3>
          {gymClass.location ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden />
              {gymClass.location}
            </p>
          ) : null}
        </div>
        {joined && !cancelled && <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">You&apos;re in</span>}
        {cancelled && <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Cancelled</span>}
      </div>

      {gymClass.trainer && (
        <p className="mt-3 flex items-center gap-2 text-sm">
          <Avatar name={gymClass.trainer.name} src={gymClass.trainer.avatarUrl} className="size-6 text-[10px]" />
          {gymClass.trainer.name}
        </p>
      )}

      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden />
            {taken}/{gymClass.capacity} booked
          </span>
          <span className={cn(gymClass.spotsLeft === 0 ? "text-accent-text" : gymClass.spotsLeft <= 2 ? "text-amber-300" : "")}>
            {gymClass.spotsLeft === 0 ? "Full" : `${gymClass.spotsLeft} spot${gymClass.spotsLeft === 1 ? "" : "s"} left`}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-linear-to-r from-primary to-[#ff7a4d]" style={{ width: `${(taken / gymClass.capacity) * 100}%` }} />
        </div>
      </div>

      {!cancelled && !started && (canJoin || canCancel) && (
        <div className="mt-4 flex gap-2">
          {canJoin &&
            (joined ? (
              <Button size="sm" variant="outline" loading={action.isPending} onClick={() => run("leave")}>
                Leave
              </Button>
            ) : (
              <Button size="sm" disabled={gymClass.spotsLeft === 0} loading={action.isPending} onClick={() => run("join")}>
                {gymClass.spotsLeft === 0 ? "Full" : "Join class"}
              </Button>
            ))}
          {canCancel && (
            <Button size="sm" variant="ghost" className="text-muted-foreground" loading={action.isPending} onClick={() => run("cancel")}>
              Cancel class
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { CalendarDays, Check, Clock, MapPin, UserX, Users, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { useCancelBooking, useSetBookingStatus } from "@/hooks/use-schedule";
import { dayLabel, formatTime, groupByDay } from "@/lib/schedule";
import type { Booking, GymClass } from "@/lib/types";
import { cn } from "@/lib/utils";

type Item = { kind: "booking"; at: string; booking: Booking } | { kind: "class"; at: string; gymClass: GymClass };

const STATUS: Record<Booking["status"], { label: string; style: string }> = {
  BOOKED: { label: "Booked", style: "bg-primary/15 text-accent-text" },
  COMPLETED: { label: "Done", style: "bg-emerald-500/15 text-emerald-400" },
  NO_SHOW: { label: "No-show", style: "bg-amber-400/15 text-amber-300" },
  CANCELLED: { label: "Cancelled", style: "bg-white/[0.06] text-muted-foreground" },
};

function BookingRow({ booking, viewer }: { booking: Booking; viewer: "member" | "trainer" | "owner" }) {
  const cancel = useCancelBooking();
  const mark = useSetBookingStatus();
  const toast = useToast();
  const started = new Date(booking.startsAt) <= new Date();
  const person = viewer === "member" ? booking.trainer : booking.member;
  const status = STATUS[booking.status];

  return (
    <li className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-3 py-3 sm:gap-x-4", booking.status === "CANCELLED" && "opacity-55")}>
      <span className="w-14 shrink-0 text-sm font-semibold tabular-nums sm:w-20">{formatTime(booking.startsAt)}</span>
      <Avatar name={person.name} src={person.avatarUrl} className="hidden sm:grid" />
      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate font-medium">
          1-on-1 {viewer === "member" ? "with" : "·"} {person.name}
          {viewer === "owner" && <span className="text-muted-foreground"> with {booking.trainer.name}</span>}
        </p>
        <p className="truncate text-sm text-muted-foreground">{booking.notes || `${formatTime(booking.startsAt)} – ${formatTime(booking.endsAt)}`}</p>
      </div>
      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", status.style)}>{status.label}</span>
      {booking.status === "BOOKED" && !started && (
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          loading={cancel.isPending}
          onClick={() => cancel.mutate(booking.id, { onSuccess: () => toast({ title: "Session cancelled" }) })}
        >
          <X className="size-4" aria-hidden />
          Cancel
        </Button>
      )}
      {booking.status === "BOOKED" && started && viewer !== "member" && (
        <div className="flex gap-1">
          <Button size="sm" variant="outline" loading={mark.isPending} onClick={() => mark.mutate({ id: booking.id, status: "COMPLETED" }, { onSuccess: () => toast({ title: "Marked as done" }) })}>
            <Check className="size-4" aria-hidden />
            Done
          </Button>
          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => mark.mutate({ id: booking.id, status: "NO_SHOW" }, { onSuccess: () => toast({ title: "Marked as no-show" }) })}>
            <UserX className="size-4" aria-hidden />
            No-show
          </Button>
        </div>
      )}
    </li>
  );
}

function ClassRow({ gymClass }: { gymClass: GymClass }) {
  return (
    <li className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-3 py-3 sm:gap-x-4", gymClass.cancelledAt && "opacity-55")}>
      <span className="w-14 shrink-0 text-sm font-semibold tabular-nums sm:w-20">{formatTime(gymClass.startsAt)}</span>
      <span className="hidden size-9 shrink-0 place-items-center rounded-full bg-sky-500/15 text-sky-300 sm:grid">
        <Users className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 basis-40">
        <p className={cn("truncate font-medium", gymClass.cancelledAt && "line-through")}>{gymClass.title}</p>
        <p className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden />
            until {formatTime(gymClass.endsAt)}
          </span>
          {gymClass.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {gymClass.location}
            </span>
          )}
        </p>
      </div>
      <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-medium text-sky-300">
        {gymClass.cancelledAt ? "Cancelled" : `${gymClass.capacity - gymClass.spotsLeft}/${gymClass.capacity} in`}
      </span>
    </li>
  );
}

/** Sessions and classes together, day by day: what a trainer or owner needs to see coming up. */
export function Agenda({ bookings, classes, viewer, emptyText }: { bookings: Booking[]; classes: GymClass[]; viewer: "member" | "trainer" | "owner"; emptyText: string }) {
  const items: Item[] = [
    ...bookings.map((booking) => ({ kind: "booking" as const, at: booking.startsAt, booking })),
    ...classes.map((gymClass) => ({ kind: "class" as const, at: gymClass.startsAt, gymClass })),
  ];
  const days = groupByDay(items, (i) => i.at);

  if (days.length === 0) {
    return (
      <Card className="flex items-center gap-4">
        <span className="grid size-11 place-items-center rounded-2xl bg-white/[0.06] text-muted-foreground">
          <CalendarDays className="size-5" aria-hidden />
        </span>
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {days.map(([day, dayItems]) => (
        <Card key={day} className="p-3 sm:p-4">
          <h3 className={cn("px-3 pt-1 pb-2 text-sm font-semibold", dayLabel(day) === "Today" ? "text-accent-text" : "text-muted-foreground")}>{dayLabel(day)}</h3>
          <ul className="divide-y divide-white/5">
            {dayItems.map((item) =>
              item.kind === "booking" ? <BookingRow key={item.booking.id} booking={item.booking} viewer={viewer} /> : <ClassRow key={item.gymClass.id} gymClass={item.gymClass} />,
            )}
          </ul>
        </Card>
      ))}
    </div>
  );
}

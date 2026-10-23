"use client";

import { useState } from "react";
import { CalendarClock, CalendarPlus, UserPlus } from "lucide-react";
import { Agenda } from "@/components/schedule/agenda";
import { AvailabilityEditor } from "@/components/schedule/availability-editor";
import { ClassCard } from "@/components/schedule/class-card";
import { BookForClientDialog, ConfirmBooking, NewClassDialog } from "@/components/schedule/schedule-dialogs";
import { SlotPicker } from "@/components/schedule/slot-picker";
import { EmptyState, PageHeader } from "@/components/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useClients } from "@/hooks/use-gym";
import { useAvailability, useBookings, useClasses, useSlots } from "@/hooks/use-schedule";
import { useSession } from "@/hooks/use-session";
import { can } from "@/lib/access";
import type { GymClass, Slot } from "@/lib/types";

// One grid in time order; each card carries its own day, so short weeks don't leave empty rows.
function ClassesByDay({ classes, userId, canJoin, canCancel }: { classes: GymClass[]; userId: string; canJoin: boolean; canCancel: (c: GymClass) => boolean }) {
  if (classes.length === 0) return <p className="text-sm text-muted-foreground">No classes scheduled in the next two weeks.</p>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[...classes]
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .map((c) => (
          <ClassCard key={c.id} gymClass={c} userId={userId} canJoin={canJoin} canCancel={canCancel(c)} />
        ))}
    </div>
  );
}

function MemberSchedule({ userId, hasTrainer }: { userId: string; hasTrainer: boolean }) {
  const slots = useSlots(7, hasTrainer);
  const bookings = useBookings(30);
  const classes = useClasses(14);
  const [picked, setPicked] = useState<Slot | null>(null);
  const now = new Date();
  const upcomingSessions = (bookings.data ?? []).filter((b) => b.status === "BOOKED" && new Date(b.endsAt) > now);
  const joined = (classes.data ?? []).filter((c) => c.attendees.includes(userId) && !c.cancelledAt && new Date(c.endsAt) > now);

  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-display mb-4 text-3xl font-semibold">Coming up</h2>
        {bookings.isPending || classes.isPending ? (
          <Skeleton className="h-24 w-full rounded-3xl" />
        ) : (
          <Agenda bookings={upcomingSessions} classes={joined} viewer="member" emptyText="Nothing booked yet. Pick a session with your trainer or join a class below." />
        )}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="font-display text-3xl font-semibold">Book a session</h2>
          {slots.data && (
            <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] py-1 pr-3 pl-1 text-sm">
              <Avatar name={slots.data.trainer.name} src={slots.data.trainer.avatarUrl} className="size-7 text-[11px]" />
              with {slots.data.trainer.name} · {slots.data.sessionMinutes} min
            </span>
          )}
        </div>
        {!hasTrainer ? (
          <EmptyState icon={CalendarClock} title="No trainer yet">
            Once the gym assigns you a trainer, you can book 1-on-1 sessions with them here.
          </EmptyState>
        ) : slots.isPending ? (
          <Skeleton className="h-48 w-full rounded-3xl" />
        ) : slots.data!.days.every((d) => d.slots.length === 0) ? (
          <Card className="text-sm text-muted-foreground">Your trainer hasn&apos;t set any hours for the coming week.</Card>
        ) : (
          <Card>
            <SlotPicker data={slots.data!} onPick={setPicked} />
          </Card>
        )}
      </section>

      <section>
        <h2 className="font-display mb-4 text-3xl font-semibold">Classes</h2>
        {classes.isPending ? <Skeleton className="h-48 w-full rounded-3xl" /> : <ClassesByDay classes={classes.data!} userId={userId} canJoin canCancel={() => false} />}
      </section>

      <ConfirmBooking slot={picked} trainer={slots.data?.trainer} onClose={() => setPicked(null)} />
    </div>
  );
}

function StaffSchedule({ userId, isOwner }: { userId: string; isOwner: boolean }) {
  const bookings = useBookings(14);
  const classes = useClasses(14);
  // Only trainers have weekly hours of their own.
  const availability = useAvailability(undefined, !isOwner);
  const clients = useClients();
  const [newClass, setNewClass] = useState(false);
  const [bookClient, setBookClient] = useState(false);
  const mine = (c: GymClass) => isOwner || c.trainer?.id === userId;
  const agendaClasses = (classes.data ?? []).filter((c) => (isOwner ? true : c.trainer?.id === userId));

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setNewClass(true)}>
          <CalendarPlus className="size-4" aria-hidden />
          New class
        </Button>
        {!isOwner && (
          <Button variant="outline" onClick={() => setBookClient(true)} disabled={!clients.data?.length}>
            <UserPlus className="size-4" aria-hidden />
            Book a client
          </Button>
        )}
      </div>

      <div className={isOwner ? "" : "grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_420px]"}>
        <section>
          <h2 className="font-display mb-4 text-3xl font-semibold">{isOwner ? "Gym agenda" : "Your agenda"}</h2>
          {bookings.isPending || classes.isPending ? (
            <Skeleton className="h-64 w-full rounded-3xl" />
          ) : (
            <Agenda
              bookings={bookings.data!}
              classes={agendaClasses}
              viewer={isOwner ? "owner" : "trainer"}
              emptyText={isOwner ? "Nothing scheduled in the next two weeks." : "No sessions or classes in the next two weeks. Set your hours so clients can book you."}
            />
          )}
        </section>
        {!isOwner && <section>{availability.data ? <AvailabilityEditor key={JSON.stringify(availability.data.availability)} initial={availability.data.availability} /> : <Skeleton className="h-96 w-full rounded-3xl" />}</section>}
      </div>

      <section>
        <h2 className="font-display mb-4 text-3xl font-semibold">Classes</h2>
        {classes.isPending ? <Skeleton className="h-48 w-full rounded-3xl" /> : <ClassesByDay classes={classes.data!} userId={userId} canJoin={false} canCancel={mine} />}
      </section>

      <NewClassDialog open={newClass} onClose={() => setNewClass(false)} isOwner={isOwner} />
      <BookForClientDialog open={bookClient} clients={clients.data ?? []} onClose={() => setBookClient(false)} />
    </div>
  );
}

export default function SchedulePage() {
  const { data: session } = useSession();
  if (!session) return null;
  const { user } = session;
  const isMember = user.role === "MEMBER";

  return (
    <>
      <PageHeader
        eyebrow="Schedule"
        title={
          <>
            Sessions & <span className="text-primary">classes</span>
          </>
        }
        subtitle={
          isMember
            ? "Book 1-on-1 time with your trainer and join group classes."
            : can(session, "gym:settings")
              ? "Every session and class in the gym, and the class timetable."
              : "Your sessions and classes, your weekly hours, and booking for clients."
        }
      />
      {isMember ? <MemberSchedule userId={user.id} hasTrainer={!!user.trainer} /> : <StaffSchedule userId={user.id} isOwner={can(session, "gym:settings")} />}
    </>
  );
}

"use client";

import { useState } from "react";
import { CalendarCheck, Clock } from "lucide-react";
import { FormError } from "@/components/auth/auth-card";
import { SlotPicker } from "@/components/schedule/slot-picker";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useUsers } from "@/hooks/use-gym";
import { useBook, useCreateClass, useSlots, type ClassInput } from "@/hooks/use-schedule";
import { dayLabel, formatTime } from "@/lib/schedule";
import type { Slot, UserRef } from "@/lib/types";

/** Confirms one slot. Trainers booking for a client pass `client`. */
export function ConfirmBooking({ slot, trainer, client, onClose }: { slot: Slot | null; trainer?: UserRef; client?: UserRef; onClose: () => void }) {
  const [notes, setNotes] = useState("");
  const book = useBook();
  const toast = useToast();

  function close() {
    setNotes("");
    book.reset();
    onClose();
  }

  return (
    <Dialog open={!!slot} onClose={close} title="Book this session?" description={client ? `For ${client.name}` : trainer ? `With ${trainer.name}` : undefined}>
      {slot && (
        <div className="space-y-5">
          <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <span className="grid size-12 place-items-center rounded-2xl bg-primary/15 text-accent-text">
              <CalendarCheck className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-semibold">{dayLabel(slot.startsAt)}</p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="size-3.5" aria-hidden />
                {formatTime(slot.startsAt)} – {formatTime(slot.endsAt)}
              </p>
            </div>
            {trainer && <Avatar name={trainer.name} src={trainer.avatarUrl} className="ml-auto" />}
          </div>
          <Field label="Anything to focus on?" htmlFor="book-notes" hint="Optional. Your trainer sees this.">
            <Input id="book-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} placeholder="e.g. Deadlift form check" />
          </Field>
          <FormError message={book.error?.message} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              loading={book.isPending}
              onClick={() =>
                book.mutate(
                  { startsAt: slot.startsAt, memberId: client?.id, notes },
                  {
                    onSuccess: () => {
                      toast({ title: "Session booked", description: `${dayLabel(slot.startsAt)} at ${formatTime(slot.startsAt)}` });
                      close();
                    },
                  },
                )
              }
            >
              Confirm booking
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

/** Trainers book a session for one of their clients: pick the client, then a slot. */
export function BookForClientDialog({ open, clients, onClose }: { open: boolean; clients: UserRef[]; onClose: () => void }) {
  const [clientId, setClientId] = useState("");
  const [slot, setSlot] = useState<Slot | null>(null);
  const slots = useSlots(14, open);
  const client = clients.find((c) => c.id === clientId);

  return (
    <>
      <Dialog open={open && !slot} onClose={onClose} title="Book a client" description="Pick who, then when." className="max-w-2xl">
        <div className="space-y-5">
          <Field label="Client" htmlFor="book-client">
            <Select id="book-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Choose a client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          {clientId && (slots.data ? <SlotPicker data={slots.data} onPick={setSlot} /> : <Skeleton className="h-40 w-full" />)}
        </div>
      </Dialog>
      <ConfirmBooking
        slot={slot}
        client={client}
        onClose={() => {
          setSlot(null);
          onClose();
        }}
      />
    </>
  );
}

const nextHour = () => {
  const d = new Date(Date.now() + 24 * 3600e3);
  d.setMinutes(0, 0, 0);
  d.setHours(18);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
};

export function NewClassDialog({ open, onClose, isOwner }: { open: boolean; onClose: () => void; isOwner: boolean }) {
  return (
    <Dialog open={open} onClose={onClose} title="New class" description="Members can join until it's full." className="max-w-xl">
      {open && <ClassForm isOwner={isOwner} onDone={onClose} />}
    </Dialog>
  );
}

function ClassForm({ isOwner, onDone }: { isOwner: boolean; onDone: () => void }) {
  const [form, setForm] = useState({ title: "", location: "", description: "", startsAt: nextHour(), duration: "45", capacity: "12", repeat: "1", trainerId: "" });
  const trainers = useUsers("TRAINER", isOwner);
  const create = useCreateClass();
  const toast = useToast();
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const valid = form.title.trim().length >= 2 && form.startsAt && Number(form.capacity) >= 1;

  function submit() {
    const body: ClassInput = {
      title: form.title.trim(),
      location: form.location.trim(),
      description: form.description.trim(),
      startsAt: new Date(form.startsAt).toISOString(),
      durationMinutes: Number(form.duration),
      capacity: Number(form.capacity),
      repeatWeeks: Number(form.repeat),
      ...(isOwner && { trainerId: form.trainerId || null }),
    };
    create.mutate(body, {
      onSuccess: (classes) => {
        toast({ title: classes.length > 1 ? `${classes.length} classes scheduled` : "Class scheduled", description: `${body.title} · ${dayLabel(classes[0].startsAt)} ${formatTime(classes[0].startsAt)}` });
        onDone();
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Class name" htmlFor="c-title">
          <Input id="c-title" value={form.title} onChange={set("title")} placeholder="HIIT Blast" autoFocus />
        </Field>
        <Field label="Where" htmlFor="c-loc">
          <Input id="c-loc" value={form.location} onChange={set("location")} placeholder="Studio 1" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Starts" htmlFor="c-start">
          <Input id="c-start" type="datetime-local" value={form.startsAt} onChange={set("startsAt")} />
        </Field>
        <Field label="Length" htmlFor="c-dur">
          <Select id="c-dur" value={form.duration} onChange={set("duration")}>
            {[30, 45, 60, 75, 90].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Spots" htmlFor="c-cap">
          <Input id="c-cap" inputMode="numeric" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value.replace(/\D/g, "") }))} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Repeat weekly" htmlFor="c-rep">
          <Select id="c-rep" value={form.repeat} onChange={set("repeat")}>
            <option value="1">Just once</option>
            {[2, 4, 6, 8, 12].map((w) => (
              <option key={w} value={w}>
                For {w} weeks
              </option>
            ))}
          </Select>
        </Field>
        {isOwner && (
          <Field label="Trainer" htmlFor="c-trainer">
            <Select id="c-trainer" value={form.trainerId} onChange={set("trainerId")}>
              <option value="">No trainer</option>
              {trainers.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      <Field label="Description" htmlFor="c-desc">
        <Input id="c-desc" value={form.description} onChange={set("description")} maxLength={300} placeholder="Optional" />
      </Field>
      <FormError message={create.error?.message} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button loading={create.isPending} disabled={!valid} onClick={submit}>
          Schedule class
        </Button>
      </div>
    </div>
  );
}

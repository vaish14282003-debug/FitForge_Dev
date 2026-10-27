"use client";

import { useState } from "react";
import { UserCheck, UserX } from "lucide-react";
import { FormError } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useUpdateUser } from "@/hooks/use-gym";
import type { User } from "@/lib/types";

export function EditPersonDialog({ person, onClose }: { person: User | null; onClose: () => void }) {
  return (
    <Dialog open={!!person} onClose={onClose} title={person ? `Edit ${person.name.split(" ")[0]}` : ""} description={person?.email}>
      {person && <EditForm key={person.id} person={person} onDone={onClose} />}
    </Dialog>
  );
}

function EditForm({ person, onDone }: { person: User; onDone: () => void }) {
  const [name, setName] = useState(person.name);
  const [phone, setPhone] = useState(person.phone ?? "");
  const [confirming, setConfirming] = useState(false);
  const update = useUpdateUser();
  const toast = useToast();
  const isTrainer = person.role === "TRAINER";
  const unchanged = name.trim() === person.name && phone.trim() === (person.phone ?? "");

  function save() {
    update.mutate(
      { id: person.id, name: name.trim(), phone: phone.trim() },
      {
        onSuccess: () => {
          toast({ title: "Details saved" });
          onDone();
        },
      },
    );
  }

  function toggleActive() {
    if (person.isActive && !confirming) {
      setConfirming(true);
      return;
    }
    update.mutate(
      { id: person.id, isActive: !person.isActive },
      {
        onSuccess: (u) => {
          toast({
            title: u.isActive ? `${u.name} can log in again` : `${u.name} deactivated`,
            description: u.isActive ? undefined : `They've been signed out${isTrainer ? " and their clients unassigned" : ""}.`,
          });
          onDone();
        },
      },
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="ep-name">
          <Input id="ep-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Phone" htmlFor="ep-phone">
          <Input id="ep-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
        </Field>
      </div>
      <FormError message={update.error?.message} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button loading={update.isPending && !confirming} disabled={name.trim().length < 2 || unchanged} onClick={save}>
          Save
        </Button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="font-semibold">{person.isActive ? "Deactivate account" : "Reactivate account"}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {person.isActive
            ? `They'll be signed out and won't be able to log in. Their history is kept.${isTrainer ? " Their clients will need a new trainer." : ""}`
            : "They'll be able to log in again with their existing password."}
        </p>
        <Button
          size="sm"
          variant={person.isActive ? "ghost" : "outline"}
          className={person.isActive ? "mt-3 -ml-3 text-accent-text" : "mt-3"}
          loading={update.isPending && confirming}
          onClick={toggleActive}
        >
          {person.isActive ? <UserX className="size-4" aria-hidden /> : <UserCheck className="size-4" aria-hidden />}
          {person.isActive ? (confirming ? `Yes, deactivate ${person.name.split(" ")[0]}` : "Deactivate") : "Reactivate"}
        </Button>
      </div>
    </div>
  );
}

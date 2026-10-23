"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Users } from "lucide-react";
import { FormError } from "@/components/auth/auth-card";
import { EmptyState, PageHeader } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useAssignTrainer, useCreateUser, useUsers, type ManagedRole } from "@/hooks/use-gym";
import { useSession } from "@/hooks/use-session";
import { can } from "@/lib/access";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS: { role: ManagedRole; label: string; singular: string }[] = [
  { role: "MEMBER", label: "Members", singular: "member" },
  { role: "TRAINER", label: "Trainers", singular: "trainer" },
  { role: "STAFF", label: "Staff", singular: "staff member" },
];

const schema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(72, "Use at most 72 characters"),
});

function AddUserForm({ role, singular, onDone }: { role: ManagedRole; singular: string; onDone: () => void }) {
  const createUser = useCreateUser();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  return (
    <Card className="mb-6">
      <form
        className="grid gap-4 sm:grid-cols-3"
        noValidate
        onSubmit={handleSubmit((values) =>
          createUser.mutate(
            { ...values, role },
            {
              onSuccess: () => {
                toast({ title: `${values.name} added`, description: `They can log in with ${values.email}.` });
                onDone();
              },
            },
          ),
        )}
      >
        <Field label="Full name" htmlFor="new-name" error={errors.name?.message}>
          <Input id="new-name" aria-invalid={!!errors.name} {...register("name")} />
        </Field>
        <Field label="Email" htmlFor="new-email" error={errors.email?.message}>
          <Input id="new-email" type="email" aria-invalid={!!errors.email} {...register("email")} />
        </Field>
        <Field
          label="Temporary password"
          htmlFor="new-password"
          error={errors.password?.message}
          hint="Share it with them directly."
        >
          <Input id="new-password" type="text" autoComplete="off" aria-invalid={!!errors.password} {...register("password")} />
        </Field>
        <div className="space-y-4 sm:col-span-3">
          <FormError message={createUser.error?.message} />
          <div className="flex gap-2">
            <Button type="submit" loading={createUser.isPending}>
              {createUser.isPending ? "Adding…" : `Add ${singular}`}
            </Button>
            <Button variant="ghost" onClick={onDone}>
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}

function TrainerSelect({ member, trainers }: { member: User; trainers: User[] }) {
  const assign = useAssignTrainer();
  const toast = useToast();
  return (
    <Select
      aria-label={`Trainer for ${member.name}`}
      className="h-10 w-44 rounded-full"
      value={member.trainer?.id ?? ""}
      disabled={assign.isPending}
      onChange={(e) => {
        const trainer = trainers.find((t) => t.id === e.target.value);
        assign.mutate(
          { memberId: member.id, trainerId: e.target.value || null },
          {
            onSuccess: () =>
              toast({
                title: trainer ? `${member.name} → ${trainer.name}` : `${member.name} has no trainer now`,
              }),
            onError: (err) => toast({ title: "Couldn't change trainer", description: err.message, tone: "error" }),
          },
        );
      }}
    >
      <option value="">No trainer</option>
      {trainers.map((trainer) => (
        <option key={trainer.id} value={trainer.id}>
          {trainer.name}
        </option>
      ))}
    </Select>
  );
}

export default function TeamPage() {
  const { data: session } = useSession();
  const canManageMembers = !!session && can(session, "members:manage");
  const canManageTrainers = !!session && can(session, "trainers:manage");
  // Owners can open any member's progress; staff manage accounts but not training data.
  const canSeeProgress = !!session && can(session, "clients:read:assigned");
  const tabs = TABS.filter((tab) => (tab.role === "MEMBER" ? canManageMembers : canManageTrainers));

  const [selected, setSelected] = useState<ManagedRole | null>(null);
  const [adding, setAdding] = useState(false);
  const tab = tabs.find((t) => t.role === selected) ?? tabs[0];

  const users = useUsers(tab?.role ?? "MEMBER", !!tab);
  // Staff can manage members but cannot see trainers, so they get no assignment control.
  const trainers = useUsers("TRAINER", canManageTrainers);

  if (!tab) return null;

  return (
    <>
      <PageHeader eyebrow="People" title={<>Your <span className="text-primary">team</span></>} subtitle="Everyone with an account at your gym." />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-full border border-white/10 bg-white/5 p-1" role="tablist">
          {tabs.map(({ role, label }) => (
            <button
              key={role}
              role="tab"
              aria-selected={role === tab.role}
              onClick={() => {
                setSelected(role);
                setAdding(false);
              }}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition duration-200",
                role === tab.role ? "bg-primary text-white shadow-[0_6px_20px_-8px_var(--primary)]" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden />
            Add {tab.singular}
          </Button>
        )}
      </div>

      {adding && <AddUserForm key={tab.role} role={tab.role} singular={tab.singular} onDone={() => setAdding(false)} />}

      {users.isError ? (
        <FormError message={users.error.message} />
      ) : users.data?.length === 0 ? (
        <EmptyState icon={Users} title={`No ${tab.label.toLowerCase()} yet`}>
          {tab.role === "MEMBER"
            ? "Add members here, or share your gym's join code so they can sign up themselves."
            : `Add your first ${tab.singular} to give them a login.`}
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="text-xs font-medium text-muted-foreground">
              <tr className="border-b border-white/10">
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Email</th>
                {tab.role === "MEMBER" && <th className="px-6 py-3 font-medium">Trainer</th>}
                <th className="px-6 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.data?.map((user) => (
                <tr key={user.id} className="transition-colors hover:bg-white/[0.03]">
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-3 font-medium">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-accent-text">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                      {tab.role === "MEMBER" && canSeeProgress ? (
                        <Link href={`/clients/${user.id}`} className="underline-offset-4 hover:text-accent-text hover:underline">
                          {user.name}
                        </Link>
                      ) : (
                        user.name
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{user.email}</td>
                  {tab.role === "MEMBER" && (
                    <td className="px-6 py-3">
                      {trainers.data ? (
                        <TrainerSelect member={user} trainers={trainers.data} />
                      ) : (
                        <span className="text-muted-foreground">{user.trainer?.name ?? "—"}</span>
                      )}
                    </td>
                  )}
                  <td className="px-6 py-4 text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

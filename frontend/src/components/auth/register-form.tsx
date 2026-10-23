"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, CircleCheck, CircleX, Loader2, User } from "lucide-react";
import { AuthCard, FormError, KeepNextLink } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Field, Input, PasswordInput } from "@/components/ui/input";
import { useGymLookup } from "@/hooks/use-gym";
import { useRegister, type RegisterInput } from "@/hooks/use-session";
import { cn } from "@/lib/utils";

// Kept in step with backend/src/validators/auth.validator.js.
const schema = z
  .object({
    role: z.enum(["MEMBER", "GYM_OWNER"]),
    name: z.string().trim().min(2, "Enter your name").max(80),
    email: z.email("Enter a valid email"),
    password: z.string().min(8, "Use at least 8 characters").max(72, "Use at most 72 characters"),
    gymName: z.string().trim(),
    gymCode: z.string().trim(),
  })
  .superRefine((values, ctx) => {
    if (values.role === "GYM_OWNER" && values.gymName.length < 2) {
      ctx.addIssue({ code: "custom", path: ["gymName"], message: "Enter your gym's name" });
    }
    if (values.role === "MEMBER" && values.gymCode.length !== 8) {
      ctx.addIssue({ code: "custom", path: ["gymCode"], message: "Gym codes are 8 characters" });
    }
  });

type Values = z.infer<typeof schema>;

// Confirms the code against the API as it is typed, so a wrong code is caught before submitting.
function GymCodeStatus({ code }: { code: string }) {
  const normalized = code.trim().toUpperCase();
  const lookup = useGymLookup(normalized);

  if (normalized.length !== 8) return <>The 8-character code from your gym. Owners find it on their dashboard.</>;
  if (lookup.isFetching) {
    return (
      <span className="inline-flex items-center gap-2">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Checking code…
      </span>
    );
  }
  if (lookup.data) {
    return (
      <span className="animate-fade-in inline-flex items-center gap-2 text-emerald-400">
        <CircleCheck className="size-4" aria-hidden />
        You&apos;ll join <strong className="font-semibold">{lookup.data.name}</strong>
      </span>
    );
  }
  return (
    <span className="animate-fade-in inline-flex items-center gap-2 text-destructive">
      <CircleX className="size-4" aria-hidden />
      {lookup.error?.message ?? "No gym uses this code"}
    </span>
  );
}

const ROLE_OPTIONS = [
  { value: "MEMBER", label: "I'm a member", description: "Join your gym with its code", icon: User },
  { value: "GYM_OWNER", label: "I own a gym", description: "Set up a new gym", icon: Building2 },
] as const;

export function RegisterForm() {
  const signUp = useRegister();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { role: "MEMBER", name: "", email: "", password: "", gymName: "", gymCode: "" },
  });
  const role = useWatch({ control, name: "role" });
  const gymCode = useWatch({ control, name: "gymCode" });

  function onSubmit({ gymName, gymCode, ...account }: Values) {
    const body: RegisterInput =
      account.role === "GYM_OWNER"
        ? { ...account, role: "GYM_OWNER", gymName }
        : { ...account, role: "MEMBER", gymCode: gymCode.toUpperCase() };
    signUp.mutate(body);
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Trainers and staff get their login from the gym owner."
      footer={
        <>
          Already have an account?{" "}
          <KeepNextLink href="/login">Log in</KeepNextLink>
        </>
      }
    >
      <form className="space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="sr-only">Account type</legend>
          {ROLE_OPTIONS.map(({ value, label, description, icon: Icon }) => (
            <label
              key={value}
              className={cn(
                "cursor-pointer rounded-2xl border p-4 transition duration-200 has-focus-visible:outline-2 has-focus-visible:outline-primary",
                role === value ? "border-primary bg-primary/10" : "border-border hover:border-foreground/40",
              )}
            >
              <input
                type="radio"
                value={value}
                className="sr-only"
                // A server error from the other account type no longer applies.
                {...register("role", { onChange: () => signUp.reset() })}
              />
              <Icon className="mb-2 size-5 text-accent-text" aria-hidden />
              <span className="block text-sm font-semibold">{label}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
            </label>
          ))}
        </fieldset>

        <Field label="Full name" htmlFor="name" error={errors.name?.message}>
          <Input id="name" autoComplete="name" aria-invalid={!!errors.name} {...register("name")} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message} hint="At least 8 characters.">
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
        </Field>

        {role === "GYM_OWNER" ? (
          <Field label="Gym name" htmlFor="gymName" error={errors.gymName?.message}>
            <Input id="gymName" autoComplete="organization" aria-invalid={!!errors.gymName} {...register("gymName")} />
          </Field>
        ) : (
          <Field
            label="Gym code"
            htmlFor="gymCode"
            error={errors.gymCode?.message}
            hint={<GymCodeStatus code={gymCode} />}
          >
            <Input
              id="gymCode"
              autoComplete="off"
              maxLength={8}
              placeholder="e.g. MB2NHVEE"
              className="font-mono uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal"
              aria-invalid={!!errors.gymCode}
              {...register("gymCode")}
            />
          </Field>
        )}

        <FormError message={signUp.error?.message} />
        <Button type="submit" className="w-full" loading={signUp.isPending}>
          {signUp.isPending ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthCard>
  );
}

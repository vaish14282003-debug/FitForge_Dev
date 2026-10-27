"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MailCheck, ShieldCheck } from "lucide-react";
import { AuthCard, FormError } from "@/components/auth/auth-card";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input, PasswordInput } from "@/components/ui/input";
import { api } from "@/lib/api";

const backToLogin = (
  <>
    Remembered it?{" "}
    <Link href="/login" className="font-semibold text-foreground underline-offset-4 hover:underline">
      Log in
    </Link>
  </>
);

export function ForgotPasswordForm() {
  const send = useMutation({ mutationFn: (email: string) => api<{ message: string }>("/auth/forgot-password", { method: "POST", body: { email } }) });
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm({ resolver: zodResolver(z.object({ email: z.email("Enter a valid email") })) });

  if (send.isSuccess) {
    return (
      <AuthCard title="Check your email" subtitle={`If ${getValues("email")} has a FitForge account, a reset link is on its way.`} footer={backToLogin}>
        <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-muted-foreground">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-emerald-400" aria-hidden />
          The link works once and expires in 30 minutes. Check your spam folder if it doesn&apos;t arrive in a few minutes.
        </div>
        <Button variant="outline" className="mt-5 w-full" onClick={() => send.reset()}>
          Use a different email
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Forgot your password?" subtitle="Enter your email and we'll send you a link to set a new one." footer={backToLogin}>
      <form className="space-y-5" noValidate onSubmit={handleSubmit(({ email }) => send.mutate(email))}>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" autoFocus placeholder="you@example.com" aria-invalid={!!errors.email} {...register("email")} />
        </Field>
        <FormError message={send.error?.message} />
        <Button type="submit" className="w-full" loading={send.isPending}>
          Send reset link
        </Button>
      </form>
    </AuthCard>
  );
}

const noSubscribe = () => () => {};

const resetSchema = z
  .object({ password: z.string().min(8, "Use at least 8 characters").max(72), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

export function ResetPasswordForm() {
  // The token is only in the browser's address bar: undefined while prerendering, then the value
  // (or null). Read this way, the static page needs no Suspense boundary.
  const token = useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).get("token"),
    () => undefined,
  );
  const reset = useMutation({
    mutationFn: (password: string) => api<{ message: string }>("/auth/reset-password", { method: "POST", body: { token, password } }),
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(resetSchema), defaultValues: { password: "", confirm: "" } });

  if (reset.isSuccess) {
    return (
      <AuthCard title="Password updated" subtitle="You've been signed out everywhere else. Log in with your new password." footer={null}>
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
          <ShieldCheck className="size-5 text-emerald-400" aria-hidden />
          Your account is secure.
        </div>
        <Link href="/login" className={buttonClass({ className: "mt-5 w-full" })}>
          Log in
        </Link>
      </AuthCard>
    );
  }

  if (token === null) {
    return (
      <AuthCard title="Link missing" subtitle="This page needs the link from your reset email." footer={backToLogin}>
        <Link href="/forgot-password" className={buttonClass({ className: "w-full" })}>
          Get a new link
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Set a new password" subtitle="Choose something you haven't used here before." footer={backToLogin}>
      <form className="space-y-5" noValidate onSubmit={handleSubmit(({ password }) => reset.mutate(password))}>
        <Field label="New password" htmlFor="password" error={errors.password?.message} hint="At least 8 characters.">
          <PasswordInput id="password" autoComplete="new-password" autoFocus aria-invalid={!!errors.password} {...register("password")} />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm" error={errors.confirm?.message}>
          <PasswordInput id="confirm" autoComplete="new-password" aria-invalid={!!errors.confirm} {...register("confirm")} />
        </Field>
        {reset.error && (
          <div className="space-y-2">
            <FormError message={reset.error.message} />
            <Link href="/forgot-password" className="text-sm font-semibold underline-offset-4 hover:underline">
              Send me a new link
            </Link>
          </div>
        )}
        <Button type="submit" className="w-full" loading={reset.isPending} disabled={!token}>
          Update password
        </Button>
      </form>
    </AuthCard>
  );
}

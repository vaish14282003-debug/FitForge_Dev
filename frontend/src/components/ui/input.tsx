"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-12 w-full rounded-xl border border-border bg-white/[0.04] px-4 text-[15px] transition duration-200 " +
  "placeholder:text-muted-foreground/70 hover:border-white/20 focus-visible:border-primary " +
  "focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:outline-none aria-invalid:border-destructive";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(fieldClass, className)} {...props} />;
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(fieldClass, className)} {...props} />;
}

/** Password input with a show/hide toggle, so people can check what autofill or their typing entered. */
export function PasswordInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <input type={visible ? "text" : "password"} className={cn(fieldClass, "pr-12", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
      >
        <Icon className="size-[18px]" aria-hidden />
      </button>
    </div>
  );
}

type FieldProps = {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
};

export function Field({ label, htmlFor, error, hint, children }: FieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground/90">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="animate-fade-in text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <div className="text-sm text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}

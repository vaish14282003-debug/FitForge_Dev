"use client";

import { cn } from "@/lib/utils";
import { PAYMENT_METHODS } from "@/lib/membership";
import type { PaymentMethod } from "@/lib/types";

export function MethodChips({ value, onChange }: { value: PaymentMethod | null; onChange: (m: PaymentMethod) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Payment method">
      {PAYMENT_METHODS.map((m) => (
        <button
          key={m.value}
          type="button"
          role="radio"
          aria-checked={value === m.value}
          onClick={() => onChange(m.value)}
          className={cn(
            "rounded-full border px-4 py-2 text-sm font-medium transition",
            value === m.value ? "border-primary bg-primary text-white" : "border-white/10 bg-white/[0.04] text-muted-foreground hover:text-foreground",
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

export const referenceInputClass =
  "h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm transition placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:outline-none";

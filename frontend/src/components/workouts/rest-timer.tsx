"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, SkipForward, Timer } from "lucide-react";

type RestTimerProps = { endsAt: number | null; total: number; onAdd: (seconds: number) => void; onSkip: () => void };

/** Floating countdown after a set is ticked off. Vibrates (where supported) when rest is over. */
export function RestTimer({ endsAt, total, onAdd, onSkip }: RestTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);

  const remaining = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;

  useEffect(() => {
    if (endsAt && remaining === 0) {
      navigator.vibrate?.(200);
      const id = setTimeout(onSkip, 1200);
      return () => clearTimeout(id);
    }
  }, [endsAt, remaining, onSkip]);

  const progress = total > 0 ? remaining / total : 0;
  const label = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;

  return (
    <AnimatePresence>
      {endsAt && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
          role="timer"
          aria-label={`Rest ${label}`}
          className="fixed inset-x-0 bottom-24 z-50 mx-auto flex w-fit items-center gap-3 rounded-full border border-white/10 bg-[#160d0c]/95 py-2 pr-2 pl-3 shadow-2xl backdrop-blur-xl sm:bottom-8"
        >
          <span className="relative grid size-11 place-items-center">
            <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90" aria-hidden>
              <circle cx="22" cy="22" r="19" fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth="3" />
              <circle
                cx="22"
                cy="22"
                r="19"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 19}
                strokeDashoffset={2 * Math.PI * 19 * (1 - progress)}
                className="transition-[stroke-dashoffset] duration-300"
              />
            </svg>
            <Timer className="size-4 text-accent-text" aria-hidden />
          </span>
          <div className="pr-1">
            <p className="text-xs text-muted-foreground">{remaining === 0 ? "Rest over" : "Rest"}</p>
            <p className="font-display text-2xl leading-none font-semibold tabular-nums">{remaining === 0 ? "Go!" : label}</p>
          </div>
          <button
            type="button"
            onClick={() => onAdd(15)}
            className="inline-flex h-10 items-center gap-1 rounded-full bg-white/10 px-3 text-sm font-medium transition hover:bg-white/15"
          >
            <Plus className="size-3.5" aria-hidden />
            15s
          </button>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Skip rest"
            className="grid size-10 place-items-center rounded-full bg-primary text-white transition hover:brightness-110"
          >
            <SkipForward className="size-4" aria-hidden />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { Clock, Flame, Layers, Trophy, Weight } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { useTrainingSummary } from "@/hooks/use-sessions";
import type { WorkoutSession } from "@/lib/types";
import { formatDuration, formatVolume } from "@/lib/workout";

function CountUp({ to }: { to: number }) {
  const value = useMotionValue(Math.max(0, to - 1));
  const rounded = useTransform(value, (v) => Math.round(v));
  useEffect(() => {
    const controls = animate(value, to, { duration: 1.2, delay: 0.6, ease: "easeOut" });
    return () => controls.stop();
  }, [to, value]);
  return <motion.span>{rounded}</motion.span>;
}

/** Shown after saving: celebrates the streak, then the numbers, then any PRs. */
export function WorkoutComplete({ session }: { session: WorkoutSession }) {
  const { data: summary } = useTrainingSummary();
  const stats = [
    { icon: Clock, label: "Time", value: formatDuration(session.durationSeconds) },
    { icon: Weight, label: "Volume", value: formatVolume(session.totalVolume) },
    { icon: Layers, label: "Sets", value: String(session.completedSets) },
  ];

  return (
    <div className="relative mx-auto max-w-2xl py-6 text-center">
      <motion.div
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 14 }}
        className="relative mx-auto grid size-32 place-items-center"
      >
        <motion.span
          className="absolute inset-0 rounded-full bg-primary/40 blur-2xl"
          animate={{ scale: [1, 1.25, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        />
        <span className="relative grid size-28 place-items-center rounded-full bg-linear-to-br from-primary to-[#a8130a] shadow-[0_20px_60px_-10px_var(--primary)]">
          <Flame className="size-14 text-white" aria-hidden />
        </span>
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="mt-8 text-sm font-semibold text-accent-text"
      >
        Workout complete
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="font-display mt-2 text-5xl font-semibold sm:text-6xl"
      >
        {summary ? (
          <>
            <span className="text-primary">
              <CountUp to={summary.streak} />
            </span>{" "}
            day streak
          </>
        ) : (
          "Nice work"
        )}
      </motion.h1>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-3 text-muted-foreground">
        {session.dayName} · {session.planName}
        {summary ? ` · workout #${summary.totalWorkouts}` : ""}
      </motion.p>

      <div className="mt-10 grid grid-cols-3 gap-3">
        {stats.map(({ icon: Icon, label, value }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 + i * 0.1 }}
            className="rounded-3xl border border-white/10 bg-white/[0.04] px-3 py-5"
          >
            <Icon className="mx-auto size-5 text-accent-text" aria-hidden />
            <p className="font-display mt-2 text-2xl font-semibold sm:text-3xl">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </motion.div>
        ))}
      </div>

      {session.prs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.15 }}
          className="mt-6 rounded-3xl border border-amber-400/30 bg-amber-400/10 p-5 text-left"
        >
          <p className="flex items-center gap-2 font-semibold text-amber-300">
            <Trophy className="size-5" aria-hidden />
            New personal {session.prs.length === 1 ? "record" : "records"}
          </p>
          <ul className="mt-3 space-y-2">
            {session.prs.map((pr) => (
              <li key={pr.exercise} className="flex justify-between gap-4 text-sm">
                <span>{pr.exerciseName}</span>
                <span className="font-semibold">
                  {pr.weight} kg × {pr.reps}
                </span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3 }}
        className="mt-10 flex flex-wrap justify-center gap-3"
      >
        <Link href="/member" className={buttonClass({ size: "lg" })}>
          Back to dashboard
        </Link>
        <Link href="/history" className={buttonClass({ variant: "outline", size: "lg" })}>
          See history
        </Link>
      </motion.div>
    </div>
  );
}

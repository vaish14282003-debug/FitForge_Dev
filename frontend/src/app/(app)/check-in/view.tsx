"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CircleCheck, Loader2, QrCode, ScanLine } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { useAttendanceSummary, useQrCheckIn } from "@/hooks/use-attendance";
import { useGym } from "@/hooks/use-gym";

const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** Opened by scanning the front-desk QR code; checks the member in straight away. */
export default function CheckInPage() {
  const token = useSearchParams().get("t");
  const checkIn = useQrCheckIn();
  const { data: gym } = useGym();
  const summary = useAttendanceSummary();
  const sent = useRef(false);

  useEffect(() => {
    // Strict mode runs effects twice in development; the ref keeps it to one request.
    if (!token || sent.current) return;
    sent.current = true;
    checkIn.mutate(token);
  }, [token, checkIn]);

  const result = checkIn.data;

  return (
    <div className="mx-auto max-w-md py-10 text-center">
      {!token ? (
        <>
          <span className="mx-auto grid size-20 place-items-center rounded-3xl bg-primary/10 text-accent-text ring-1 ring-primary/20">
            <QrCode className="size-9" aria-hidden />
          </span>
          <h1 className="font-display mt-6 text-4xl font-semibold">Check in at the desk</h1>
          <p className="mt-3 text-muted-foreground">
            Point your phone camera at the QR code on the front-desk screen. It opens this page and checks you in.
          </p>
          <Link href="/member" className={buttonClass({ variant: "outline", className: "mt-8" })}>
            Back to dashboard
          </Link>
        </>
      ) : checkIn.isPending || checkIn.isIdle ? (
        <div role="status" className="flex flex-col items-center gap-4 py-16">
          <Loader2 className="size-10 animate-spin text-accent-text" aria-hidden />
          <p className="text-muted-foreground">Checking you in…</p>
        </div>
      ) : checkIn.isError ? (
        <>
          <span className="mx-auto grid size-20 place-items-center rounded-3xl bg-primary/10 text-accent-text ring-1 ring-primary/20">
            <ScanLine className="size-9" aria-hidden />
          </span>
          <h1 className="font-display mt-6 text-4xl font-semibold">Couldn&apos;t check you in</h1>
          <p className="mt-3 text-muted-foreground">{checkIn.error.message}</p>
          <p className="mt-2 text-sm text-muted-foreground">The code on the screen changes every minute, so scan it again from the desk.</p>
          <Link href="/member" className={buttonClass({ variant: "outline", className: "mt-8" })}>
            Back to dashboard
          </Link>
        </>
      ) : (
        result && (
          <>
            <motion.span
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 15 }}
              className="relative mx-auto grid size-28 place-items-center"
            >
              <span className="absolute inset-0 rounded-full bg-emerald-500/30 blur-2xl" aria-hidden />
              <span className="relative grid size-24 place-items-center rounded-full bg-emerald-500 text-white shadow-[0_20px_50px_-15px_rgb(16_185_129)]">
                <CircleCheck className="size-12" aria-hidden />
              </span>
            </motion.span>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <h1 className="font-display mt-8 text-4xl font-semibold sm:text-5xl">
                {result.alreadyCheckedIn ? "You're already in" : "You're checked in"}
              </h1>
              <p className="mt-3 text-muted-foreground">
                {gym?.name ?? "Your gym"} · {time(result.attendance.checkedInAt)}
              </p>
              {summary.data && (
                <p className="mt-6 inline-flex rounded-full bg-white/[0.06] px-4 py-2 text-sm">
                  Visit <span className="mx-1 font-semibold text-accent-text">{summary.data.thisMonth}</span> this month
                </p>
              )}
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/workouts" className={buttonClass({ size: "lg" })}>
                  Start today&apos;s workout
                </Link>
                <Link href="/member" className={buttonClass({ variant: "outline", size: "lg" })}>
                  Dashboard
                </Link>
              </div>
            </motion.div>
          </>
        )
      )}
    </div>
  );
}

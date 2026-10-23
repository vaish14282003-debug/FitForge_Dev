"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import QRCode from "qrcode";
import { Check, Expand, Search, UserCheck } from "lucide-react";
import { PageHeader } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useAttendanceStats, useQrToken, useStaffCheckIn } from "@/hooks/use-attendance";
import { useGym, useUsers } from "@/hooks/use-gym";
import { cn } from "@/lib/utils";

const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

function useCountdown(until: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return until ? Math.max(0, Math.round((new Date(until).getTime() - now) / 1000)) : 0;
}

function QrPanel() {
  const { data, isPending } = useQrToken();
  const { data: gym } = useGym();
  const [svg, setSvg] = useState("");
  const secondsLeft = useCountdown(data?.expiresAt);

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    const url = `${window.location.origin}/check-in?t=${encodeURIComponent(data.token)}`;
    // Rendered by the library from our own URL, so the SVG markup is trusted.
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0a0a0a", light: "#ffffff" } }).then(
      (markup) => !cancelled && setSvg(markup),
    );
    return () => {
      cancelled = true;
    };
  }, [data]);

  const ring = data ? secondsLeft / data.ttlSeconds : 0;

  return (
    <Card className="flex flex-col items-center p-8 text-center">
      <p className="text-sm font-medium text-accent-text">Scan to check in</p>
      <h2 className="font-display mt-1 text-3xl font-semibold">{gym?.name ?? "Front desk"}</h2>
      <div className="relative mt-6 w-full max-w-[22rem]">
        {isPending || !svg ? (
          <Skeleton className="aspect-square w-full rounded-3xl" />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={data?.token}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="aspect-square w-full overflow-hidden rounded-3xl bg-white p-4 shadow-[0_30px_80px_-30px_var(--primary)] [&_svg]:h-full [&_svg]:w-full"
              role="img"
              aria-label="Check-in QR code"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </AnimatePresence>
        )}
      </div>
      <div className="mt-6 flex items-center gap-3 text-sm text-muted-foreground">
        <svg viewBox="0 0 20 20" className="size-5 -rotate-90" aria-hidden>
          <circle cx="10" cy="10" r="8" fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="2.5" />
          <circle
            cx="10"
            cy="10"
            r="8"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2.5"
            strokeDasharray={2 * Math.PI * 8}
            strokeDashoffset={2 * Math.PI * 8 * (1 - ring)}
            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          />
        </svg>
        New code every minute · this one works for {secondsLeft}s
      </div>
      <p className="mt-4 max-w-xs text-sm text-muted-foreground">
        Members point their phone camera at the code. It opens FitForge and checks them in.
      </p>
    </Card>
  );
}

function ManualCheckIn({ checkedInIds }: { checkedInIds: Set<string> }) {
  const [q, setQ] = useState("");
  const deferred = useDeferredValue(q.trim().toLowerCase());
  const members = useUsers("MEMBER");
  const checkIn = useStaffCheckIn();
  const toast = useToast();
  const matches = deferred
    ? (members.data ?? []).filter((m) => m.name.toLowerCase().includes(deferred) || m.email.toLowerCase().includes(deferred)).slice(0, 6)
    : [];

  return (
    <Card>
      <CardTitle className="flex items-center gap-2 text-foreground">
        <UserCheck className="size-4 text-accent-text" aria-hidden />
        Check someone in by hand
      </CardTitle>
      <label className="relative mt-4 block">
        <span className="sr-only">Search members</span>
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or email"
          className="h-11 w-full rounded-full border border-white/10 bg-white/[0.04] pr-4 pl-10 text-sm transition placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:outline-none"
        />
      </label>
      {deferred && (
        <ul className="mt-3 space-y-1">
          {matches.length === 0 && <li className="px-2 py-2 text-sm text-muted-foreground">No members match.</li>}
          {matches.map((m) => {
            const done = checkedInIds.has(m.id);
            return (
              <li key={m.id} className="flex items-center gap-3 rounded-2xl px-2 py-2">
                <span className="grid size-9 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-accent-text">
                  {m.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{m.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{m.email}</span>
                </span>
                <Button
                  size="sm"
                  variant={done ? "ghost" : "primary"}
                  disabled={done}
                  loading={checkIn.isPending && checkIn.variables === m.id}
                  onClick={() =>
                    checkIn.mutate(m.id, {
                      onSuccess: (r) => {
                        toast({ title: r.alreadyCheckedIn ? `${m.name} was already in` : `${m.name} checked in` });
                        setQ("");
                      },
                      onError: (err) => toast({ title: "Couldn't check in", description: err.message, tone: "error" }),
                    })
                  }
                >
                  {done ? <Check className="size-4" aria-hidden /> : null}
                  {done ? "In" : "Check in"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export default function FrontDesk() {
  const stats = useAttendanceStats(14, true);
  const checkIns = stats.data?.checkIns ?? [];
  const checkedInIds = new Set(checkIns.map((c) => c.member.id));

  return (
    <>
      <PageHeader
        eyebrow="Front desk"
        title={
          <>
            Today&apos;s <span className="text-primary">check-ins</span>
          </>
        }
        subtitle="Put this screen where members walk in. The list updates on its own."
        actions={
          <Button variant="outline" onClick={() => document.documentElement.requestFullscreen?.()}>
            <Expand className="size-4" aria-hidden />
            Full screen
          </Button>
        }
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <QrPanel />
        <div className="space-y-6">
          <Card>
            <div className="flex items-baseline justify-between">
              <CardTitle className="text-foreground">In today</CardTitle>
              <span className="font-display text-4xl font-semibold text-primary">{stats.data?.today ?? "–"}</span>
            </div>
            {stats.isPending ? (
              <Skeleton className="mt-4 h-40 w-full" />
            ) : checkIns.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No one yet. Check-ins appear here the moment they happen.</p>
            ) : (
              <ul className="mt-4 max-h-80 space-y-1 overflow-y-auto">
                <AnimatePresence initial={false}>
                  {checkIns.map((c) => (
                    <motion.li
                      key={c.id}
                      layout
                      initial={{ opacity: 0, x: -12, backgroundColor: "rgba(255,45,31,0.18)" }}
                      animate={{ opacity: 1, x: 0, backgroundColor: "rgba(255,45,31,0)" }}
                      transition={{ duration: 0.6 }}
                      className="flex items-center gap-3 rounded-2xl px-2 py-2"
                    >
                      <span className="grid size-9 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-accent-text">
                        {c.member.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.member.name}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs", c.method === "QR" ? "bg-white/[0.06] text-muted-foreground" : "bg-primary/15 text-accent-text")}>
                        {c.method === "QR" ? "QR" : "Desk"}
                      </span>
                      <span className="w-16 text-right text-sm text-muted-foreground tabular-nums">{time(c.checkedInAt)}</span>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </Card>
          <ManualCheckIn checkedInIds={checkedInIds} />
        </div>
      </div>
    </>
  );
}

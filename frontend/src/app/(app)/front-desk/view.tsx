"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import QRCode from "qrcode";
import { useQuery } from "@tanstack/react-query";
import { Check, CircleAlert, Expand, Pencil, Search, UserCheck, Wifi } from "lucide-react";
import { PageHeader } from "@/components/stat-card";
import { Avatar } from "@/components/ui/avatar";
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

const BASE_KEY = "ff-checkin-base";
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

function readSavedBase() {
  try {
    return localStorage.getItem(BASE_KEY);
  } catch {
    return null;
  }
}

/**
 * The address phones open after scanning. "localhost" on the desk computer means the phone itself
 * to a phone, so in development we swap in this computer's network address. A configured public
 * URL, or one the desk saved by hand (e.g. a tunnel), wins.
 */
function useCheckInBase() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || null;
  const [saved, setSaved] = useState<string | null>(readSavedBase);
  const isLocal = LOCAL_HOSTS.includes(window.location.hostname);
  const lan = useQuery({
    queryKey: ["local-address"],
    queryFn: () => fetch("/local-address").then((r) => (r.ok ? (r.json() as Promise<{ addresses: string[] }>) : { addresses: [] })),
    enabled: !configured && !saved && isLocal,
    staleTime: Infinity,
  });

  // A saved address (usually a tunnel) can stop working without warning; check it still answers.
  // no-cors keeps this a plain reachability test: any response counts, a network error doesn't.
  const savedCheck = useQuery({
    queryKey: ["checkin-address", saved],
    queryFn: () => fetch(`${saved}/login`, { mode: "no-cors", cache: "no-store" }).then(() => true, () => false),
    enabled: !!saved,
    refetchInterval: 60_000,
    retry: false,
  });

  const lanAddress = lan.data?.addresses[0];
  const port = window.location.port ? `:${window.location.port}` : "";
  const base =
    configured ??
    saved ??
    (isLocal ? (lan.isPending ? null : lanAddress ? `http://${lanAddress}${port}` : window.location.origin) : window.location.origin);

  function save(value: string | null) {
    try {
      if (value) localStorage.setItem(BASE_KEY, value);
      else localStorage.removeItem(BASE_KEY);
    } catch {
      // Storage blocked: the choice lasts for this page view only.
    }
    setSaved(value);
  }

  return {
    base,
    save,
    isCustom: !!saved,
    savedUnreachable: !!saved && savedCheck.data === false,
    // Phones can't reach a localhost address at all, so warn instead of showing a dead code.
    unreachable: isLocal && !configured && !saved && !lan.isPending && !lanAddress,
    sameWifiHint: isLocal && !configured && !saved && !!lanAddress,
  };
}

function AddressLine({
  base,
  isCustom,
  sameWifiHint,
  unreachable,
  onSave,
}: {
  base: string;
  isCustom: boolean;
  sameWifiHint: boolean;
  unreachable: boolean;
  onSave: (v: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(base);
  const [error, setError] = useState<string>();

  function submit() {
    try {
      const url = new URL(value.trim());
      if (!/^https?:$/.test(url.protocol)) throw new Error();
      onSave(url.origin);
      setEditing(false);
      setError(undefined);
    } catch {
      setError("Enter a full address, like http://192.168.1.20:3001");
    }
  }

  if (editing) {
    return (
      <form
        className="mt-4 w-full max-w-sm space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          aria-label="Address phones should open"
          className="h-10 w-full rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm focus-visible:border-primary focus-visible:outline-none"
        />
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <div className="flex justify-center gap-2">
          {isCustom && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                onSave(null);
                setEditing(false);
              }}
            >
              Use automatic
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button size="sm" type="submit">
            Save
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="mt-4 space-y-1 text-sm">
      <p className="text-muted-foreground">
        Phones open <span className="font-mono text-foreground">{base.replace(/^https?:\/\//, "")}</span>{" "}
        <button
          type="button"
          onClick={() => {
            setValue(base);
            setEditing(true);
          }}
          className="inline-flex items-center gap-1 text-accent-text underline-offset-4 hover:underline"
        >
          <Pencil className="size-3" aria-hidden />
          Change
        </button>
      </p>
      {unreachable && (
        <div role="alert" className="mx-auto mt-2 max-w-sm rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-left text-xs">
          <p className="flex items-center gap-1.5 font-semibold text-amber-300">
            <CircleAlert className="size-3.5" aria-hidden />
            Phones can&apos;t reach this address
          </p>
          <p className="mt-1 text-muted-foreground">If it was a tunnel, it has probably stopped. Switch back to this computer&apos;s Wi-Fi address, or start the tunnel again and update it.</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => onSave(null)}>
            Use automatic address
          </Button>
        </div>
      )}
      {sameWifiHint && (
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Wifi className="size-3.5" aria-hidden />
          Phones must be on the same Wi-Fi as this computer.
        </p>
      )}
    </div>
  );
}

function QrPanel() {
  const { data, isPending } = useQrToken();
  const { data: gym } = useGym();
  const [svg, setSvg] = useState("");
  const secondsLeft = useCountdown(data?.expiresAt);
  const address = useCheckInBase();
  const { base } = address;

  useEffect(() => {
    if (!data || !base) return;
    let cancelled = false;
    const url = `${base}/check-in?t=${encodeURIComponent(data.token)}`;
    // Rendered by the library from our own URL, so the SVG markup is trusted.
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0a0a0a", light: "#ffffff" } }).then(
      (markup) => !cancelled && setSvg(markup),
    );
    return () => {
      cancelled = true;
    };
  }, [data, base]);

  const ring = data ? secondsLeft / data.ttlSeconds : 0;

  return (
    <Card className="flex flex-col items-center p-8 text-center">
      <p className="text-sm font-medium text-accent-text">Scan to check in</p>
      <h2 className="font-display mt-1 text-3xl font-semibold">{gym?.name ?? "Front desk"}</h2>
      <div className="relative mt-6 w-full max-w-[22rem]">
        {address.unreachable ? (
          <div className="grid aspect-square w-full place-items-center rounded-3xl border border-dashed border-white/15 p-6 text-sm text-muted-foreground">
            This computer has no network address phones can reach. Connect it to Wi-Fi, or set an address with Change below.
          </div>
        ) : isPending || !svg ? (
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
      {base && <AddressLine key={base} base={base} isCustom={address.isCustom} sameWifiHint={address.sameWifiHint} unreachable={address.savedUnreachable} onSave={address.save} />}
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
                <Avatar name={m.name} src={m.avatarUrl} />
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
                      <Avatar name={c.member.name} src={c.member.avatarUrl} />
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

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  CalendarCheck,
  CalendarX,
  CheckCheck,
  ClipboardList,
  CreditCard,
  FileText,
  Megaphone,
  MessageSquare,
  MessageSquareQuote,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarkAllRead, useMarkRead, useNotifications, useUnreadCount } from "@/hooks/use-notifications";
import { formatTime, dayLabel } from "@/lib/schedule";
import type { AppNotification, NotificationType } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<NotificationType, { icon: LucideIcon; tone: string }> = {
  PLAN_ASSIGNED: { icon: ClipboardList, tone: "bg-primary/15 text-accent-text" },
  WORKOUT_REVIEWED: { icon: MessageSquareQuote, tone: "bg-primary/15 text-accent-text" },
  BOOKING_CREATED: { icon: CalendarCheck, tone: "bg-sky-500/15 text-sky-300" },
  BOOKING_CANCELLED: { icon: CalendarX, tone: "bg-white/[0.07] text-muted-foreground" },
  CLASS_CANCELLED: { icon: CalendarX, tone: "bg-white/[0.07] text-muted-foreground" },
  MEMBERSHIP_ADDED: { icon: CreditCard, tone: "bg-emerald-500/15 text-emerald-400" },
  MEMBERSHIP_EXPIRING: { icon: TriangleAlert, tone: "bg-amber-400/15 text-amber-300" },
  ANNOUNCEMENT: { icon: Megaphone, tone: "bg-primary/15 text-accent-text" },
  MESSAGE: { icon: MessageSquare, tone: "bg-sky-500/15 text-sky-300" },
  RESOURCE_SHARED: { icon: FileText, tone: "bg-sky-500/15 text-sky-300" },
};

// Booking and class alerts carry the session time as ISO, so it reads in the viewer's own timezone.
const TIME_BODY: NotificationType[] = ["BOOKING_CREATED", "BOOKING_CANCELLED", "CLASS_CANCELLED"];
const bodyText = (n: AppNotification) =>
  TIME_BODY.includes(n.type) && !Number.isNaN(Date.parse(n.body)) ? `${dayLabel(n.body)}, ${formatTime(n.body)}` : n.body;

export function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const unread = useUnreadCount();
  const list = useNotifications(open);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => panel.current && !panel.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const count = unread.data ?? 0;

  function openItem(n: AppNotification) {
    if (!n.readAt) markRead.mutate(n.id);
    if (n.link) {
      setOpen(false);
      router.push(n.link);
    }
  }

  return (
    <div ref={panel} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={count ? `Notifications, ${count} unread` : "Notifications"}
        aria-expanded={open}
        className="relative grid size-10 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        <Bell className="size-5" aria-hidden />
        <AnimatePresence>
          {count > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-white ring-2 ring-[#0b0707]"
            >
              {count > 99 ? "99+" : count}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-x-3 top-20 z-50 max-h-[70vh] overflow-hidden rounded-3xl border border-white/10 bg-[#120b0b]/95 shadow-2xl backdrop-blur-xl sm:absolute sm:inset-x-auto sm:top-12 sm:right-0 sm:w-[24rem]"
            role="dialog"
            aria-label="Notifications"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <p className="font-display text-xl font-semibold">Notifications</p>
              <button
                type="button"
                disabled={count === 0 || markAll.isPending}
                onClick={() => markAll.mutate()}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition enabled:hover:text-foreground disabled:opacity-40"
              >
                <CheckCheck className="size-4" aria-hidden />
                Mark all read
              </button>
            </div>
            <div className="max-h-[calc(70vh-8rem)] overflow-y-auto p-2">
              {list.isPending ? (
                <div className="space-y-2 p-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : list.data?.notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                  <span className="grid size-12 place-items-center rounded-full bg-white/[0.06] text-muted-foreground">
                    <Bell className="size-5" aria-hidden />
                  </span>
                  <p className="font-medium">You&apos;re all caught up</p>
                  <p className="text-sm text-muted-foreground">New plans, bookings, feedback and announcements show up here.</p>
                </div>
              ) : (
                <ul>
                  {list.data?.notifications.map((n) => {
                    const { icon: Icon, tone } = ICONS[n.type];
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => openItem(n)}
                          className={cn("flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-white/[0.05]", !n.readAt && "bg-primary/[0.06]")}
                        >
                          <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", tone)}>
                            <Icon className="size-4" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={cn("block text-sm", n.readAt ? "text-foreground/85" : "font-semibold")}>{n.title}</span>
                            {n.body && <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{bodyText(n)}</span>}
                            <span className="mt-1 block text-xs text-muted-foreground/80">{timeAgo(n.createdAt)}</span>
                          </span>
                          {!n.readAt && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="border-t border-white/10 px-5 py-3">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push("/announcements");
                }}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
              >
                <Megaphone className="size-4" aria-hidden />
                All announcements
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

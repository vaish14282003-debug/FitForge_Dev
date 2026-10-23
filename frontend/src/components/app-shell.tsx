"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CalendarDays, ChartLine, ClipboardList, CreditCard, Dumbbell, History, LayoutDashboard, Library, LogOut, ScanLine, Users, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useLogout, useSession } from "@/hooks/use-session";
import { ROLE_HOME, ROLE_LABEL, can, canVisit } from "@/lib/access";
import type { Session } from "@/lib/types";
import { cn } from "@/lib/utils";

// `hide` trims the nav for roles with many pages; the page itself stays reachable.
type NavItem = { href: string; label: string; icon: LucideIcon; hide?: (session: Session) => boolean };

const NAV: NavItem[] = [
  { href: "/member", label: "Dashboard", icon: LayoutDashboard },
  { href: "/trainer", label: "Dashboard", icon: LayoutDashboard },
  { href: "/owner", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/progress", label: "Progress", icon: ChartLine },
  { href: "/history", label: "History", icon: History },
  // Owners reach training plans from their dashboard, keeping their nav to five items.
  { href: "/plans", label: "Plans", icon: ClipboardList, hide: (s) => can(s, "gym:settings") },
  // Owners reach the library from the Plans page, keeping their nav to five items.
  { href: "/exercises", label: "Exercises", icon: Library, hide: (s) => can(s, "gym:settings") },
  { href: "/team", label: "Team", icon: Users },
  { href: "/memberships", label: "Memberships", icon: CreditCard },
  { href: "/front-desk", label: "Front desk", icon: ScanLine },
];


// Red light behind every signed-in page, echoing the landing hero.
function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute -top-40 right-[-10%] size-[42rem] rounded-full bg-primary/20 blur-[140px]" />
      <div className="absolute bottom-[-20%] left-[-10%] size-[36rem] rounded-full bg-primary/10 blur-[140px]" />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending, isError, refetch } = useSession();
  const logout = useLogout();

  const signedOut = session === null;
  const allowed = session ? canVisit(session, pathname) : false;

  useEffect(() => {
    if (signedOut) router.replace(`/login?next=${encodeURIComponent(`${pathname}${window.location.search}`)}`);
    else if (session && !allowed) router.replace(ROLE_HOME[session.user.role]);
  }, [signedOut, session, allowed, router, pathname]);

  if (isError) {
    return (
      <div className="grid flex-1 place-items-center p-6 text-center">
        <Backdrop />
        <div className="space-y-4">
          <p className="text-muted-foreground">We couldn&apos;t reach FitForge. Check your connection and try again.</p>
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (isPending || !session || !allowed) {
    return (
      <div className="grid flex-1 place-items-center" role="status" aria-label="Loading">
        <Backdrop />
        <span className="size-9 animate-spin rounded-full border-2 border-white/10 border-t-primary" />
      </div>
    );
  }

  const { user } = session;
  const nav = NAV.filter((item) => canVisit(session, item.href) && !item.hide?.(session));
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="relative isolate flex flex-1 flex-col">
      <Backdrop />

      <header className="sticky top-0 z-40 px-4 pt-4 sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 rounded-full border border-white/10 bg-black/40 py-2 pr-2 pl-4 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:pl-5">
          <Logo href={ROLE_HOME[user.role]} className="text-xl" />

          <nav className="hidden gap-1 sm:flex" aria-label="Main">
            {nav.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition duration-200",
                    active ? "bg-white text-black" : "text-white/70 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/profile"
              aria-label="Your profile"
              className="flex items-center gap-3 rounded-full py-1 pr-1 pl-1 transition hover:bg-white/5 sm:pr-3"
            >
              <Avatar name={user.name} src={user.avatarUrl} />
              <div className="hidden leading-tight sm:block">
                <p className="max-w-36 truncate text-sm font-semibold">{user.name}</p>
                <p className="text-xs text-muted-foreground">{ROLE_LABEL[user.role]}</p>
              </div>
            </Link>
            <Button
              size="sm"
              loading={logout.isPending}
              onClick={() => logout.mutate(undefined, { onSuccess: () => router.replace("/login") })}
            >
              {!logout.isPending && <LogOut className="size-4" aria-hidden />}
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-8 pb-28 sm:px-6 sm:pt-10 sm:pb-14 lg:px-10 lg:pt-14">{children}</main>

      {/* Phone navigation: a thumb-reachable tab bar instead of the header links. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-3 bottom-3 z-40 flex justify-around rounded-full border border-white/10 bg-black/70 p-1.5 shadow-[0_-10px_40px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:hidden"
      >
        {nav.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full px-2 py-2 text-[11px] font-medium transition",
                active ? "text-white" : "text-white/55",
              )}
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-full bg-primary shadow-[0_6px_20px_-8px_var(--primary)]"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <Icon className="relative size-5" aria-hidden />
              <span className="relative truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

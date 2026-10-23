"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, Dumbbell, LayoutDashboard, Library, LogOut, Users, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { useLogout, useSession } from "@/hooks/use-session";
import { ROLE_HOME, ROLE_LABEL, canVisit } from "@/lib/access";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV: NavItem[] = [
  { href: "/member", label: "Dashboard", icon: LayoutDashboard },
  { href: "/trainer", label: "Dashboard", icon: LayoutDashboard },
  { href: "/owner", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/plans", label: "Plans", icon: ClipboardList },
  { href: "/exercises", label: "Exercises", icon: Library },
  { href: "/team", label: "Team", icon: Users },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

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
    if (signedOut) router.replace("/login");
    else if (session && !allowed) router.replace(ROLE_HOME[session.user.role]);
  }, [signedOut, session, allowed, router]);

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
  const nav = NAV.filter((item) => canVisit(session, item.href));

  return (
    <div className="relative isolate flex flex-1 flex-col">
      <Backdrop />

      <header className="sticky top-0 z-40 px-4 pt-4 sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 rounded-full border border-white/10 bg-black/40 py-2 pr-2 pl-4 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:pl-5">
          <Logo href={ROLE_HOME[user.role]} className="text-xl" />

          <nav className="order-last -mx-1 flex w-full gap-1 overflow-x-auto px-1 sm:order-none sm:mx-0 sm:w-auto sm:justify-center sm:px-0" aria-label="Main">
            {nav.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
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
            <div className="hidden items-center gap-3 rounded-full py-1 pr-1 pl-1 sm:flex">
              <span className="grid size-9 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-accent-text ring-1 ring-primary/30">
                {initials(user.name)}
              </span>
              <div className="leading-tight">
                <p className="max-w-36 truncate text-sm font-semibold">{user.name}</p>
                <p className="text-xs text-muted-foreground">{ROLE_LABEL[user.role]}</p>
              </div>
            </div>
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

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-10 lg:py-14">{children}</main>
    </div>
  );
}

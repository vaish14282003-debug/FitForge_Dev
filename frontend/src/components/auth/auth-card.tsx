"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Crown } from "lucide-react";
import { Logo } from "@/components/logo";
import { useSession } from "@/hooks/use-session";
import { ROLE_HOME, canVisit, safeNext } from "@/lib/access";

type AuthCardProps = { title: string; subtitle: string; footer: React.ReactNode; children: React.ReactNode };

export function AuthCard({ title, subtitle, footer, children }: AuthCardProps) {
  const router = useRouter();
  const { data: session } = useSession();

  // Covers both "already signed in" and "just signed in": the forms only need to set the session.
  useEffect(() => {
    if (!session) return;
    // Read directly rather than via useSearchParams so these static pages need no Suspense boundary.
    const next = safeNext(new URLSearchParams(window.location.search).get("next"));
    router.replace(next && canVisit(session, next.split("?")[0]) ? next : ROLE_HOME[session.user.role]);
  }, [session, router]);

  return (
    <div className="grid flex-1 lg:grid-cols-2">
      {/* Same photo and type as the landing hero, so signing in feels like the same product. */}
      <aside className="relative hidden overflow-hidden bg-background text-white lg:flex lg:flex-col lg:justify-between lg:p-16">
        <Image
          src="/hero-gym.webp"
          alt=""
          fill
          loading="eager"
          fetchPriority="high"
          quality={90}
          sizes="50vw"
          className="object-cover"
          aria-hidden
        />
        <div className="absolute inset-0 bg-linear-to-t from-background via-red-950/40 to-black/40" aria-hidden />
        <Logo className="relative text-white" />
        <div className="relative">
          <p className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur">
            <Crown className="size-4 text-accent-text" aria-hidden />
            Members · Trainers · Gyms
          </p>
          <p className="animate-fade-up-delay-1 font-display mt-6 text-[clamp(2.5rem,4.5vw,4.5rem)] leading-[1.02] font-semibold tracking-tight">
            Train.
            <br />
            Track.
            <br />
            <span className="text-primary">Transform.</span>
          </p>
        </div>
      </aside>

      <main className="relative isolate flex flex-col overflow-hidden px-6 py-6 sm:px-10 lg:px-16">
        <div className="pointer-events-none absolute -top-40 -right-40 -z-10 size-[32rem] rounded-full bg-primary/15 blur-[120px]" aria-hidden />
        <Logo className="lg:hidden" />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <div className="animate-fade-up mb-8 space-y-2">
            <h1 className="font-display text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <div className="animate-fade-up-delay-1">{children}</div>
          <p className="animate-fade-up-delay-2 mt-8 text-sm text-muted-foreground">{footer}</p>
        </div>
      </main>
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="animate-fade-in rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {message}
    </p>
  );
}

/** Link between login and register that keeps any `?next=` so the visitor still lands where they meant to. */
export function KeepNextLink({ href, children }: { href: "/login" | "/register"; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      onClick={(e) => {
        e.preventDefault();
        router.push(`${href}${window.location.search}`);
      }}
      className="font-semibold text-foreground underline-offset-4 hover:underline"
    >
      {children}
    </Link>
  );
}

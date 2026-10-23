"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ArrowUpRight, Award, Crown, X } from "lucide-react";

// Hotlinked from a third-party CDN; set NEXT_PUBLIC_HERO_VIDEO_URL (e.g. "/hero.mp4" in public/)
// to serve our own copy. The gym photo shows underneath until the video starts, or if it fails.
const HERO_VIDEO =
  process.env.NEXT_PUBLIC_HERO_VIDEO_URL ||
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260606_154941_df1a96e1-a06f-450c-bd02-d863414cc1a0.mp4";

const NAV_LINKS = [
  { label: "Members", href: "#members" },
  { label: "Trainers", href: "#trainers" },
  { label: "Owners", href: "#owners" },
  { label: "Log in", href: "/login" },
];

// Facts about the product rather than usage numbers we don't have yet.
const STATS = [
  { value: "3", label: "Roles, One App" },
  { value: "24/7", label: "Progress Tracking" },
  { value: "1", label: "Home For Your Gym" },
];

export function LandingHero() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // Each menu item slides in a little after the one above it.
  const stagger = (i: number) => ({
    transitionDelay: menuOpen ? `${i * 80 + 100}ms` : "0ms",
    opacity: menuOpen ? 1 : 0,
    transform: menuOpen ? "translateY(0)" : "translateY(20px)",
  });

  return (
    <section className="relative flex min-h-svh flex-col overflow-hidden bg-background text-white">
      <Image
        src="/hero-gym.webp"
        alt=""
        fill
        loading="eager"
        fetchPriority="high"
        quality={90}
        sizes="100vw"
        className="object-cover"
        aria-hidden
      />
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src={HERO_VIDEO}
        autoPlay
        muted
        loop
        playsInline
        aria-hidden
      />
      {/* Keeps white text readable over any frame of the video. */}
      <div className="absolute inset-0 bg-linear-to-r from-black/70 via-black/30 to-transparent" aria-hidden />
      <div className="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-black/60 to-transparent" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-black/60 to-transparent" aria-hidden />

      <nav className="relative z-10 mx-4 mt-4 flex items-center justify-between rounded-full border border-white/15 bg-black/30 py-2 pr-2 pl-4 backdrop-blur-xl sm:mx-10 sm:pl-5 lg:mx-16 lg:mt-6">
        <Logo className="text-white sm:text-3xl" />

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className="rounded-full px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              {label}
            </Link>
          ))}
        </div>

        <Link
          href="/register"
          className="hidden items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold shadow-[0_10px_30px_-10px_var(--primary)] transition hover:brightness-110 md:inline-flex"
        >
          Get Started
          <ArrowUpRight className="size-4" aria-hidden />
        </Link>

        <button
          type="button"
          className="space-y-1.5 p-2 md:hidden"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen(true)}
        >
          <div className="h-0.5 w-6 bg-white" />
          <div className="h-0.5 w-6 bg-white" />
          <div className="ml-auto h-0.5 w-4 bg-white" />
        </button>
      </nav>

      <div
        id="mobile-menu"
        inert={!menuOpen}
        className={`fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm transition-all duration-500 md:hidden ${
          menuOpen ? "visible opacity-100" : "invisible opacity-0"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5 sm:px-10">
          <Logo className="text-white" />
          <button type="button" className="p-2" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
            <X className="size-7" aria-hidden />
          </button>
        </div>
        <div className="flex flex-1 flex-col items-start justify-center gap-6 px-6 sm:px-10">
          {NAV_LINKS.map(({ label, href }, i) => (
            <Link
              key={label}
              href={href}
              onClick={() => setMenuOpen(false)}
              style={stagger(i)}
              className="font-display text-4xl font-semibold text-white transition-all duration-500 sm:text-5xl"
            >
              {label}
            </Link>
          ))}
          <Link
            href="/register"
            onClick={() => setMenuOpen(false)}
            style={stagger(NAV_LINKS.length)}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold transition-all duration-500 hover:brightness-110"
          >
            Get Started
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-center px-6 pb-12 sm:px-10 lg:px-16">
        <p className="animate-fade-up mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-black/30 px-4 py-1.5 text-xs font-medium text-white/80 backdrop-blur sm:text-sm lg:mb-8">
          <Crown className="size-4 text-accent-text" aria-hidden />
          <span>
            Built for Members, <br className="sm:hidden" />
            Trainers &amp; Gyms
          </span>
        </p>

        <h1 className="animate-fade-up-delay-1 font-display leading-[1.02] font-semibold tracking-tight">
          <span className="block text-[clamp(2.8rem,8vw,7rem)]">Train.</span>
          <span className="block text-[clamp(2.8rem,8vw,7rem)]">Track.</span>
          <span className="block text-[clamp(2.8rem,8vw,7rem)] text-primary">Transform.</span>
        </h1>

        <p className="animate-fade-up-delay-2 mt-6 max-w-md text-sm leading-relaxed text-white/70 sm:text-base lg:mt-8">
          Workouts, progress and gym management in one place.
          <br />
          Built for people who don&apos;t just show up &mdash; <span className="font-bold text-white">they level up.</span>
        </p>

        <div className="animate-fade-up-delay-3 mt-8 flex flex-wrap items-center gap-4 sm:gap-6 lg:mt-10">
          <Link
            href="/register"
            className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_var(--primary)] transition hover:brightness-110 sm:px-8 sm:py-4 sm:text-base"
          >
            Start Training
            <ArrowUpRight
              className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              aria-hidden
            />
          </Link>
          <div className="hidden items-center gap-3 sm:flex">
            <Award className="size-8 text-white/50" aria-hidden />
            <p className="text-sm leading-snug text-white/70">
              All-in-One
              <br />
              Gym Platform
            </p>
          </div>
        </div>

        <dl className="animate-fade-up-delay-4 mt-8 flex flex-wrap gap-6 sm:mt-10 sm:gap-12 lg:mt-14 lg:gap-16">
          {STATS.map(({ value, label }) => (
            <div key={label}>
              <dt className="sr-only">{label}</dt>
              <dd className="text-2xl font-bold tracking-tight sm:text-4xl lg:text-5xl">{value}</dd>
              <dd className="mt-1 text-xs text-white/60 sm:text-sm">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

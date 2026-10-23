import Link from "next/link";
import { ArrowUpRight, Building2, Dumbbell, Users } from "lucide-react";
import { LandingHero } from "@/components/landing-hero";
import { Logo } from "@/components/logo";

const AUDIENCES = [
  {
    id: "members",
    icon: Dumbbell,
    title: "Members",
    body: "Follow your plan, log every set and watch your progress add up.",
  },
  {
    id: "trainers",
    icon: Users,
    title: "Trainers",
    body: "Build workout plans, assign them to clients and keep an eye on how they're doing.",
  },
  {
    id: "owners",
    icon: Building2,
    title: "Gym owners",
    body: "Run members, trainers and memberships from one place.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <LandingHero />

      <section className="bg-background px-6 py-20 text-white sm:px-10 lg:px-16 lg:py-28" aria-labelledby="audiences">
        <h2
          id="audiences"
          className="font-display max-w-2xl text-[clamp(2.25rem,5vw,4rem)] leading-[1.05] font-semibold tracking-tight"
        >
          One platform.
          <br />
          <span className="text-primary">Every role.</span>
        </h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {AUDIENCES.map(({ id, icon: Icon, title, body }) => (
            <article key={id} id={id} className="scroll-mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-8 transition duration-300 hover:-translate-y-1 hover:border-white/20 lg:p-10">
              <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-accent-text ring-1 ring-primary/20">
                <Icon className="size-6" aria-hidden />
              </span>
              <h3 className="font-display mt-6 text-2xl font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/60">{body}</p>
            </article>
          ))}
        </div>
        <Link
          href="/register"
          className="group mt-12 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-semibold shadow-[0_10px_30px_-10px_var(--primary)] transition hover:brightness-110"
        >
          Create your account
          <ArrowUpRight
            className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden
          />
        </Link>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 bg-background px-6 py-8 text-white sm:px-10 lg:px-16">
        <Logo className="text-white" />
        <p className="text-sm text-white/40">© 2026 FitForge</p>
      </footer>
    </div>
  );
}

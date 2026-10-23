"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CalendarCheck, CalendarClock, Check, Copy, IdCard, IndianRupee, UserCog, Users } from "lucide-react";
import { PageHeader, StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { useGym, useGymOverview } from "@/hooks/use-gym";

function JoinCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.35 }}
      className="relative mt-6 flex flex-wrap items-center justify-between gap-6 overflow-hidden rounded-3xl bg-linear-to-br from-primary to-[#a8130a] p-8 shadow-[0_30px_60px_-30px_var(--primary)]"
    >
      <div className="pointer-events-none absolute -right-16 -bottom-24 size-72 rounded-full border-[28px] border-white/10" aria-hidden />
      <div className="relative">
        <p className="text-sm font-medium text-white/80">Member join code</p>
        <p className="mt-2 font-mono text-4xl font-bold tracking-[0.3em]">{code}</p>
        <p className="mt-3 max-w-md text-sm text-white/80">
          Members enter this code when they sign up, and land straight in your gym.
        </p>
      </div>
      <Button className="relative bg-white text-black shadow-none hover:bg-white/90 hover:brightness-100" onClick={copy}>
        {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        {copied ? "Copied" : "Copy code"}
      </Button>
    </motion.section>
  );
}

export default function OwnerDashboard() {
  const { data: gym } = useGym();
  const { data: overview } = useGymOverview();

  return (
    <>
      <PageHeader
        eyebrow="Gym overview"
        title={
          gym ? (
            <>
              <span className="text-primary">{gym.name}</span> at a glance
            </>
          ) : (
            "Your gym at a glance"
          )
        }
        subtitle="Members, trainers and the numbers that keep your gym running."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard index={0} highlight label="Members" icon={Users} value={overview?.members ?? "…"} />
        <StatCard index={1} label="Trainers" icon={UserCog} value={overview?.trainers ?? "…"} />
        <StatCard index={2} label="Staff" icon={IdCard} value={overview?.staff ?? "…"} />
        <StatCard index={3} label="Monthly revenue" icon={IndianRupee} />
        <StatCard index={4} label="Today's attendance" icon={CalendarCheck} />
        <StatCard index={5} label="Expiring memberships" icon={CalendarClock} />
      </div>
      {gym?.joinCode ? <JoinCode code={gym.joinCode} /> : null}
    </>
  );
}

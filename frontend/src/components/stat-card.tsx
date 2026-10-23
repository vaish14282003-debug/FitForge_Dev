"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  /** Leave undefined for features that are not built yet. */
  value?: string | number;
  icon: LucideIcon;
  index?: number;
  /** Solid red card for the one number that matters most on the page. */
  highlight?: boolean;
};

export function StatCard({ label, value, icon: Icon, index = 0, highlight = false }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: "easeOut" }}
    >
      <Card
        className={cn(
          "relative h-full overflow-hidden transition duration-300 hover:-translate-y-0.5",
          highlight
            ? "border-transparent bg-linear-to-br from-primary to-[#a8130a] shadow-[0_20px_50px_-20px_var(--primary)]"
            : "hover:border-white/20",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <CardTitle className={highlight ? "text-white/85" : undefined}>{label}</CardTitle>
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-2xl",
              highlight ? "bg-white/15 text-white" : "bg-primary/10 text-accent-text",
            )}
          >
            <Icon className="size-[18px]" aria-hidden />
          </span>
        </div>
        {value === undefined ? (
          <p className="mt-4 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-muted-foreground">
            Coming soon
          </p>
        ) : (
          <p className="font-display mt-3 truncate text-4xl font-semibold tracking-tight sm:text-5xl">{value}</p>
        )}
      </Card>
    </motion.div>
  );
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col items-center gap-3 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-accent-text ring-1 ring-primary/20">
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="font-display text-2xl font-semibold">{title}</p>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{children}</p>
    </Card>
  );
}

type PageHeaderProps = { title: React.ReactNode; subtitle?: string; eyebrow?: string; actions?: React.ReactNode };

export function PageHeader({ title, subtitle, eyebrow, actions }: PageHeaderProps) {
  return (
    <header className="animate-fade-up mb-10 flex flex-wrap items-end justify-between gap-6">
      <div>
        {eyebrow ? (
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        {subtitle ? <p className="mt-3 max-w-xl text-base text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions}
    </header>
  );
}

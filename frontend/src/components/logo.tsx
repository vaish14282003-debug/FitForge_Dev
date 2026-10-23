import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5 font-display text-2xl font-semibold", className)}>
      <span className="grid size-9 place-items-center rounded-full bg-primary text-white shadow-[0_6px_20px_-6px_var(--primary)]">
        <Dumbbell className="size-[18px]" aria-hidden />
      </span>
      FitForge
    </Link>
  );
}

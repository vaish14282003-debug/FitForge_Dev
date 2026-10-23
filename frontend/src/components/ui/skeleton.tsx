import { cn } from "@/lib/utils";

/** Shimmering placeholder shown while data loads, sized like the content it stands in for. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block animate-pulse rounded-xl bg-white/[0.07]", className)} />;
}

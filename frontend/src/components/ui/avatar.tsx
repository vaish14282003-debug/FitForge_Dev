"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const SIZES = { sm: "size-9 text-sm", md: "size-11 text-base", lg: "size-24 text-3xl", xl: "size-32 text-4xl" };

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

/** A person's photo, or their initials when there's no photo (or it fails to load). */
export function Avatar({
  name,
  src,
  size = "sm",
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = src && failed !== src;

  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary/15 font-semibold text-accent-text ring-1 ring-primary/25",
        SIZES[size],
        className,
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- served by our API with auth cookies, not via next/image
        <img src={src} alt="" className="size-full object-cover" onError={() => setFailed(src)} loading="lazy" />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
    </span>
  );
}

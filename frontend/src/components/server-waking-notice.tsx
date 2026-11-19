"use client";

import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { wakeStore } from "@/lib/wake";

/** Shown while requests wait for the API to wake up (see lib/wake.ts). */
export function ServerWakingNotice() {
  const waking = useSyncExternalStore(wakeStore.subscribe, wakeStore.isWaking, () => false);
  return (
    <AnimatePresence>
      {waking && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="fixed inset-x-4 top-4 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-white/10 bg-[#120b0b]/95 px-4 py-3 text-sm shadow-2xl backdrop-blur-xl"
        >
          <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-white/15 border-t-primary" aria-hidden />
          <span>
            <span className="font-semibold">Waking up the server…</span>{" "}
            <span className="text-muted-foreground">It sleeps when nobody&apos;s using it. This can take up to a minute.</span>
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CloudUpload, WifiOff, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { flushOutbox, outboxStore, readOutbox, removeQueued } from "@/lib/offline";
import { connectionStore, fetchWithWake } from "@/lib/wake";

const subscribeOnline = (callback: () => void) => {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
};

// Re-read when the outbox changes; the snapshot string keeps useSyncExternalStore stable.
const outboxSnapshot = () => JSON.stringify(readOutbox());

/**
 * Uploads workouts saved while offline: on start, when the connection returns, and every 30s while
 * any are waiting. Shows a small status pill above the phone tab bar.
 */
export function OfflineSync({ userId }: { userId: string }) {
  const deviceOnline = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  // Weak signal often still counts as "online", so also follow whether requests get through.
  const reachable = useSyncExternalStore(connectionStore.subscribe, connectionStore.isReachable, () => true);
  const online = deviceOnline && reachable;
  const queue = (JSON.parse(useSyncExternalStore(outboxStore.subscribe, outboxSnapshot, () => "[]")) as ReturnType<typeof readOutbox>).filter(
    (item) => item.userId === userId,
  );
  const waiting = queue.filter((item) => !item.error);
  const refused = queue.filter((item) => item.error);
  const queryClient = useQueryClient();
  const toast = useToast();
  const syncing = useRef(false);

  const sync = useCallback(async () => {
    if (syncing.current || !navigator.onLine) return;
    // Tries even when the last request failed: a successful upload is how we learn signal is back.
    syncing.current = true;
    try {
      const { uploaded } = await flushOutbox(userId, (body) => api("/sessions", { method: "POST", body }));
      if (uploaded > 0) {
        toast({
          title: uploaded === 1 ? "Offline workout uploaded" : `${uploaded} offline workouts uploaded`,
          description: "Your history, streak and records are up to date.",
        });
        queryClient.invalidateQueries({ queryKey: ["sessions"] });
      }
    } finally {
      syncing.current = false;
    }
  }, [userId, toast, queryClient]);

  const hasWaiting = waiting.length > 0;
  useEffect(() => {
    if (!hasWaiting) return;
    // Defer to a task, so a sync never starts in the middle of a render pass.
    const first = setTimeout(sync, 0);
    const timer = setInterval(sync, 30_000);
    window.addEventListener("online", sync);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("online", sync);
    };
  }, [hasWaiting, sync]);

  // While requests aren't getting through, check now and then whether signal is back.
  useEffect(() => {
    if (reachable) return;
    const check = () => {
      fetchWithWake("/api/health").catch(() => {});
    };
    const timer = setInterval(check, 15_000);
    window.addEventListener("online", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", check);
    };
  }, [reachable]);

  if (online && !hasWaiting && refused.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-24 z-50 flex flex-col items-center gap-2 lg:bottom-6" aria-live="polite">
      {!online && (
        <p className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#140c0b]/95 px-4 py-2 text-sm shadow-xl backdrop-blur-xl">
          <WifiOff className="size-4 text-amber-300" aria-hidden />
          You&apos;re offline. Workouts save to this phone.
        </p>
      )}
      {hasWaiting && (
        <p className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#140c0b]/95 px-4 py-2 text-sm shadow-xl backdrop-blur-xl">
          <CloudUpload className="size-4 text-accent-text" aria-hidden />
          {waiting.length === 1 ? "1 workout waiting to upload" : `${waiting.length} workouts waiting to upload`}
          {online && (
            <button type="button" onClick={sync} className="font-semibold text-primary hover:underline">
              Upload now
            </button>
          )}
        </p>
      )}
      {refused.map((item) => (
        <div
          key={item.id}
          role="alert"
          className="pointer-events-auto flex max-w-md items-start gap-2 rounded-2xl border border-amber-400/30 bg-[#140c0b]/95 px-4 py-3 text-sm shadow-xl backdrop-blur-xl"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden />
          <p className="min-w-0 flex-1">
            <span className="font-semibold">{item.label}</span> couldn&apos;t be uploaded: {item.error}
          </p>
          <button
            type="button"
            onClick={() => removeQueued(item.id)}
            className="-m-1 rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label={`Remove ${item.label} from this phone`}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}

// The API runs on a hosting plan that sleeps after a while without visitors. While it starts up
// (up to about a minute) the host answers 502, or the connection drops. Instead of failing, requests
// wait and retry, and the app shows a "waking up" notice.

const RETRY_FOR_MS = 75_000;
const delays = [1000, 2000, 3000, 4000, 5000];

/**
 * Whether a failed attempt may be retried. A 502 means the request never reached FitForge, so any
 * method is safe to resend. Dropped connections, 503 and 504 might have reached it, so only reads.
 */
export function shouldRetry(method: string, outcome: number | "network-error") {
  if (outcome === 502) return true;
  const read = method.toUpperCase() === "GET" || method.toUpperCase() === "HEAD";
  return read && (outcome === "network-error" || outcome === 503 || outcome === 504);
}

export const retryDelay = (attempt: number) => delays[Math.min(attempt, delays.length - 1)];

// Tiny store for the notice; read with useSyncExternalStore.
let waking = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export const wakeStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  isWaking: () => waking > 0,
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** fetch() that rides out the API waking up. */
export async function fetchWithWake(url: string, init: RequestInit = {}, fetcher: typeof fetch = fetch) {
  const method = init.method ?? "GET";
  const started = Date.now();
  let markedWaking = false;
  try {
    for (let attempt = 0; ; attempt++) {
      let outcome: number | "network-error";
      let res: Response | undefined;
      try {
        res = await fetcher(url, init);
        outcome = res.status;
      } catch (err) {
        outcome = "network-error";
        if (!shouldRetry(method, outcome) || Date.now() - started > RETRY_FOR_MS) throw err;
      }
      if (res && !shouldRetry(method, outcome)) return res;
      if (Date.now() - started > RETRY_FOR_MS) {
        if (res) return res;
        throw new Error("The server did not respond");
      }
      if (!markedWaking) {
        markedWaking = true;
        waking++;
        emit();
      }
      await sleep(retryDelay(attempt));
    }
  } finally {
    if (markedWaking) {
      waking--;
      emit();
    }
  }
}

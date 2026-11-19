import { ApiError } from "./api";
import type { SessionInput } from "./types";

/**
 * Offline support for the gym floor, where signal comes and goes:
 * - snapshots: the last copy of data the workout screens need (session, plans), so they still open
 *   without a connection;
 * - outbox: finished workouts that couldn't be uploaded, sent automatically once back online.
 * Everything lives in this browser's localStorage and is cleared on logout.
 */

type KV = Pick<Storage, "getItem" | "setItem" | "removeItem"> & { key(index: number): string | null; readonly length: number };

const browserStorage = (): KV | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

const SNAPSHOT_PREFIX = "ff-snapshot:";
const OUTBOX_KEY = "ff-outbox";

/** True when a request failed for lack of a connection, rather than the server saying no. */
export function isOfflineError(err: unknown) {
  if (err instanceof ApiError) return err.status === 502 || err.status === 503 || err.status === 504;
  return true; // fetch() rejected: no network, DNS failure, or the server never answered
}

// ---- Snapshots ----------------------------------------------------------------------------------

export function readSnapshot<T>(key: string, storage = browserStorage()): T | undefined {
  try {
    const raw = storage?.getItem(SNAPSHOT_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

export function writeSnapshot(key: string, value: unknown, storage = browserStorage()) {
  try {
    storage?.setItem(SNAPSHOT_PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: offline copies are a convenience.
  }
}

/**
 * Fetch, remembering the result; without a connection, fall back to the last remembered copy.
 * Server refusals (401, 404...) are passed through, so access rules never use stale data.
 */
export async function withSnapshot<T>(key: string, fetcher: () => Promise<T>, storage = browserStorage()): Promise<T> {
  try {
    const value = await fetcher();
    writeSnapshot(key, value, storage);
    return value;
  } catch (err) {
    const saved = isOfflineError(err) ? readSnapshot<T>(key, storage) : undefined;
    if (saved !== undefined) return saved;
    throw err;
  }
}

// ---- Outbox -------------------------------------------------------------------------------------

export type QueuedWorkout = {
  /** Same as body.clientId; the server ignores a second upload with it. */
  id: string;
  /** Whose workout it is, so a different person signing in on this phone never uploads it. */
  userId: string;
  body: SessionInput & { clientId: string; completedAt: string };
  label: string;
  queuedAt: string;
  /** Set when the server refused it (e.g. the plan was deleted); kept so nothing is silently lost. */
  error?: string;
};

export function readOutbox(storage = browserStorage()): QueuedWorkout[] {
  try {
    const items = JSON.parse(storage?.getItem(OUTBOX_KEY) ?? "[]");
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function writeOutbox(items: QueuedWorkout[], storage = browserStorage()) {
  try {
    if (items.length) storage?.setItem(OUTBOX_KEY, JSON.stringify(items));
    else storage?.removeItem(OUTBOX_KEY);
  } catch {
    // Nothing more we can do; the workout stays in memory until the page closes.
  }
  outboxListeners.forEach((listener) => listener());
}

export function enqueueWorkout(item: QueuedWorkout, storage = browserStorage()) {
  writeOutbox([...readOutbox(storage).filter((q) => q.id !== item.id), item], storage);
}

export function removeQueued(id: string, storage = browserStorage()) {
  writeOutbox(readOutbox(storage).filter((q) => q.id !== id), storage);
}

const outboxListeners = new Set<() => void>();
export const outboxStore = {
  subscribe(listener: () => void) {
    outboxListeners.add(listener);
    return () => {
      outboxListeners.delete(listener);
    };
  },
};

/**
 * Uploads this user's queued workouts, oldest first. Stops at the first connection failure (still
 * offline); a refusal from the server is recorded on the item and the rest carry on.
 */
export async function flushOutbox(
  userId: string,
  upload: (body: QueuedWorkout["body"]) => Promise<unknown>,
  storage = browserStorage(),
): Promise<{ uploaded: number; failed: number; offline: boolean }> {
  let uploaded = 0;
  let failed = 0;
  for (const item of readOutbox(storage)) {
    if (item.userId !== userId || item.error) continue;
    try {
      await upload(item.body);
      removeQueued(item.id, storage);
      uploaded++;
    } catch (err) {
      if (isOfflineError(err)) return { uploaded, failed, offline: true };
      const message = err instanceof Error ? err.message : "The server refused this workout";
      writeOutbox(readOutbox(storage).map((q) => (q.id === item.id ? { ...q, error: message } : q)), storage);
      failed++;
    }
  }
  return { uploaded, failed, offline: false };
}

/** On logout: drop remembered data. Queued workouts stay (they're tied to their owner's id). */
export function clearSnapshots(storage = browserStorage()) {
  if (!storage) return;
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(SNAPSHOT_PREFIX)) keys.push(key);
  }
  keys.forEach((key) => storage.removeItem(key));
}

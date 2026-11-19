import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { clearSnapshots, enqueueWorkout, flushOutbox, isOfflineError, readOutbox, readSnapshot, withSnapshot, type QueuedWorkout } from "./offline";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

const workout = (id: string, userId = "u1"): QueuedWorkout => ({
  id,
  userId,
  label: "Push",
  queuedAt: "2026-11-19T07:00:00.000Z",
  body: { planId: "p", dayIndex: 0, startedAt: "2026-11-19T06:00:00.000Z", completedAt: "2026-11-19T07:00:00.000Z", clientId: id, notes: "", entries: [] },
});

describe("isOfflineError", () => {
  it("separates lost connections from server refusals", () => {
    expect(isOfflineError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isOfflineError(new ApiError(502, "Bad gateway"))).toBe(true);
    expect(isOfflineError(new ApiError(400, "Bad request"))).toBe(false);
    expect(isOfflineError(new ApiError(401, "Login"))).toBe(false);
  });
});

describe("withSnapshot", () => {
  it("remembers the last result and serves it while offline", async () => {
    const storage = memoryStorage();
    expect(await withSnapshot("plans", async () => ["a"], storage)).toEqual(["a"]);
    expect(await withSnapshot("plans", () => Promise.reject(new TypeError("offline")), storage)).toEqual(["a"]);
  });

  it("never hides a refusal behind an old copy", async () => {
    const storage = memoryStorage();
    await withSnapshot("plans", async () => ["a"], storage);
    await expect(withSnapshot("plans", () => Promise.reject(new ApiError(401, "Login")), storage)).rejects.toThrow("Login");
  });

  it("fails normally offline when nothing was remembered", async () => {
    await expect(withSnapshot("x", () => Promise.reject(new TypeError("offline")), memoryStorage())).rejects.toThrow("offline");
  });

  it("is cleared on logout", async () => {
    const storage = memoryStorage();
    await withSnapshot("session", async () => ({ user: 1 }), storage);
    enqueueWorkout(workout("w1"), storage);
    clearSnapshots(storage);
    expect(readSnapshot("session", storage)).toBeUndefined();
    expect(readOutbox(storage)).toHaveLength(1);
  });
});

describe("outbox", () => {
  it("uploads queued workouts and empties the queue", async () => {
    const storage = memoryStorage();
    enqueueWorkout(workout("w1"), storage);
    enqueueWorkout(workout("w2"), storage);
    const upload = vi.fn().mockResolvedValue({});
    expect(await flushOutbox("u1", upload, storage)).toEqual({ uploaded: 2, failed: 0, offline: false });
    expect(upload).toHaveBeenCalledTimes(2);
    expect(readOutbox(storage)).toEqual([]);
  });

  it("stops and keeps everything while still offline", async () => {
    const storage = memoryStorage();
    enqueueWorkout(workout("w1"), storage);
    enqueueWorkout(workout("w2"), storage);
    const upload = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await flushOutbox("u1", upload, storage)).toEqual({ uploaded: 0, failed: 0, offline: true });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(readOutbox(storage)).toHaveLength(2);
  });

  it("marks a refused workout instead of dropping it, and carries on", async () => {
    const storage = memoryStorage();
    enqueueWorkout(workout("w1"), storage);
    enqueueWorkout(workout("w2"), storage);
    const upload = vi.fn().mockRejectedValueOnce(new ApiError(404, "Plan not found")).mockResolvedValueOnce({});
    expect(await flushOutbox("u1", upload, storage)).toEqual({ uploaded: 1, failed: 1, offline: false });
    expect(readOutbox(storage)).toEqual([expect.objectContaining({ id: "w1", error: "Plan not found" })]);
  });

  it("only uploads the signed-in person's workouts", async () => {
    const storage = memoryStorage();
    enqueueWorkout(workout("w1", "someone-else"), storage);
    const upload = vi.fn().mockResolvedValue({});
    await flushOutbox("u1", upload, storage);
    expect(upload).not.toHaveBeenCalled();
    expect(readOutbox(storage)).toHaveLength(1);
  });

  it("doesn't queue the same workout twice", () => {
    const storage = memoryStorage();
    enqueueWorkout(workout("w1"), storage);
    enqueueWorkout(workout("w1"), storage);
    expect(readOutbox(storage)).toHaveLength(1);
  });
});

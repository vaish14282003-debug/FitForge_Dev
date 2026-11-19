import { afterEach, describe, expect, it, vi } from "vitest";
import { connectionStore, fetchWithWake, shouldRetry, wakeStore } from "./wake";

const response = (status: number) => new Response(null, { status });

describe("shouldRetry", () => {
  it("retries a 502 for any method, since the request never reached the API", () => {
    expect(shouldRetry("POST", 502)).toBe(true);
    expect(shouldRetry("GET", 502)).toBe(true);
  });
  it("retries 503 and 504 only for reads", () => {
    for (const outcome of [503, 504] as const) {
      expect(shouldRetry("GET", outcome)).toBe(true);
      expect(shouldRetry("POST", outcome)).toBe(false);
    }
  });
  it("never waits on a dropped connection: that's no signal, not a sleeping server", () => {
    expect(shouldRetry("GET", "network-error")).toBe(false);
    expect(shouldRetry("POST", "network-error")).toBe(false);
  });
  it("never retries real answers", () => {
    for (const status of [200, 400, 401, 404, 500]) expect(shouldRetry("GET", status)).toBe(false);
  });
});

describe("fetchWithWake", () => {
  afterEach(() => vi.useRealTimers());

  it("waits through a sleeping server and shows the notice meanwhile", async () => {
    vi.useFakeTimers();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(502))
      .mockResolvedValueOnce(response(503))
      .mockResolvedValueOnce(response(200));

    const pending = fetchWithWake("/api/auth/me", {}, fetcher);
    await vi.advanceTimersByTimeAsync(0);
    expect(wakeStore.isWaking()).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);

    expect((await pending).status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(wakeStore.isWaking()).toBe(false);
  });

  it("does not resend a POST that may have reached the API", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(503));
    expect((await fetchWithWake("/api/bookings", { method: "POST" }, fetcher)).status).toBe(503);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("gives up after about 75 seconds", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(502));
    const pending = fetchWithWake("/api/health", {}, fetcher);
    await vi.advanceTimersByTimeAsync(80_000);
    expect((await pending).status).toBe(502);
    expect(wakeStore.isWaking()).toBe(false);
  });

  it("fails at once on a dropped connection, without the waking notice", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(fetchWithWake("/api/auth/me", {}, fetcher)).rejects.toThrow("Failed to fetch");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(wakeStore.isWaking()).toBe(false);
    expect(connectionStore.isReachable()).toBe(false);

    await fetchWithWake("/api/auth/me", {}, vi.fn<typeof fetch>().mockResolvedValue(response(200)));
    expect(connectionStore.isReachable()).toBe(true);
  });
});

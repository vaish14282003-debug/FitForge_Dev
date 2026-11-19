import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithWake, shouldRetry, wakeStore } from "./wake";

const response = (status: number) => new Response(null, { status });

describe("shouldRetry", () => {
  it("retries a 502 for any method, since the request never reached the API", () => {
    expect(shouldRetry("POST", 502)).toBe(true);
    expect(shouldRetry("GET", 502)).toBe(true);
  });
  it("retries dropped connections, 503 and 504 only for reads", () => {
    for (const outcome of ["network-error", 503, 504] as const) {
      expect(shouldRetry("GET", outcome)).toBe(true);
      expect(shouldRetry("POST", outcome)).toBe(false);
    }
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
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
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
});

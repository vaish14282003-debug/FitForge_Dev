"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AttendanceStats, AttendanceSummary, CheckInResult } from "@/lib/types";

const tz = () => new Date().getTimezoneOffset();

export function useAttendanceSummary(memberId?: string) {
  const params = new URLSearchParams({ tz: String(tz()) });
  if (memberId) params.set("member", memberId);
  return useQuery({
    queryKey: ["attendance", "summary", memberId ?? "me"],
    queryFn: () => api<{ summary: AttendanceSummary }>(`/attendance/summary?${params}`).then((r) => r.summary),
  });
}

/** Gym-wide counts for the front desk and owner dashboard; polls so new check-ins appear on their own. */
export function useAttendanceStats(days = 14, live = false) {
  return useQuery({
    queryKey: ["attendance", "stats", days],
    queryFn: () => api<{ stats: AttendanceStats }>(`/attendance/stats?tz=${tz()}&days=${days}`).then((r) => r.stats),
    refetchInterval: live ? 10_000 : false,
  });
}

/** Rotates the front-desk QR token every minute; each token is valid for two. */
export function useQrToken() {
  return useQuery({
    queryKey: ["attendance", "qr"],
    queryFn: () => api<{ token: string; expiresAt: string; ttlSeconds: number }>("/attendance/qr"),
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });
}

export function useQrCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api<CheckInResult>("/attendance/check-in", { method: "POST", body: { token, tz: tz() } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance"] }),
  });
}

export function useStaffCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => api<CheckInResult>("/attendance", { method: "POST", body: { memberId, tz: tz() } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance"] }),
  });
}

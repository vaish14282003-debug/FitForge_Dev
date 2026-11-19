"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { withSnapshot } from "@/lib/offline";
import type { PreviousSets, SessionInput, TrainingSummary, WorkoutSession } from "@/lib/types";

export function useTrainingSummary() {
  return useQuery({
    queryKey: ["sessions", "summary"],
    // The browser's offset, so "today" and streaks follow the member's own clock.
    queryFn: () =>
      withSnapshot("training-summary", () =>
        api<{ summary: TrainingSummary }>(`/sessions/summary?tz=${new Date().getTimezoneOffset()}`).then((r) => r.summary),
      ),
  });
}

export function useSessions(params: { member?: string; pendingReview?: boolean; limit?: number } = {}, enabled = true) {
  const search = new URLSearchParams();
  if (params.member) search.set("member", params.member);
  if (params.pendingReview) search.set("pendingReview", "true");
  if (params.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return useQuery({
    queryKey: ["sessions", "list", params],
    queryFn: () => api<{ sessions: WorkoutSession[] }>(`/sessions${query ? `?${query}` : ""}`).then((r) => r.sessions),
    enabled,
  });
}

export function usePreviousSets(exerciseIds: string[]) {
  const ids = [...new Set(exerciseIds)].slice(0, 20);
  return useQuery({
    queryKey: ["sessions", "previous", ids],
    queryFn: () => api<{ previous: PreviousSets }>(`/sessions/previous?exercises=${ids.join(",")}`).then((r) => r.previous),
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SessionInput) => api<{ session: WorkoutSession }>("/sessions", { method: "POST", body }).then((r) => r.session),
    // Fail straight away without signal (rather than pausing) so the logger can keep it offline.
    networkMode: "always",
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });
}

export function useReviewSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      api<{ session: WorkoutSession }>(`/sessions/${id}/review`, { method: "PATCH", body: { comment } }).then((r) => r.session),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });
}

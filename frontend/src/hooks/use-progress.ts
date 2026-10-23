"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { BodyMetric, MetricInput, ProgressMetrics, StrengthSeries, TrainingProgress } from "@/lib/types";

// `memberId` is for trainers and owners viewing a client; members leave it out.
const withMember = (path: string, memberId?: string, extra: Record<string, string> = {}) => {
  const params = new URLSearchParams(extra);
  if (memberId) params.set("member", memberId);
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}`;
};

export function useMetrics(memberId?: string) {
  return useQuery({
    queryKey: ["progress", "metrics", memberId ?? "me"],
    queryFn: () => api<ProgressMetrics>(withMember("/progress/metrics", memberId)),
  });
}

export function useTrainingProgress(memberId?: string, weeks = 12) {
  return useQuery({
    queryKey: ["progress", "training", memberId ?? "me", weeks],
    queryFn: () =>
      api<TrainingProgress>(
        withMember("/progress/training", memberId, { weeks: String(weeks), tz: String(new Date().getTimezoneOffset()) }),
      ),
  });
}

export function useStrength(exerciseId: string | null, memberId?: string) {
  return useQuery({
    queryKey: ["progress", "strength", memberId ?? "me", exerciseId],
    queryFn: () => api<StrengthSeries>(withMember("/progress/strength", memberId, { exercise: exerciseId! })),
    enabled: !!exerciseId,
    placeholderData: (previous) => previous,
  });
}

export function useUpsertMetric() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: MetricInput) => api<{ metric: BodyMetric }>("/progress/metrics", { method: "PUT", body }).then((r) => r.metric),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["progress", "metrics"] }),
  });
}

export function useDeleteMetric() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/progress/metrics/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["progress", "metrics"] }),
  });
}

export function useSetGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetWeight: number | null) =>
      api<{ goal: { targetWeight: number | null } }>("/progress/goal", { method: "PUT", body: { targetWeight } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["progress", "metrics"] }),
  });
}

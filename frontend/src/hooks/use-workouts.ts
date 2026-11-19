"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { withSnapshot } from "@/lib/offline";
import type { Equipment, Exercise, MuscleGroup, PlanInput, WorkoutPlan } from "@/lib/types";

export function useExercises(filters: { muscleGroup?: MuscleGroup | null; q?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.muscleGroup) params.set("muscleGroup", filters.muscleGroup);
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  const query = params.toString();

  return useQuery({
    queryKey: ["exercises", filters.muscleGroup ?? null, filters.q?.trim() ?? ""],
    queryFn: () => api<{ exercises: Exercise[] }>(`/exercises${query ? `?${query}` : ""}`).then((r) => r.exercises),
    placeholderData: (previous) => previous,
  });
}

export type ExerciseInput = { name: string; muscleGroup: MuscleGroup; equipment: Equipment; instructions: string };

export function useCreateExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ExerciseInput) => api<{ exercise: Exercise }>("/exercises", { method: "POST", body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exercises"] }),
  });
}

export function usePlans() {
  return useQuery({
    queryKey: ["plans"],
    // Remembered for offline use: members open their workout from this list.
    queryFn: () => withSnapshot("plans", () => api<{ plans: WorkoutPlan[] }>("/plans").then((r) => r.plans)),
  });
}

export function usePlan(id: string | undefined) {
  return useQuery({
    queryKey: ["plans", id],
    queryFn: () => withSnapshot(`plan:${id}`, () => api<{ plan: WorkoutPlan }>(`/plans/${id}`).then((r) => r.plan)),
    enabled: !!id,
  });
}

/** Creates the plan when there is no id yet, otherwise replaces it. Then syncs who is assigned. */
export function useSavePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body, memberIds }: { id?: string; body: PlanInput; memberIds: string[] | null }) => {
      const { plan } = await api<{ plan: WorkoutPlan }>(id ? `/plans/${id}` : "/plans", {
        method: id ? "PUT" : "POST",
        body,
      });
      if (memberIds === null) return plan;
      const assigned = await api<{ plan: WorkoutPlan }>(`/plans/${plan.id}/assignees`, {
        method: "PUT",
        body: { memberIds },
      });
      return assigned.plan;
    },
    onSuccess: (plan) => {
      queryClient.setQueryData(["plans", plan.id], plan);
      queryClient.invalidateQueries({ queryKey: ["plans"], exact: true });
    },
  });
}

export function useDeletePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/plans/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: ["plans", id] });
      queryClient.invalidateQueries({ queryKey: ["plans"], exact: true });
    },
  });
}

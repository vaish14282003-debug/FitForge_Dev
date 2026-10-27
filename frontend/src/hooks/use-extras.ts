"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ClientNote, FoodEntry, Meal, NutritionDay, NutritionGoals, Resource, TrainerPerformance } from "@/lib/types";

const tz = () => new Date().getTimezoneOffset();
export const todayKey = () => new Date().toLocaleDateString("en-CA");

// ---- client notes

export function useClientNotes(memberId: string) {
  return useQuery({ queryKey: ["notes", memberId], queryFn: () => api<{ notes: ClientNote[] }>(`/clients/${memberId}/notes`).then((r) => r.notes) });
}

export function useAddNote(memberId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api<{ note: ClientNote }>(`/clients/${memberId}/notes`, { method: "POST", body: { body } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notes", memberId] }),
  });
}

export function useDeleteNote(memberId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => api<void>(`/clients/${memberId}/notes/${noteId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notes", memberId] }),
  });
}

// ---- resources

export function useResources() {
  return useQuery({ queryKey: ["resources"], queryFn: () => api<{ resources: Resource[] }>("/resources").then((r) => r.resources) });
}

export function useUploadResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, title, description, memberIds }: { file: File; title: string; description: string; memberIds: string[] }) => {
      const form = new FormData();
      form.append("title", title);
      form.append("description", description);
      if (memberIds.length) form.append("memberIds", memberIds.join(","));
      form.append("file", file);
      return api<{ resource: Resource }>("/resources", { method: "POST", body: form }).then((r) => r.resource);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["resources"] }),
  });
}

export function useDeleteResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/resources/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["resources"] }),
  });
}

// ---- nutrition

export function useNutrition(day: string, memberId?: string) {
  const params = new URLSearchParams({ day, tz: String(tz()) });
  if (memberId) params.set("member", memberId);
  return useQuery({
    queryKey: ["nutrition", memberId ?? "me", day],
    queryFn: () => api<NutritionDay>(`/nutrition?${params}`),
    placeholderData: (previous) => previous,
  });
}

function useRefreshNutrition() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["nutrition"] });
}

export function useSetNutritionGoals() {
  const refresh = useRefreshNutrition();
  return useMutation({
    mutationFn: (goals: Partial<NutritionGoals>) => api<{ goals: NutritionGoals }>("/nutrition/goals", { method: "PUT", body: goals }),
    onSuccess: refresh,
  });
}

export function useAddFood() {
  const refresh = useRefreshNutrition();
  return useMutation({
    mutationFn: (body: Omit<FoodEntry, "id"> & { day: string; meal: Meal }) => api("/nutrition/entries", { method: "POST", body }),
    onSuccess: refresh,
  });
}

export function useDeleteFood() {
  const refresh = useRefreshNutrition();
  return useMutation({ mutationFn: (id: string) => api(`/nutrition/entries/${id}`, { method: "DELETE" }), onSuccess: refresh });
}

export function useSetWater() {
  const refresh = useRefreshNutrition();
  return useMutation({
    mutationFn: ({ day, waterMl }: { day: string; waterMl: number }) => api("/nutrition/water", { method: "PUT", body: { day, waterMl } }),
    onSuccess: refresh,
  });
}

// ---- reports

export function useTrainerPerformance(from: string, to: string) {
  return useQuery({
    queryKey: ["reports", "trainers", from, to],
    queryFn: () => api<{ from: string; to: string; trainers: TrainerPerformance[] }>(`/reports/trainers?from=${from}&to=${to}&tz=${tz()}`),
  });
}

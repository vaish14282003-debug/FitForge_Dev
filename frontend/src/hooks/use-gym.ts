"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Gym, GymOverview, Role, User } from "@/lib/types";

export type ManagedRole = Extract<Role, "MEMBER" | "TRAINER" | "STAFF">;

export function useGym() {
  return useQuery({ queryKey: ["gym"], queryFn: () => api<{ gym: Gym }>("/gym").then((r) => r.gym) });
}

/** Public check of a join code during sign-up. Only runs for a full 8-character code. */
export function useGymLookup(code: string) {
  return useQuery({
    queryKey: ["gym-lookup", code],
    queryFn: () => api<{ gym: { name: string } }>(`/gym/lookup?code=${encodeURIComponent(code)}`).then((r) => r.gym),
    enabled: code.length === 8,
    retry: false,
    staleTime: 60 * 1000,
  });
}

export function useGymOverview() {
  return useQuery({
    queryKey: ["gym", "overview"],
    queryFn: () => api<{ overview: GymOverview }>("/gym/overview").then((r) => r.overview),
  });
}

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: () => api<{ clients: User[] }>("/users/clients").then((r) => r.clients),
  });
}

export function useUsers(role: ManagedRole, enabled = true) {
  return useQuery({
    queryKey: ["users", role],
    queryFn: () => api<{ users: User[] }>(`/users?role=${role}`).then((r) => r.users),
    enabled,
  });
}

export type CreateUserInput = { name: string; email: string; password: string; role: ManagedRole };

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateUserInput) => api<{ user: User }>("/users", { method: "POST", body }),
    onSuccess: (_data, { role }) => {
      queryClient.invalidateQueries({ queryKey: ["users", role] });
      queryClient.invalidateQueries({ queryKey: ["gym", "overview"] });
    },
  });
}

export function useAssignTrainer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, trainerId }: { memberId: string; trainerId: string | null }) =>
      api<{ user: User }>(`/users/${memberId}/trainer`, { method: "PATCH", body: { trainerId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users", "MEMBER"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

export function useRotateJoinCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ gym: Gym }>("/gym/join-code", { method: "POST" }).then((r) => r.gym),
    onSuccess: (gym) => queryClient.setQueryData(["gym"], gym),
  });
}

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FitnessGoal, Session, User } from "@/lib/types";

export type ProfileInput = Partial<{
  name: string;
  phone: string;
  bio: string;
  heightCm: number | null;
  dateOfBirth: string | null;
  fitnessGoal: FitnessGoal | null;
}>;

/** Keeps the signed-in user in the session cache in step with what the server returned. */
function useApplyUser() {
  const queryClient = useQueryClient();
  return (user: User) => {
    queryClient.setQueryData<Session | null>(["session"], (session) => (session ? { ...session, user: { ...session.user, ...user } } : session));
    // Names and photos also appear in lists elsewhere.
    queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "session" });
  };
}

export function useUpdateProfile() {
  const apply = useApplyUser();
  return useMutation({
    mutationFn: (body: ProfileInput) => api<{ user: User }>("/users/me", { method: "PATCH", body }).then((r) => r.user),
    onSuccess: apply,
  });
}

export function useUploadAvatar() {
  const apply = useApplyUser();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("avatar", file);
      return api<{ user: User }>("/users/me/avatar", { method: "POST", body: form }).then((r) => r.user);
    },
    onSuccess: apply,
  });
}

export function useRemoveAvatar() {
  const apply = useApplyUser();
  return useMutation({
    mutationFn: () => api<{ user: User }>("/users/me/avatar", { method: "DELETE" }).then((r) => r.user),
    onSuccess: apply,
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) => api<void>("/users/me/password", { method: "POST", body }),
  });
}

export function useUploadExerciseImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const form = new FormData();
      form.append("image", file);
      return api<{ exercise: unknown }>(`/exercises/${id}/image`, { method: "POST", body: form });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exercises"] }),
  });
}

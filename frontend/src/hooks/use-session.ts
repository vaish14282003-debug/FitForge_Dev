"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Session } from "@/lib/types";

const SESSION_KEY = ["session"];

async function fetchSession(): Promise<Session | null> {
  try {
    return await api<Session>("/auth/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

/** `data` is undefined while loading, null when signed out. */
export function useSession() {
  return useQuery({ queryKey: SESSION_KEY, queryFn: fetchSession, staleTime: 5 * 60 * 1000, retry: false });
}

export type LoginInput = { email: string; password: string };
export type RegisterInput = LoginInput & { name: string } & (
    | { role: "GYM_OWNER"; gymName: string }
    | { role: "MEMBER"; gymCode: string }
  );

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginInput) => api<Session>("/auth/login", { method: "POST", body }),
    onSuccess: (session) => queryClient.setQueryData(SESSION_KEY, session),
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RegisterInput) => api<Session>("/auth/register", { method: "POST", body }),
    onSuccess: (session) => queryClient.setQueryData(SESSION_KEY, session),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/auth/logout", { method: "POST" }),
    // Drop everything cached for the previous user, not just the session.
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(SESSION_KEY, null);
    },
  });
}

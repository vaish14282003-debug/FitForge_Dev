"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { StravaStatus, WorkoutSession } from "@/lib/types";

const KEY = ["strava"];

export function useStrava(enabled = true) {
  return useQuery({ queryKey: KEY, queryFn: () => api<StravaStatus>("/integrations/strava"), enabled, staleTime: 60_000 });
}

/** Asks the API for Strava's approval page and goes there; Strava sends the browser back to Profile. */
export function useConnectStrava() {
  return useMutation({
    mutationFn: () => api<{ url: string }>("/integrations/strava/connect", { method: "POST" }),
    onSuccess: ({ url }) => window.location.assign(url),
  });
}

export function useStravaAutoUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (autoUpload: boolean) => api<{ connection: StravaStatus["connection"] }>("/integrations/strava", { method: "PATCH", body: { autoUpload } }),
    onSuccess: ({ connection }) => queryClient.setQueryData<StravaStatus>(KEY, (s) => (s ? { ...s, connection } : s)),
  });
}

export function useDisconnectStrava() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/integrations/strava", { method: "DELETE" }),
    onSuccess: () => queryClient.setQueryData<StravaStatus>(KEY, (s) => (s ? { ...s, connection: null } : s)),
  });
}

export function useSendToStrava() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      api<{ session: WorkoutSession }>(`/integrations/strava/sessions/${sessionId}`, { method: "POST" }).then((r) => r.session),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      // A revoked connection is removed by the server; refresh the card too.
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}

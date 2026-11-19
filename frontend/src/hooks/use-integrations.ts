"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Integration, IntegrationConnection, WorkoutSession } from "@/lib/types";

const KEY = ["integrations"];

/** Fitness services this server offers (Strava…), with the member's connection to each. */
export function useIntegrations(enabled = true) {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api<{ integrations: Integration[] }>("/integrations").then((r) => r.integrations),
    enabled,
    staleTime: 60_000,
  });
}

/** Asks the API for the provider's approval page and goes there; the provider sends the browser back to Profile. */
export function useConnectIntegration() {
  return useMutation({
    mutationFn: (provider: string) => api<{ url: string }>(`/integrations/${provider}/connect`, { method: "POST" }),
    onSuccess: ({ url }) => window.location.assign(url),
  });
}

const setConnection = (provider: string, connection: IntegrationConnection | null) => (list: Integration[] | undefined) =>
  list?.map((i) => (i.provider === provider ? { ...i, connection } : i));

export function useIntegrationAutoUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, autoUpload }: { provider: string; autoUpload: boolean }) =>
      api<{ connection: IntegrationConnection }>(`/integrations/${provider}`, { method: "PATCH", body: { autoUpload } }),
    onSuccess: ({ connection }) => queryClient.setQueryData(KEY, setConnection(connection.provider, connection)),
  });
}

export function useDisconnectIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) => api<void>(`/integrations/${provider}`, { method: "DELETE" }),
    onSuccess: (_data, provider) => queryClient.setQueryData(KEY, setConnection(provider, null)),
  });
}

export function useSendWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, sessionId }: { provider: string; sessionId: string }) =>
      api<{ session: WorkoutSession }>(`/integrations/${provider}/sessions/${sessionId}`, { method: "POST" }).then((r) => r.session),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      // A revoked connection is removed by the server; refresh the card too.
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}

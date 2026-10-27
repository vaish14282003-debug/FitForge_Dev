"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Announcement, AppNotification } from "@/lib/types";

const tz = () => new Date().getTimezoneOffset();

/** The bell badge. Polls, so alerts created by other people show up without a refresh. */
export function useUnreadCount() {
  return useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => api<{ unread: number }>(`/notifications/unread-count?tz=${tz()}`).then((r) => r.unread),
    refetchInterval: 30_000,
  });
}

export function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: ["notifications", "list"],
    queryFn: () => api<{ notifications: AppNotification[]; unread: number }>(`/notifications?tz=${tz()}`),
    enabled,
  });
}

function useRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["notifications"] });
}

export function useMarkRead() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: "POST" }), onSuccess: refresh });
}

export function useMarkAllRead() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: () => api("/notifications/read-all", { method: "POST" }), onSuccess: refresh });
}

export function useAnnouncements() {
  return useQuery({ queryKey: ["announcements"], queryFn: () => api<{ announcements: Announcement[] }>("/announcements").then((r) => r.announcements) });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Pick<Announcement, "title" | "body" | "audience" | "pinned">) =>
      api<{ announcement: Announcement; notified: number }>("/announcements", { method: "POST", body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["announcements"] }),
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/announcements/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["announcements"] }),
  });
}

export function useSendMessage() {
  return useMutation({
    mutationFn: (body: { memberIds: string[]; title: string; body: string }) => api<{ sent: number }>("/notifications/messages", { method: "POST", body }),
  });
}

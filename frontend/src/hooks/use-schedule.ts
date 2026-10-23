"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Availability, Booking, GymClass, SlotDays, UserRef } from "@/lib/types";

const tz = () => new Date().getTimezoneOffset();
const qs = (params: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]).toString();

export function useAvailability(trainerId?: string, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["schedule", "availability", trainerId ?? "me"],
    queryFn: () => api<{ availability: Availability; trainer: UserRef }>(`/schedule/availability?${qs({ trainer: trainerId })}`),
  });
}

export function useSlots(days = 7, enabled = true) {
  return useQuery({
    queryKey: ["schedule", "slots", days],
    queryFn: () => api<SlotDays>(`/schedule/slots?${qs({ days, tz: tz() })}`),
    enabled,
  });
}

/** Sessions from the start of today for `days` days (or from now on if `upcomingOnly`). */
export function useBookings(days = 14) {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + days * 24 * 3600e3);
  return useQuery({
    queryKey: ["schedule", "bookings", days],
    queryFn: () => api<{ bookings: Booking[] }>(`/schedule/bookings?${qs({ from: from.toISOString(), to: to.toISOString() })}`).then((r) => r.bookings),
  });
}

export function useClasses(days = 14) {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + days * 24 * 3600e3);
  return useQuery({
    queryKey: ["schedule", "classes", days],
    queryFn: () => api<{ classes: GymClass[] }>(`/schedule/classes?${qs({ from: from.toISOString(), to: to.toISOString() })}`).then((r) => r.classes),
  });
}

function useRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["schedule"] });
}

export function useSaveAvailability() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (body: Availability) => api<{ availability: Availability }>("/schedule/availability", { method: "PUT", body }),
    onSuccess: refresh,
  });
}

export function useBook() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (body: { startsAt: string; memberId?: string; notes?: string }) =>
      api<{ booking: Booking }>("/schedule/bookings", { method: "POST", body: { ...body, tz: tz() } }).then((r) => r.booking),
    onSuccess: refresh,
  });
}

export function useCancelBooking() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (id: string) => api<{ booking: Booking }>(`/schedule/bookings/${id}/cancel`, { method: "POST" }).then((r) => r.booking),
    onSuccess: refresh,
  });
}

export function useSetBookingStatus() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "COMPLETED" | "NO_SHOW" }) =>
      api<{ booking: Booking }>(`/schedule/bookings/${id}/status`, { method: "PATCH", body: { status } }).then((r) => r.booking),
    onSuccess: refresh,
  });
}

export type ClassInput = {
  title: string;
  description: string;
  location: string;
  trainerId?: string | null;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  repeatWeeks: number;
};

export function useCreateClass() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (body: ClassInput) => api<{ classes: GymClass[] }>("/schedule/classes", { method: "POST", body }).then((r) => r.classes),
    onSuccess: refresh,
  });
}

export function useClassAction() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "join" | "leave" | "cancel" }) =>
      api<{ class: GymClass }>(`/schedule/classes/${id}/${action}`, { method: "POST" }).then((r) => r.class),
    onSuccess: refresh,
  });
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Membership, MembershipOverview, MembershipPlan, MyMembership, PaymentInput, PaymentMethod, RosterEntry } from "@/lib/types";

const tz = () => new Date().getTimezoneOffset();

export function useMembershipPlans() {
  return useQuery({
    queryKey: ["membership-plans"],
    queryFn: () => api<{ plans: MembershipPlan[] }>("/membership-plans").then((r) => r.plans),
  });
}

export function useRoster() {
  return useQuery({
    queryKey: ["memberships", "roster"],
    queryFn: () => api<{ roster: RosterEntry[]; expiringDays: number }>(`/memberships/roster?tz=${tz()}`),
  });
}

export function useMembershipOverview(enabled = true) {
  return useQuery({
    queryKey: ["memberships", "overview"],
    queryFn: () => api<{ overview: MembershipOverview }>(`/memberships/overview?tz=${tz()}`).then((r) => r.overview),
    enabled,
  });
}

export function useMemberMemberships(memberId: string | null) {
  return useQuery({
    queryKey: ["memberships", "history", memberId],
    queryFn: () => api<{ memberships: Membership[] }>(`/memberships?member=${memberId}&tz=${tz()}`).then((r) => r.memberships),
    enabled: !!memberId,
  });
}

export function useMyMembership() {
  return useQuery({ queryKey: ["memberships", "me"], queryFn: () => api<MyMembership>(`/memberships/me?tz=${tz()}`) });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["memberships"] });
}

export function useSellMembership() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: { memberId: string; planId: string; startDate?: string; payment: PaymentInput; notes?: string }) =>
      api<{ membership: Membership }>("/memberships", { method: "POST", body: { ...body, tz: tz() } }).then((r) => r.membership),
    onSuccess: invalidate,
  });
}

export function useRenewMembership() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; planId?: string; payment: PaymentInput; notes?: string }) =>
      api<{ membership: Membership }>(`/memberships/${id}/renew`, { method: "POST", body: { ...body, tz: tz() } }).then((r) => r.membership),
    onSuccess: invalidate,
  });
}

export function useMarkPaid() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, method, reference }: { id: string; method: PaymentMethod; reference?: string }) =>
      api<{ membership: Membership }>(`/memberships/${id}/payment`, { method: "PATCH", body: { method, reference } }).then((r) => r.membership),
    onSuccess: invalidate,
  });
}

export function useCancelMembership() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api<{ membership: Membership }>(`/memberships/${id}/cancel`, { method: "POST" }).then((r) => r.membership),
    onSuccess: invalidate,
  });
}

export function useSavePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id?: string; name?: string; durationMonths?: number; price?: number; description?: string; isActive?: boolean }) =>
      api<{ plan: MembershipPlan }>(id ? `/membership-plans/${id}` : "/membership-plans", { method: id ? "PATCH" : "POST", body }).then((r) => r.plan),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["membership-plans"] }),
  });
}

import type { Permission, Role, Session } from "./types";

export const ROLE_HOME: Record<Role, string> = {
  MEMBER: "/member",
  TRAINER: "/trainer",
  STAFF: "/team",
  GYM_OWNER: "/owner",
  SUPER_ADMIN: "/owner",
};

export const ROLE_LABEL: Record<Role, string> = {
  MEMBER: "Member",
  TRAINER: "Trainer",
  STAFF: "Staff",
  GYM_OWNER: "Owner",
  SUPER_ADMIN: "Super admin",
};

export const can = (session: Session, permission: Permission) => session.permissions.includes(permission);

type Rule = { prefix: string; allow: (session: Session) => boolean };

// UI gating only, so people are not shown screens the API would refuse them anyway.
const RULES: Rule[] = [
  { prefix: "/member", allow: (s) => s.user.role === "MEMBER" },
  { prefix: "/trainer", allow: (s) => s.user.role === "TRAINER" },
  { prefix: "/owner", allow: (s) => can(s, "gym:settings") },
  { prefix: "/team", allow: (s) => can(s, "members:manage") || can(s, "trainers:manage") },
  { prefix: "/plans", allow: (s) => can(s, "workout:create") },
  { prefix: "/exercises", allow: (s) => can(s, "workout:create") },
  { prefix: "/workouts", allow: (s) => s.user.role === "MEMBER" },
  { prefix: "/history", allow: (s) => s.user.role === "MEMBER" },
  { prefix: "/progress", allow: (s) => s.user.role === "MEMBER" },
  { prefix: "/clients", allow: (s) => can(s, "clients:read:assigned") },
  { prefix: "/check-in", allow: (s) => s.user.role === "MEMBER" },
  { prefix: "/front-desk", allow: (s) => can(s, "members:manage") },
  { prefix: "/memberships", allow: (s) => can(s, "memberships:manage") },
  { prefix: "/schedule", allow: (s) => s.user.role === "MEMBER" || can(s, "workout:create") },
  { prefix: "/resources", allow: (s) => can(s, "workout:create") },
  { prefix: "/nutrition", allow: (s) => s.user.role === "MEMBER" },
  { prefix: "/reports", allow: (s) => can(s, "revenue:read") },
  { prefix: "/muscle-explorer", allow: (s) => s.user.role === "MEMBER" || s.user.role === "TRAINER" },
  { prefix: "/muscle-intelligence", allow: (s) => s.user.role === "MEMBER" || s.user.role === "TRAINER" },
];

/** A same-site path from a `next` query param, or null. Rejects "//evil.com" and absolute URLs. */
export function safeNext(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

export function canVisit(session: Session, pathname: string) {
  const rule = RULES.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  return rule ? rule.allow(session) : true;
}

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
];

export function canVisit(session: Session, pathname: string) {
  const rule = RULES.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  return rule ? rule.allow(session) : true;
}

export type Role = "SUPER_ADMIN" | "GYM_OWNER" | "TRAINER" | "STAFF" | "MEMBER";

// Mirrors backend/src/config/roles.js.
export type Permission =
  | "profile:read:own"
  | "profile:update:own"
  | "workout:create"
  | "workout:assign"
  | "clients:read:assigned"
  | "members:manage"
  | "trainers:manage"
  | "revenue:read"
  | "gym:settings";

export type UserRef = { id: string; name: string; email: string };

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  gym: string;
  trainer: UserRef | null;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
};

export type Session = { user: User; permissions: Permission[] };

export type Gym = { id: string; name: string; joinCode?: string };

export type GymOverview = { members: number; trainers: number; staff: number };

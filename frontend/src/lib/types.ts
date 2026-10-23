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

export type MuscleGroup =
  | "CHEST"
  | "BACK"
  | "SHOULDERS"
  | "BICEPS"
  | "TRICEPS"
  | "LEGS"
  | "GLUTES"
  | "CORE"
  | "FULL_BODY"
  | "CARDIO";

export type Equipment = "BARBELL" | "DUMBBELL" | "MACHINE" | "CABLE" | "KETTLEBELL" | "BODYWEIGHT" | "BAND" | "OTHER";

export type Exercise = {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  instructions: string;
  imageUrl: string | null;
  isCustom: boolean;
};

export type PlanExercise = {
  exercise: Exercise;
  sets: number;
  reps: string;
  weight: number | null;
  restSeconds: number;
  notes: string;
};

export type PlanDay = { name: string; exercises: PlanExercise[] };

export type WorkoutPlan = {
  id: string;
  name: string;
  description: string;
  days: PlanDay[];
  assignedTo: UserRef[];
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
};

/** Shape the API accepts when creating or replacing a plan. */
export type PlanInput = {
  name: string;
  description: string;
  days: {
    name: string;
    exercises: { exercise: string; sets: number; reps: string; weight: number | null; restSeconds: number; notes: string }[];
  }[];
};

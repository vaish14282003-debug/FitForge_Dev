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

export type LoggedSet = { reps: number; weight: number | null; done: boolean };

export type WorkoutSession = {
  id: string;
  member: UserRef;
  plan: string | null;
  planName: string;
  dayIndex: number;
  dayName: string;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  totalVolume: number;
  completedSets: number;
  notes: string;
  entries: {
    exercise: string;
    exerciseName: string;
    muscleGroup: MuscleGroup;
    target: { sets: number; reps: string; weight: number | null };
    sets: LoggedSet[];
  }[];
  prs: { exercise: string; exerciseName: string; weight: number; reps: number }[];
  review: { reviewedBy: { id: string; name: string } | null; reviewedAt: string | null; comment: string };
};

export type TrainingSummary = {
  totalWorkouts: number;
  streak: number;
  trainedToday: boolean;
  week: { date: string; count: number; volume: number }[];
  nextUp: { planId: string; dayIndex: number }[];
  recentPrs: { exercise: string; exerciseName: string; weight: number; reps: number; achievedAt: string }[];
};

export type PreviousSets = Record<string, { completedAt: string; sets: LoggedSet[] }>;

export type SessionInput = {
  planId: string;
  dayIndex: number;
  startedAt: string;
  notes: string;
  entries: { exercise: string; sets: LoggedSet[] }[];
};

export type Measurements = { chest: number | null; waist: number | null; hips: number | null; arm: number | null; thigh: number | null };

export type BodyMetric = {
  id: string;
  day: string;
  weight: number | null;
  bodyFat: number | null;
  measurements: Measurements;
  note: string;
};

export type ProgressMetrics = {
  member: { id: string; name: string };
  goal: { targetWeight: number | null };
  metrics: BodyMetric[];
};

export type TrainingProgress = {
  weekly: { weekStart: string; workouts: number; volume: number }[];
  exercises: { exercise: string; name: string; muscleGroup: MuscleGroup; sessions: number; bestWeight: number | null }[];
};

export type StrengthSeries = {
  exercise: { id: string; name: string };
  points: { date: string; bestWeight: number | null; e1rm: number | null; topSet: { weight: number; reps: number } | null; reps: number; volume: number }[];
};

export type MetricInput = {
  day: string;
  weight?: number | null;
  bodyFat?: number | null;
  measurements?: Partial<Measurements>;
  note?: string;
};

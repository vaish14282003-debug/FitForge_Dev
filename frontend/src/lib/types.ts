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
  | "gym:settings"
  | "workout:log"
  | "memberships:manage";

export type UserRef = { id: string; name: string; email: string; avatarUrl?: string | null };

export type FitnessGoal = "LOSE_WEIGHT" | "BUILD_MUSCLE" | "GET_STRONGER" | "IMPROVE_FITNESS" | "STAY_HEALTHY";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  gym: string;
  trainer: UserRef | null;
  avatarUrl: string | null;
  phone: string;
  bio: string;
  heightCm: number | null;
  dateOfBirth: string | null;
  fitnessGoal: FitnessGoal | null;
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

export type Attendance = { id: string; member: string; day: string; checkedInAt: string; method: "QR" | "STAFF" };

export type AttendanceSummary = {
  checkedInToday: boolean;
  todayAt: string | null;
  thisMonth: number;
  last30Days: number;
  total: number;
  days: string[];
};

export type AttendanceStats = {
  today: number;
  daily: { day: string; count: number }[];
  checkIns: (Omit<Attendance, "member"> & { member: UserRef })[];
};

export type CheckInResult = { attendance: Attendance; alreadyCheckedIn: boolean; member?: { id: string; name: string } };

export type MembershipPlan = {
  id: string;
  name: string;
  durationMonths: number;
  price: number;
  description: string;
  isActive: boolean;
};

export type PaymentMethod = "CASH" | "UPI" | "CARD" | "BANK" | "OTHER";

export type Membership = {
  id: string;
  member: string | UserRef;
  plan: string;
  planName: string;
  durationMonths: number;
  price: number;
  startDate: string;
  endDate: string;
  status: "UPCOMING" | "ACTIVE" | "EXPIRED" | "CANCELLED";
  daysLeft: number | null;
  payment: { status: "PAID" | "PENDING"; method: PaymentMethod | null; reference: string; paidAt: string | null };
  renewalOf: string | null;
  cancelledAt: string | null;
};

export type Standing = "ACTIVE" | "EXPIRING" | "UPCOMING" | "EXPIRED" | "NONE";

export type RosterEntry = {
  member: { id: string; name: string; email: string; isActive: boolean; avatarUrl: string | null };
  status: Standing;
  current: Membership | null;
  upcoming: Membership | null;
  latest: Membership | null;
  pendingPayments: number;
};

export type MembershipOverview = {
  activeMembers: number;
  expiringSoon: (Membership & { member: UserRef })[];
  expiringDays: number;
  recentlyExpired: number;
  pendingPayments: { count: number; amount: number };
  revenue?: { thisMonth: number; lastMonth: number; months: { month: string; amount: number; count: number }[] };
};

export type MyMembership = {
  status: Standing;
  current: Membership | null;
  upcoming: Membership | null;
  latest: Membership | null;
  history: Membership[];
};

export type PaymentInput = { status: "PAID" | "PENDING"; method?: PaymentMethod | null; reference?: string };

export type WeeklyBlock = { day: number; start: string; end: string };
export type Availability = { weekly: WeeklyBlock[]; sessionMinutes: 30 | 45 | 60 | 90 };

export type Slot = { startsAt: string; endsAt: string; available: boolean; yours: boolean };
export type SlotDays = { trainer: UserRef; sessionMinutes: number; days: { date: string; slots: Slot[] }[] };

export type Booking = {
  id: string;
  trainer: UserRef;
  member: UserRef;
  startsAt: string;
  endsAt: string;
  status: "BOOKED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  notes: string;
};

export type GymClass = {
  id: string;
  title: string;
  description: string;
  location: string;
  trainer: UserRef | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
  spotsLeft: number;
  attendees: string[];
  cancelledAt: string | null;
};

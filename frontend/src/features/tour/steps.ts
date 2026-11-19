import type { Role } from "@/lib/types";

/** A step points at an element marked `data-tour="<target>"`, or sits in the middle of the screen. */
export type TourStep = { id: string; target?: string; title: string; body: string };

type Copy = { title: string; body: string };

// What each main page is for, in the user's words. Keyed by the nav link's href.
const PAGE_COPY: Record<string, Copy | ((role: Role) => Copy)> = {
  "/member": { title: "Your dashboard", body: "Today's workout, your streak and check-in, all on one screen." },
  "/trainer": { title: "Your dashboard", body: "Today's sessions and how your clients are doing, at a glance." },
  "/owner": { title: "Your gym at a glance", body: "Members, check-ins, revenue and memberships that need attention." },
  "/workouts": {
    title: "Workouts",
    body: "Start today's workout and log every set as you go. The 3D muscle explorer lives here too.",
  },
  "/schedule": (role) =>
    role === "MEMBER"
      ? { title: "Schedule", body: "Book sessions with your trainer and join group classes." }
      : { title: "Schedule", body: "Set your availability, run group classes and manage bookings." },
  "/progress": { title: "Progress", body: "Log your weight and watch strength, volume and personal records climb." },
  "/nutrition": { title: "Nutrition", body: "Track meals, protein and water against your daily goals." },
  "/history": { title: "History", body: "Every workout logged, with sets, reps and volume." },
  "/plans": { title: "Plans", body: "Build training plans and assign them to your members." },
  "/exercises": { title: "Exercise library", body: "Built-in movements with the muscles they train, plus your gym's own." },
  "/resources": { title: "Resources", body: "Share files such as diet charts and guides with your clients." },
  "/team": (role) =>
    role === "STAFF"
      ? { title: "Team", body: "Find members, add new ones and assign them a trainer." }
      : { title: "Team", body: "Add trainers and staff, and find the gym code members use to join." },
  "/memberships": { title: "Memberships", body: "Membership plans, renewals and who is due to pay." },
  "/front-desk": { title: "Front desk", body: "Put this screen at the entrance: members scan the QR code to check in." },
};

const INTRO: Record<Role, string> = {
  MEMBER: "A quick look around: where to train, book sessions and track your progress. It takes under a minute.",
  TRAINER: "A quick look around: your clients, plans and schedule. It takes under a minute.",
  GYM_OWNER: "A quick look around your gym's control room. It takes under a minute.",
  SUPER_ADMIN: "A quick look around your gym's control room. It takes under a minute.",
  STAFF: "A quick look around the tools for running the front desk. It takes under a minute.",
};

const OUTRO: Record<Role, string> = {
  MEMBER: "Start with today's workout on your dashboard. You can replay this tour from your profile any time.",
  TRAINER: "Start by building a plan and assigning it to a client. You can replay this tour from your profile any time.",
  GYM_OWNER: "Start in Team: share your gym code so members can join. You can replay this tour from your profile any time.",
  SUPER_ADMIN: "You can replay this tour from your profile any time.",
  STAFF: "Start at the front desk, or add a member in Team. You can replay this tour from your profile any time.",
};

/**
 * The tour for this person: a welcome, one step per page in their navigation (in the same order),
 * the notification bell, their profile, and a closing tip. Pages without copy are skipped.
 */
export function buildTourSteps({ name, role, navHrefs }: { name: string; role: Role; navHrefs: string[] }): TourStep[] {
  const firstName = name.trim().split(/\s+/)[0] || "there";
  const pages = navHrefs.flatMap((href) => {
    const entry = PAGE_COPY[href];
    if (!entry) return [];
    const copy = typeof entry === "function" ? entry(role) : entry;
    return [{ id: `nav:${href}`, target: `nav:${href}`, ...copy }];
  });
  return [
    { id: "welcome", title: `Welcome to FitForge, ${firstName}!`, body: INTRO[role] },
    ...pages,
    { id: "notifications", target: "notifications", title: "Notifications", body: "Bookings, renewals and gym announcements arrive here." },
    { id: "profile", target: "profile", title: "Your profile", body: "Your photo, details and password, and this tour if you want it again." },
    { id: "done", title: "You're all set", body: OUTRO[role] },
  ];
}

export type Placement = { top: number; left: number; side: "below" | "above" | "center" };

/**
 * Where the tour card goes: below the highlighted element if it fits, otherwise above, kept inside
 * the screen with a 16px margin. No target: the middle of the screen.
 */
export function placeCard(
  target: { top: number; left: number; width: number; height: number } | null,
  card: { width: number; height: number },
  viewport: { width: number; height: number },
  gap = 14,
): Placement {
  const margin = 16;
  if (!target) {
    return {
      top: Math.max(margin, (viewport.height - card.height) / 2),
      left: Math.max(margin, (viewport.width - card.width) / 2),
      side: "center",
    };
  }
  const below = target.top + target.height + gap;
  const fitsBelow = below + card.height <= viewport.height - margin;
  const above = target.top - gap - card.height;
  const side = fitsBelow || above < margin ? "below" : "above";
  const top = side === "below" ? Math.min(below, viewport.height - margin - card.height) : above;
  const centered = target.left + target.width / 2 - card.width / 2;
  const left = Math.min(Math.max(margin, centered), viewport.width - margin - card.width);
  return { top: Math.max(margin, top), left, side };
}

import { describe, expect, it } from "vitest";
import { canVisit, safeNext } from "./access";
import { addDay, durationLabel, formatINR, previewEnd } from "./membership";
import type { Permission, Role, Session } from "./types";
import { bestSet, estimateMinutes, formatDuration, formatRest, formatVolume } from "./workout";

const session = (role: Role, permissions: Permission[] = []) => ({ user: { role }, permissions }) as unknown as Session;

describe("safeNext", () => {
  it("allows same-site paths only", () => {
    expect(safeNext("/check-in?t=abc")).toBe("/check-in?t=abc");
    expect(safeNext("//evil.com")).toBeNull();
    expect(safeNext("/\\evil.com")).toBeNull();
    expect(safeNext("https://evil.com")).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});

describe("canVisit", () => {
  const member = session("MEMBER", ["workout:log"]);
  const trainer = session("TRAINER", ["workout:create", "clients:read:assigned"]);
  const owner = session("GYM_OWNER", ["gym:settings", "members:manage", "trainers:manage", "revenue:read", "memberships:manage", "workout:create"]);
  const staff = session("STAFF", ["members:manage", "memberships:manage"]);

  it("keeps each role to its own pages", () => {
    expect(canVisit(member, "/nutrition")).toBe(true);
    expect(canVisit(member, "/owner")).toBe(false);
    expect(canVisit(member, "/reports")).toBe(false);
    expect(canVisit(trainer, "/resources")).toBe(true);
    expect(canVisit(trainer, "/memberships")).toBe(false);
    expect(canVisit(owner, "/reports")).toBe(true);
    expect(canVisit(staff, "/front-desk")).toBe(true);
    expect(canVisit(staff, "/reports")).toBe(false);
  });

  it("matches whole path segments, not prefixes of words", () => {
    expect(canVisit(member, "/members-area")).toBe(true);
    expect(canVisit(member, "/member/anything")).toBe(true);
    expect(canVisit(trainer, "/member")).toBe(false);
  });
});

describe("membership helpers", () => {
  it("previews period ends the same way the API computes them", () => {
    expect(previewEnd("2026-10-01", 3)).toBe("2026-12-31");
    expect(previewEnd("2026-01-31", 1)).toBe("2026-02-27");
    expect(previewEnd("2026-01-15", 12)).toBe("2027-01-14");
    expect(addDay("2026-12-31")).toBe("2027-01-01");
  });

  it("formats rupees and durations", () => {
    expect(formatINR(13500)).toBe("₹13,500");
    expect(formatINR(100000)).toBe("₹1,00,000");
    expect(durationLabel(1)).toBe("1 month");
    expect(durationLabel(12)).toBe("1 year");
    expect(durationLabel(6)).toBe("6 months");
  });
});

describe("workout helpers", () => {
  it("estimates session length in 5-minute steps", () => {
    expect(estimateMinutes({ exercises: [{ sets: 3, restSeconds: 60 }, { sets: 3, restSeconds: 60 }] })).toBe(10);
    expect(estimateMinutes({ exercises: [] })).toBe(5);
  });

  it("picks the heaviest completed set", () => {
    expect(bestSet([{ reps: 8, weight: 50, done: true }, { reps: 5, weight: 60, done: false }, { reps: 6, weight: 55, done: true }])).toBe("55 kg × 6");
    expect(bestSet([{ reps: 12, weight: null, done: true }])).toBe("12 reps");
    expect(bestSet([{ reps: 5, weight: 60, done: false }])).toBeNull();
  });

  it("formats rest, duration and volume", () => {
    expect(formatRest(45)).toBe("45s");
    expect(formatRest(90)).toBe("1:30 min");
    expect(formatDuration(45 * 60)).toBe("45 min");
    expect(formatDuration(75 * 60)).toBe("1 h 15 min");
    expect(formatVolume(950)).toBe("950 kg");
    expect(formatVolume(4250)).toBe("4.3 t");
  });
});

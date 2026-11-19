import { describe, expect, it } from "vitest";
import { buildTourSteps, placeCard } from "./steps";

describe("buildTourSteps", () => {
  it("follows the person's own navigation, between a welcome and a closing tip", () => {
    const steps = buildTourSteps({ name: "Vaishnavi Rao", role: "MEMBER", navHrefs: ["/member", "/workouts", "/schedule", "/progress", "/nutrition"] });
    expect(steps.map((s) => s.id)).toEqual([
      "welcome",
      "nav:/member",
      "nav:/workouts",
      "nav:/schedule",
      "nav:/progress",
      "nav:/nutrition",
      "notifications",
      "profile",
      "done",
    ]);
    expect(steps[0].title).toBe("Welcome to FitForge, Vaishnavi!");
    expect(steps[0].target).toBeUndefined();
    expect(steps[2].target).toBe("nav:/workouts");
  });

  it("words shared pages for the role", () => {
    const member = buildTourSteps({ name: "A", role: "MEMBER", navHrefs: ["/schedule"] })[1];
    const trainer = buildTourSteps({ name: "A", role: "TRAINER", navHrefs: ["/schedule"] })[1];
    expect(member.body).toMatch(/Book sessions/);
    expect(trainer.body).toMatch(/availability/);
    const staffTeam = buildTourSteps({ name: "A", role: "STAFF", navHrefs: ["/team"] })[1];
    const ownerTeam = buildTourSteps({ name: "A", role: "GYM_OWNER", navHrefs: ["/team"] })[1];
    expect(staffTeam.body).not.toEqual(ownerTeam.body);
    expect(ownerTeam.body).toMatch(/gym code/);
  });

  it("skips pages it has nothing to say about", () => {
    const steps = buildTourSteps({ name: "A", role: "GYM_OWNER", navHrefs: ["/owner", "/somewhere-new"] });
    expect(steps.map((s) => s.id)).not.toContain("nav:/somewhere-new");
  });
});

describe("placeCard", () => {
  const viewport = { width: 390, height: 800 };
  const card = { width: 340, height: 200 };

  it("centres when there is nothing to point at", () => {
    expect(placeCard(null, card, viewport)).toEqual({ top: 300, left: 25, side: "center" });
  });

  it("goes below a header item and stays on screen", () => {
    const p = placeCard({ top: 10, left: 340, width: 44, height: 44 }, card, viewport);
    expect(p.side).toBe("below");
    expect(p.top).toBe(68);
    expect(p.left).toBe(390 - 16 - 340);
  });

  it("goes above a bottom tab bar item", () => {
    const p = placeCard({ top: 730, left: 20, width: 70, height: 56 }, card, viewport);
    expect(p.side).toBe("above");
    expect(p.top).toBe(730 - 14 - 200);
    expect(p.left).toBe(16);
  });
});

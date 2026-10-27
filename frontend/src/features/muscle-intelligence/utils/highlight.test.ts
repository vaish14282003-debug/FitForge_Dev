import { describe, expect, it } from "vitest";
import { MUSCLES } from "../anatomy/muscles";
import { BASE_SHAPES, MUSCLE_SHAPES, VIEW_PRESETS } from "../anatomy/procedural-body";
import type { MuscleId } from "../types";
import type { Involvement } from "./anatomy";
import { muscleVisualState } from "./highlight";

describe("procedural figure", () => {
  it("gives every catalog muscle at least one shape, and only catalog muscles", () => {
    const ids = new Set(MUSCLES.map((m) => m.id));
    for (const m of MUSCLES) expect(MUSCLE_SHAPES.some((s) => s.muscle === m.id)).toBe(true);
    for (const s of MUSCLE_SHAPES) expect(ids.has(s.muscle)).toBe(true);
  });

  it("keeps shapes on the figure's left (mirrored to the right) and within the body", () => {
    for (const s of [...MUSCLE_SHAPES, ...BASE_SHAPES]) {
      const points = s.kind === "ellipsoid" ? [s.center] : [s.from, s.to];
      for (const [x, y] of points) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThan(0);
        expect(y).toBeLessThan(1.8);
      }
    }
  });

  it("puts front-view muscles in front and back-view muscles behind", () => {
    const z = (id: MuscleId) => MUSCLE_SHAPES.filter((s) => s.muscle === id).map((s) => (s.kind === "ellipsoid" ? s.center[2] : s.from[2]));
    for (const m of MUSCLES) {
      if (m.visibility === "front") expect(Math.max(...z(m.id))).toBeGreaterThan(-0.01);
      if (m.visibility === "back") expect(Math.min(...z(m.id))).toBeLessThan(0.01);
    }
  });

  it("has camera presets looking at the figure from outside it", () => {
    for (const { position } of Object.values(VIEW_PRESETS)) expect(Math.hypot(position[0], position[2])).toBeGreaterThan(2);
  });
});

describe("muscle visual state", () => {
  const highlight = new Map<MuscleId, Involvement>([
    ["pectoralis-major", "primary"],
    ["triceps-brachii", "secondary"],
  ]);

  it("orders hover, selection, then exercise involvement", () => {
    expect(muscleVisualState("pectoralis-major", { hovered: "pectoralis-major", selected: "pectoralis-major", exerciseHighlight: highlight })).toBe("hovered");
    expect(muscleVisualState("pectoralis-major", { hovered: null, selected: "pectoralis-major", exerciseHighlight: highlight })).toBe("selected");
    expect(muscleVisualState("pectoralis-major", { hovered: null, selected: null, exerciseHighlight: highlight })).toBe("primary");
    expect(muscleVisualState("triceps-brachii", { hovered: null, selected: null, exerciseHighlight: highlight })).toBe("secondary");
    expect(muscleVisualState("quadriceps", { hovered: null, selected: null, exerciseHighlight: highlight })).toBe("default");
  });
});

import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { MUSCLES } from "../anatomy/muscles";
import type { Muscle } from "../types";
import { buildMeshIndex, exercisesForMuscle, highlightMap, involvement, movementPatternsFor, relatedMuscles, searchMuscles } from "./anatomy";

// The backend owns the canonical exercise library; the catalog must agree with it exactly.
const require = createRequire(import.meta.url);
const { MUSCLE_IDS } = require("../../../../../backend/src/config/anatomy.js") as { MUSCLE_IDS: string[] };
const LIBRARY = require("../../../../../backend/src/data/exercises.js") as {
  name: string;
  movementPattern: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
}[];
const exercises = LIBRARY.map((e) => ({ ...e, movementPattern: e.movementPattern as never }));

describe("muscle catalog", () => {
  it("has the same IDs as the backend, each once", () => {
    const ids = MUSCLES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...MUSCLE_IDS].sort());
  });

  it("covers every muscle the built-in library uses", () => {
    const used = new Set(LIBRARY.flatMap((e) => [...e.primaryMuscles, ...e.secondaryMuscles]));
    for (const id of used) expect(MUSCLES.some((m) => m.id === id)).toBe(true);
  });

  it("gives every muscle a name, scientific name and description", () => {
    for (const m of MUSCLES) {
      expect(m.name.length).toBeGreaterThan(1);
      expect(m.scientificName.length).toBeGreaterThan(1);
      expect(m.description.length).toBeGreaterThan(10);
    }
  });
});

describe("lookups", () => {
  it("finds exercises for a muscle, prime movers first", () => {
    const triceps = exercisesForMuscle(exercises, "triceps-brachii");
    const roles = triceps.map((t) => t.role);
    expect(roles.indexOf("secondary")).toBeGreaterThan(roles.lastIndexOf("primary"));
    expect(triceps.find((t) => t.exercise.name === "Triceps Pushdown")?.role).toBe("primary");
    expect(triceps.find((t) => t.exercise.name === "Barbell Bench Press")?.role).toBe("secondary");
    expect(triceps.some((t) => t.exercise.name === "Back Squat")).toBe(false);
  });

  it("builds highlight states with primary winning over secondary", () => {
    const bench = exercises.find((e) => e.name === "Barbell Bench Press")!;
    const map = highlightMap(bench);
    expect(map.get("pectoralis-major")).toBe("primary");
    expect(map.get("triceps-brachii")).toBe("secondary");
    expect(map.has("quadriceps")).toBe(false);
    expect(highlightMap({ primaryMuscles: ["quadriceps"], secondaryMuscles: ["quadriceps"] }).get("quadriceps")).toBe("primary");
    expect(highlightMap(null).size).toBe(0);
    expect(involvement(bench, "lateral-deltoid")).toBeNull();
  });

  it("lists related muscles and movement patterns", () => {
    expect(relatedMuscles(exercises, "pectoralis-major").map((m) => m.id)).toContain("triceps-brachii");
    expect(movementPatternsFor(exercises, "hamstrings")).toEqual(expect.arrayContaining(["HINGE", "ISOLATION"]));
  });

  it("searches by common, scientific or ID name", () => {
    expect(searchMuscles("lats").map((m) => m.id)).toEqual(["latissimus-dorsi"]);
    expect(searchMuscles("gluteus").map((m) => m.id)).toEqual(["gluteus-maximus", "gluteus-medius"]);
    expect(searchMuscles("  ")).toHaveLength(MUSCLES.length);
  });

  it("indexes meshes by name and rejects a mesh claimed by two muscles", () => {
    const sample: Muscle[] = [
      { ...MUSCLES[0], meshNames: ["Pectoralis_L", "Pectoralis_R"] },
      { ...MUSCLES[1], meshNames: ["Deltoid_Ant_L"] },
    ];
    const index = buildMeshIndex(sample);
    expect(index.get("Pectoralis_R")).toBe("pectoralis-major");
    expect(() => buildMeshIndex([...sample, { ...MUSCLES[2], meshNames: ["Pectoralis_L"] }])).toThrow(/both/);
    // Real catalog has no meshes yet: an empty index, not an error.
    expect(buildMeshIndex().size).toBe(0);
  });
});

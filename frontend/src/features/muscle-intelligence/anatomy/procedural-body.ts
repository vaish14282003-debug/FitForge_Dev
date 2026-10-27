import type { MuscleId } from "../types";

/**
 * An original, stylized muscular figure built from simple shapes, so FitForge ships with no
 * third-party anatomy asset. Each muscle is its own named mesh, which is what selection needs;
 * shapes are placed to read correctly, not to be medically exact. A licensed GLB can replace this
 * by filling `meshNames` in the muscle catalog.
 *
 * Units are metres-ish: feet at y = 0, head at ~1.75, facing +z. Left-side shapes (x > 0, the
 * figure's left) are mirrored to the right.
 */
export type Vec3 = readonly [number, number, number];

export type ShapeDef =
  | { kind: "ellipsoid"; center: Vec3; radii: Vec3; rotation?: Vec3 }
  | { kind: "capsule"; from: Vec3; to: Vec3; radius: number };

export type MuscleShape = ShapeDef & { muscle: MuscleId; mirror: boolean };

const e = (center: Vec3, radii: Vec3, rotation?: Vec3): ShapeDef => ({ kind: "ellipsoid", center, radii, rotation });
const c = (from: Vec3, to: Vec3, radius: number): ShapeDef => ({ kind: "capsule", from, to, radius });
const left = (muscle: MuscleId, shape: ShapeDef): MuscleShape => ({ ...shape, muscle, mirror: true });

/** The body underneath: not selectable, drawn in a darker neutral. */
export const BASE_SHAPES: (ShapeDef & { mirror: boolean })[] = [
  { ...e([0, 1.64, 0], [0.095, 0.115, 0.105]), mirror: false }, // head
  { ...c([0, 1.5, -0.01], [0, 1.56, 0], 0.05), mirror: false }, // neck
  { ...e([0, 1.27, 0], [0.175, 0.24, 0.115]), mirror: false }, // torso
  { ...e([0, 0.95, 0], [0.16, 0.11, 0.105]), mirror: false }, // pelvis
  { ...c([0.24, 1.4, 0], [0.285, 1.13, 0], 0.042), mirror: true }, // upper arm
  { ...c([0.29, 1.11, 0.005], [0.315, 0.86, 0.015], 0.034), mirror: true }, // forearm
  { ...e([0.322, 0.79, 0.02], [0.03, 0.055, 0.02]), mirror: true }, // hand
  { ...c([0.1, 0.9, 0], [0.11, 0.52, 0.005], 0.07), mirror: true }, // thigh
  { ...c([0.11, 0.48, 0], [0.11, 0.1, -0.005], 0.046), mirror: true }, // shin
  { ...e([0.11, 0.035, 0.04], [0.04, 0.035, 0.09]), mirror: true }, // foot
];

export const MUSCLE_SHAPES: MuscleShape[] = [
  left("pectoralis-major", e([0.085, 1.37, 0.088], [0.09, 0.066, 0.04], [0, 0, -0.18])),
  left("anterior-deltoid", e([0.205, 1.425, 0.042], [0.042, 0.062, 0.04], [0.15, 0, 0.2])),
  left("lateral-deltoid", e([0.238, 1.41, 0], [0.04, 0.066, 0.046], [0, 0, 0.25])),
  left("posterior-deltoid", e([0.205, 1.425, -0.042], [0.042, 0.062, 0.04], [-0.15, 0, 0.2])),
  left("biceps-brachii", c([0.252, 1.35, 0.03], [0.278, 1.18, 0.03], 0.034)),
  left("brachialis", e([0.292, 1.19, 0.012], [0.024, 0.05, 0.028], [0, 0, 0.15])),
  left("triceps-brachii", c([0.25, 1.37, -0.03], [0.278, 1.16, -0.03], 0.036)),
  left("brachioradialis", c([0.302, 1.09, 0.022], [0.316, 0.95, 0.018], 0.024)),
  left("forearm-flexors", c([0.288, 1.07, 0.03], [0.306, 0.9, 0.028], 0.022)),
  left("trapezius", e([0.075, 1.46, -0.055], [0.1, 0.05, 0.045], [0, 0, -0.35])),
  left("trapezius", e([0.03, 1.24, -0.108], [0.032, 0.08, 0.02])),
  left("rhomboids", e([0.072, 1.335, -0.106], [0.035, 0.05, 0.018], [0, 0, -0.3])),
  left("latissimus-dorsi", e([0.125, 1.22, -0.075], [0.07, 0.13, 0.042], [0, 0, -0.22])),
  left("erector-spinae", c([0.028, 1.17, -0.108], [0.03, 0.99, -0.1], 0.022)),
  left("rectus-abdominis", e([0.038, 1.12, 0.1], [0.036, 0.14, 0.026])),
  left("obliques", e([0.128, 1.1, 0.055], [0.038, 0.11, 0.06], [0, 0, 0.1])),
  left("hip-flexors", e([0.085, 0.93, 0.085], [0.034, 0.05, 0.026], [0, 0, 0.35])),
  left("gluteus-maximus", e([0.082, 0.9, -0.085], [0.085, 0.09, 0.06])),
  left("gluteus-medius", e([0.145, 0.99, -0.035], [0.048, 0.05, 0.042])),
  left("quadriceps", e([0.112, 0.72, 0.04], [0.072, 0.17, 0.06], [0, 0, 0.03])),
  left("adductors", e([0.052, 0.76, 0.008], [0.034, 0.12, 0.05])),
  left("hamstrings", e([0.11, 0.7, -0.045], [0.068, 0.16, 0.055])),
  left("gastrocnemius", e([0.11, 0.38, -0.04], [0.05, 0.1, 0.045])),
  left("soleus", e([0.11, 0.235, -0.03], [0.042, 0.07, 0.035])),
  left("tibialis-anterior", c([0.122, 0.45, 0.038], [0.116, 0.18, 0.036], 0.021)),
];

/** Mirror a point to the figure's right side. */
export const mirrorX = ([x, y, z]: Vec3): Vec3 => [-x, y, z];

export type ViewPreset = "default" | "front" | "back" | "side";

/** Camera position and look-at target for each preset; orbiting is free in between. */
export const VIEW_PRESETS: Record<ViewPreset, { position: Vec3; target: Vec3; label: string }> = {
  default: { position: [1.1, 1.25, 2.9], target: [0, 0.95, 0], label: "Default" },
  front: { position: [0, 1.05, 3.1], target: [0, 0.95, 0], label: "Front" },
  back: { position: [0, 1.05, -3.1], target: [0, 0.95, 0], label: "Back" },
  side: { position: [3.1, 1.05, 0], target: [0, 0.95, 0], label: "Side" },
};

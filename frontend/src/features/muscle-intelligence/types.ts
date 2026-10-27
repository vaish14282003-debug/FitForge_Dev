import type { MuscleGroup } from "@/lib/types";

/** Stable muscle ID, shared with the backend (backend/src/config/anatomy.js). Never a display name. */
export type MuscleId =
  | "pectoralis-major"
  | "anterior-deltoid"
  | "lateral-deltoid"
  | "posterior-deltoid"
  | "biceps-brachii"
  | "brachialis"
  | "brachioradialis"
  | "forearm-flexors"
  | "triceps-brachii"
  | "trapezius"
  | "rhomboids"
  | "latissimus-dorsi"
  | "erector-spinae"
  | "rectus-abdominis"
  | "obliques"
  | "hip-flexors"
  | "gluteus-maximus"
  | "gluteus-medius"
  | "adductors"
  | "quadriceps"
  | "hamstrings"
  | "gastrocnemius"
  | "soleus"
  | "tibialis-anterior";

export type BodyRegion = "chest" | "shoulders" | "arms" | "back" | "core" | "hips" | "thighs" | "lower-legs";

/** Which view shows the muscle best; drives camera presets and the 2D fallback. */
export type Visibility = "front" | "back" | "both";

export type Muscle = {
  id: MuscleId;
  name: string;
  /** Latin name, or the group's collective name for multi-muscle groups (e.g. quadriceps). */
  scientificName: string;
  region: BodyRegion;
  visibility: Visibility;
  /** All muscles here are paired left/right; the 3D layer selects both sides together. */
  side: "bilateral";
  /** One-line plain description of what the muscle does. */
  description: string;
  /** The library's coarse group, used to bridge to existing features (filters, icons). */
  group: MuscleGroup;
  /**
   * Mesh names in the 3D model (left and right parts) that make up this muscle, from the generated
   * model manifest. Empty when the model doesn't include the muscle.
   */
  meshNames: string[];
};

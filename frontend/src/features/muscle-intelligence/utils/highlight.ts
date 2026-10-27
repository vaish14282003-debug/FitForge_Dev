import type { MuscleId } from "../types";
import type { Involvement } from "./anatomy";

export type MuscleVisualState = "default" | "hovered" | "selected" | "primary" | "secondary";

/**
 * What one muscle should look like. Hover wins so the pointer always gets feedback; then the
 * selected muscle; then the selected exercise's prime movers and assisting muscles.
 */
export function muscleVisualState(
  id: MuscleId,
  { hovered, selected, exerciseHighlight }: { hovered: MuscleId | null; selected: MuscleId | null; exerciseHighlight: Map<MuscleId, Involvement> },
): MuscleVisualState {
  if (hovered === id) return "hovered";
  if (selected === id) return "selected";
  return exerciseHighlight.get(id) ?? "default";
}

/** Colours per state, shared by the 3D materials and the legend so they never disagree. */
export const STATE_COLORS: Record<MuscleVisualState, { color: string; emissive: string; emissiveIntensity: number }> = {
  // Natural, darker muscle tone so contours read and highlights stand out.
  default: { color: "#6e342d", emissive: "#000000", emissiveIntensity: 0 },
  hovered: { color: "#c76a5a", emissive: "#3a120c", emissiveIntensity: 0.3 },
  selected: { color: "#ff2d1f", emissive: "#ff2d1f", emissiveIntensity: 0.45 },
  primary: { color: "#e2382b", emissive: "#a3160d", emissiveIntensity: 0.25 },
  secondary: { color: "#d99a3a", emissive: "#6b3b00", emissiveIntensity: 0.18 },
};

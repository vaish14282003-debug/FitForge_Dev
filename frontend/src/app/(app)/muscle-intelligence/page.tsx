import type { Metadata } from "next";
import MuscleIntelligence from "@/features/muscle-intelligence/components/muscle-intelligence-page";

export const metadata: Metadata = { title: "Muscle Intelligence" };

// Signed-in pages cannot paint until the browser has confirmed the session,
// so navigating here is allowed to block.
export const instant = false;

export default function Page() {
  return <MuscleIntelligence />;
}

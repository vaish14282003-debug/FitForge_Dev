import type { Metadata } from "next";
import NutritionPage from "./view";

export const metadata: Metadata = { title: "Nutrition" };

// Signed-in pages cannot paint until the browser has confirmed the session,
// so navigating here is allowed to block.
export const instant = false;

export default function Page() {
  return <NutritionPage />;
}

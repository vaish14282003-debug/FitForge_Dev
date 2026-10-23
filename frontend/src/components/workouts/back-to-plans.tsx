import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function BackToPlans() {
  return (
    <Link href="/plans" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
      <ArrowLeft className="size-4" aria-hidden />
      All plans
    </Link>
  );
}

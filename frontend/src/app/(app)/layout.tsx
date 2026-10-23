import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";

// AppShell reads the URL (active nav link, route guard). On routes with an id, like /plans/[id],
// the URL is only known at request time, so the build needs a boundary to prerender around it.
// The fallback matches the spinner AppShell shows while it checks the session.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="grid flex-1 place-items-center" role="status" aria-label="Loading">
          <span className="size-9 animate-spin rounded-full border-2 border-white/10 border-t-primary" />
        </div>
      }
    >
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}

"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/ui/toast";
import { ServerWakingNotice } from "@/components/server-waking-notice";
import { ServiceWorker } from "@/components/service-worker";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // offlineFirst: try once even when the browser reports no connection, so screens can fall
          // back to their offline copies (lib/offline.ts) instead of waiting for signal.
          queries: { refetchOnWindowFocus: false, retry: 1, networkMode: "offlineFirst" },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {children}
        <ServerWakingNotice />
        <ServiceWorker />
      </ToastProvider>
    </QueryClientProvider>
  );
}

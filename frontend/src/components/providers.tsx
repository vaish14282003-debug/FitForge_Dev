"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/ui/toast";
import { ServerWakingNotice } from "@/components/server-waking-notice";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {children}
        <ServerWakingNotice />
      </ToastProvider>
    </QueryClientProvider>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { useIntegrations, useSendWorkout } from "@/hooks/use-integrations";
import type { WorkoutSession } from "@/lib/types";
import { cn } from "@/lib/utils";
import { providerUi } from "./providers";

/**
 * In a workout's details, per connected fitness service: a link to its copy once uploaded
 * ("View on Strava"), otherwise "Send to …". Nothing when no service is set up.
 */
export function WorkoutExports({ session, className }: { session: WorkoutSession; className?: string }) {
  const { data: integrations } = useIntegrations();
  const send = useSendWorkout();
  const exports = (send.data?.id === session.id ? send.data.exports : session.exports) ?? [];

  const rows = (integrations ?? []).flatMap(({ provider, name, connection }) => {
    const done = exports.find((e) => e.provider === provider);
    const ui = providerUi(provider, name);
    if (done?.status === "uploaded") {
      return done.url
        ? [
            <a
              key={provider}
              href={done.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn("text-sm font-semibold underline-offset-4 hover:underline", ui.linkClassName)}
            >
              {ui.viewText}
            </a>,
          ]
        : [<p key={provider} className="text-sm text-muted-foreground">Sent to {name}</p>];
    }
    if (!connection) return [];
    const pending = send.isPending && send.variables?.provider === provider;
    const error = (send.variables?.provider === provider ? send.error?.message : null) ?? done?.error;
    return [
      <div key={provider} className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" loading={pending} onClick={() => send.mutate({ provider, sessionId: session.id })}>
          Send to {name}
        </Button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>,
    ];
  });

  if (!rows.length) return null;
  return <div className={cn("flex flex-wrap items-center gap-4", className)}>{rows}</div>;
}

"use client";

import { Button } from "@/components/ui/button";
import { useSendToStrava, useStrava } from "@/hooks/use-strava";
import type { WorkoutSession } from "@/lib/types";
import { cn } from "@/lib/utils";

/** In a workout's details: "View on Strava" once uploaded, otherwise "Send to Strava" (if connected). */
export function StravaSessionLink({
  session,
  className,
}: {
  session: WorkoutSession;
  className?: string;
}) {
  const { data } = useStrava();
  const send = useSendToStrava();
  const strava = send.data?.strava ?? session.strava;

  if (strava?.status === "uploaded" && strava.activityId) {
    return (
      <div className={className}>
        {/* Strava's guidelines: link text "View on Strava", bold or in #FC5200. */}
        <a
          href={`https://www.strava.com/activities/${strava.activityId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-bold text-[#FC5200] underline-offset-4 hover:underline"
        >
          View on Strava
        </a>
      </div>
    );
  }
  if (!data?.available || !data.connection) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <Button
        variant="outline"
        size="sm"
        loading={send.isPending}
        onClick={() => send.mutate(session.id)}
      >
        Send to Strava
      </Button>
      {(send.error?.message || strava?.error) && (
        <p className="text-sm text-red-400">
          {send.error?.message ?? strava?.error}
        </p>
      )}
    </div>
  );
}

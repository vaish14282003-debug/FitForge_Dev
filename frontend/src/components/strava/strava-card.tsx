"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import {
  useConnectStrava,
  useDisconnectStrava,
  useStrava,
  useStravaAutoUpload,
} from "@/hooks/use-strava";

// What the callback reports back in ?strava=… (see the API's strava.controller).
const OUTCOMES: Record<
  string,
  { title: string; description?: string; tone: "success" | "error" }
> = {
  connected: {
    title: "Strava connected",
    description: "Your next workout will appear on Strava.",
    tone: "success",
  },
  denied: {
    title: "Strava wasn't connected",
    description: "You declined on Strava's screen.",
    tone: "error",
  },
  "missing-permission": {
    title: "Strava needs upload permission",
    description: "Connect again and leave “Upload your activities” ticked.",
    tone: "error",
  },
  expired: {
    title: "That Strava link expired",
    description: "Start again from this page.",
    tone: "error",
  },
  error: {
    title: "Couldn't connect to Strava",
    description: "Please try again in a minute.",
    tone: "error",
  },
  unavailable: { title: "Strava isn't available right now", tone: "error" },
};

/** Profile card: link Strava (with Strava's official button), auto-upload switch, disconnect. */
export function StravaCard() {
  const { data } = useStrava();
  const connect = useConnectStrava();
  const autoUpload = useStravaAutoUpload();
  const disconnect = useDisconnectStrava();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();

  // Show the result of a trip to Strava once, then tidy the address bar. Read directly rather than
  // via useSearchParams, so the page needs no Suspense boundary.
  useEffect(() => {
    const outcome = new URLSearchParams(window.location.search).get("strava");
    if (!outcome) return;
    const message = OUTCOMES[outcome];
    if (message) toast(message);
    router.replace(pathname, { scroll: false });
  }, [toast, router, pathname]);

  if (!data?.available) return null;
  const connection = data.connection;

  return (
    <Card>
      <CardTitle className="text-foreground">Connected apps</CardTitle>
      <div className="mt-4 space-y-4 text-sm">
        {connection ? (
          <>
            <p className="text-muted-foreground">
              Strava is connected
              {connection.athleteName ? (
                <>
                  {" "}
                  as{" "}
                  <span className="font-semibold text-foreground">
                    {connection.athleteName}
                  </span>
                </>
              ) : null}
              . Finished workouts are posted as Weight Training activities.
            </p>
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <span>
                <span className="block font-medium text-foreground">
                  Upload workouts automatically
                </span>
                <span className="text-xs text-muted-foreground">
                  Off: send individual workouts from History.
                </span>
              </span>
              <input
                type="checkbox"
                role="switch"
                className="size-5 accent-[#FC5200]"
                checked={connection.autoUpload}
                disabled={autoUpload.isPending}
                onChange={(e) => autoUpload.mutate(e.target.checked)}
              />
            </label>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              loading={disconnect.isPending}
              onClick={() => disconnect.mutate()}
            >
              {!disconnect.isPending && (
                <Unplug className="size-4" aria-hidden />
              )}
              Disconnect Strava
            </Button>
          </>
        ) : (
          <>
            <p className="text-muted-foreground">
              Post every workout you finish to Strava, with your sets and
              volume.
            </p>
            {/* Strava's official button artwork, unmodified (developers.strava.com/guidelines). */}
            <button
              type="button"
              onClick={() => connect.mutate()}
              disabled={connect.isPending}
              className="block rounded-md transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC5200] disabled:opacity-60"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size brand SVG */}
              <img
                src="/brand/strava/connect-with-strava-orange.svg"
                alt="Connect with Strava"
                width={237}
                height={48}
              />
            </button>
            {connect.error && (
              <p className="text-sm text-red-400">{connect.error.message}</p>
            )}
          </>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size brand SVG */}
        <img
          src="/brand/strava/powered-by-strava-white.svg"
          alt="Powered by Strava"
          width={130}
          height={13}
          className="opacity-80"
        />
      </div>
    </Card>
  );
}

"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { useConnectIntegration, useDisconnectIntegration, useIntegrationAutoUpload, useIntegrations } from "@/hooks/use-integrations";
import type { Integration } from "@/lib/types";
import { providerUi } from "./providers";

// What the API's callback reports in ?integration=…&result=… (see integration.controller).
const OUTCOMES: Record<string, (name: string) => { title: string; description?: string; tone: "success" | "error" }> = {
  connected: (name) => ({ title: `${name} connected`, description: `Your next workout will appear on ${name}.`, tone: "success" }),
  denied: (name) => ({ title: `${name} wasn't connected`, description: `You declined on ${name}'s screen.`, tone: "error" }),
  "missing-permission": (name) => ({
    title: `${name} needs upload permission`,
    description: "Connect again and leave the permission to upload activities ticked.",
    tone: "error",
  }),
  expired: (name) => ({ title: `That ${name} link expired`, description: "Start again from this page.", tone: "error" }),
  error: (name) => ({ title: `Couldn't connect to ${name}`, description: "Please try again in a minute.", tone: "error" }),
  unavailable: (name) => ({ title: `${name} isn't available right now`, tone: "error" }),
};

function ProviderRow({ integration }: { integration: Integration }) {
  const { provider, name, connection } = integration;
  const ui = providerUi(provider, name);
  const connect = useConnectIntegration();
  const autoUpload = useIntegrationAutoUpload();
  const disconnect = useDisconnectIntegration();

  return (
    <div className="space-y-4 text-sm">
      {connection ? (
        <>
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">{name}</span> is connected
            {connection.displayName ? (
              <>
                {" "}as <span className="font-semibold text-foreground">{connection.displayName}</span>
              </>
            ) : null}
            .
          </p>
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <span>
              <span className="block font-medium text-foreground">Upload workouts automatically</span>
              <span className="text-xs text-muted-foreground">Off: send individual workouts from History.</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="size-5 accent-primary"
              checked={connection.autoUpload}
              disabled={autoUpload.isPending}
              onChange={(e) => autoUpload.mutate({ provider, autoUpload: e.target.checked })}
            />
          </label>
          <Button variant="outline" size="sm" className="w-full" loading={disconnect.isPending} onClick={() => disconnect.mutate(provider)}>
            {!disconnect.isPending && <Unplug className="size-4" aria-hidden />}
            Disconnect {name}
          </Button>
        </>
      ) : (
        <>
          <p className="text-muted-foreground">{ui.pitch}</p>
          {ui.connectButton ? (
            ui.connectButton({ onClick: () => connect.mutate(provider), disabled: connect.isPending })
          ) : (
            <Button size="sm" loading={connect.isPending} onClick={() => connect.mutate(provider)}>
              Connect {name}
            </Button>
          )}
          {connect.error && <p className="text-sm text-red-400">{connect.error.message}</p>}
        </>
      )}
      {ui.attribution}
    </div>
  );
}

/** Profile card listing the fitness services this server offers. Hidden when there are none. */
export function ConnectedAppsCard() {
  const { data: integrations } = useIntegrations();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();

  // Show the result of a trip to a provider once, then tidy the address bar. Read directly rather
  // than via useSearchParams, so the page needs no Suspense boundary.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const provider = params.get("integration");
    const result = params.get("result");
    if (!provider || !result || !integrations) return;
    const name = integrations.find((i) => i.provider === provider)?.name ?? provider;
    const message = OUTCOMES[result]?.(name);
    if (message) toast(message);
    router.replace(pathname, { scroll: false });
  }, [integrations, toast, router, pathname]);

  if (!integrations?.length) return null;

  return (
    <Card>
      <CardTitle className="text-foreground">Connected apps</CardTitle>
      <div className="mt-4 divide-y divide-white/10 [&>*]:py-5 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
        {integrations.map((integration) => (
          <ProviderRow key={integration.provider} integration={integration} />
        ))}
      </div>
    </Card>
  );
}

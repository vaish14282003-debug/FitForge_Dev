/* eslint-disable @next/next/no-img-element -- fixed-size brand SVGs */
import type { ReactNode } from "react";

/**
 * How each fitness service looks in FitForge. Brand rules differ per provider (e.g. Strava requires
 * its official button and the link text "View on Strava"), so they live here, one entry per provider.
 * A provider without an entry gets the neutral defaults below.
 */
type ProviderUi = {
  pitch: string;
  connectButton?: (props: { onClick: () => void; disabled: boolean }) => ReactNode;
  /** Link text back to the provider's copy of a workout. */
  viewText: string;
  linkClassName?: string;
  attribution?: ReactNode;
};

const PROVIDER_UI: Record<string, ProviderUi> = {
  strava: {
    pitch: "Post every workout you finish to Strava, with your sets and volume.",
    // Strava's official button artwork, unmodified (developers.strava.com/guidelines).
    connectButton: ({ onClick, disabled }) => (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="block rounded-md transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC5200] disabled:opacity-60"
      >
        <img src="/brand/strava/connect-with-strava-orange.svg" alt="Connect with Strava" width={237} height={48} />
      </button>
    ),
    // Strava's guidelines: link text "View on Strava", bold or in #FC5200.
    viewText: "View on Strava",
    linkClassName: "font-bold text-[#FC5200]",
    attribution: <img src="/brand/strava/powered-by-strava-white.svg" alt="Powered by Strava" width={130} height={13} className="opacity-80" />,
  },
};

export function providerUi(provider: string, name: string): ProviderUi {
  return PROVIDER_UI[provider] ?? { pitch: `Send every workout you finish to ${name}.`, viewText: `View on ${name}` };
}

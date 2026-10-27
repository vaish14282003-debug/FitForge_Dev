import os from "node:os";
import type { NextConfig } from "next";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

// Lets phones on the same network open the dev server by this machine's IP (e.g. after scanning the
// front-desk QR code). Extra hosts, such as a tunnel, can be added with DEV_ORIGINS="a.example,b.example".
const devOrigins = [
  ...Object.values(os.networkInterfaces())
    .flat()
    .filter((entry) => entry?.family === "IPv4" && !entry.internal)
    .map((entry) => entry!.address),
  ...(process.env.DEV_ORIGINS?.split(",").map((host) => host.trim()).filter(Boolean) ?? []),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Hides the floating "N" dev button, which covered the phone tab bar. Errors still show if they happen.
  devIndicators: false,
  allowedDevOrigins: devOrigins,
  partialPrefetching: true,
  // 90 is used for the full-bleed landing hero, where compression artefacts show most.
  images: { qualities: [75, 90] },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The browser only ever talks to this origin, so the API's httpOnly auth cookies are first-party.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;

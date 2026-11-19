import type { MetadataRoute } from "next";

// Lets phones install FitForge from the browser ("Add to Home Screen"): it opens full-screen,
// with its own icon, and keeps working offline thanks to the service worker (public/sw.js).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FitForge",
    short_name: "FitForge",
    description: "Training, progress and gym management in one place.",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0707",
    theme_color: "#0b0707",
    categories: ["fitness", "health", "sports"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

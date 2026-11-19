"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js in production builds, which makes FitForge installable and usable offline.
 * Not in development: cached pages would hide code changes while working on the app.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Unsupported or blocked (e.g. private mode): the app works as a normal website.
    });
  }, []);
  return null;
}

/** Asks the service worker to forget remembered pages (on logout). */
export function clearOfflinePages() {
  navigator.serviceWorker?.controller?.postMessage("clear-pages");
}

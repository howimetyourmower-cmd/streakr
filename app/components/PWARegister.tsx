// /app/components/PWARegister.tsx
"use client";

import { useEffect } from "react";

export default function PWARegister() {
  useEffect(() => {
    // Only register in production-like environments (you can loosen this later if you want)
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

        // Optional: log when a new SW is found
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;

          installing.addEventListener("statechange", () => {
            // installed + there’s an active controller => update available
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              // You can later trigger a toast: “Update available — Refresh”
              // Keeping silent for now.
            }
          });
        });
      } catch (e) {
        // Silent fail — PWA should never break app UX
      }
    };

    void register();
  }, []);

  return null;
}

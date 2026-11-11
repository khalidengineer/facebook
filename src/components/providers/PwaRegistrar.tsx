"use client";

import { useEffect } from "react";

export function PwaRegistrar() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        // Detect GitHub Pages subpath vs root
        const pathname = window.location.pathname;
        const isGhPages = pathname.startsWith("/facebook");
        const swUrl = isGhPages ? "/facebook/sw.js" : "/sw.js";
        const scope = isGhPages ? "/facebook/" : "/";

        navigator.serviceWorker
          .register(swUrl, { scope })
          .then((registration) => {
            console.log("PWA Service Worker registered with scope:", registration.scope);
          })
          .catch((error) => {
            console.warn("PWA Service Worker registration failed:", error);
          });
      });
    }
  }, []);

  return null;
}

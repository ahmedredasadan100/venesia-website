import { PWA_CONFIG } from "../../config/pwa";

export async function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    return await navigator.serviceWorker.register(PWA_CONFIG.serviceWorkerPath, {
      scope: PWA_CONFIG.scope,
      updateViaCache: "none",
    });
  } catch {
    return null;
  }
}

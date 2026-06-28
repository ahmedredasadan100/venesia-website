import { PWA_CONFIG } from "../../config/pwa";

const DISMISS_MS = PWA_CONFIG.install.dismissDays * 24 * 60 * 60 * 1000;

export function readInstallDismissedAt(): number | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(PWA_CONFIG.install.storageKey);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function isInstallRecentlyDismissed(now = Date.now()) {
  const dismissedAt = readInstallDismissedAt();
  if (!dismissedAt) return false;
  return now - dismissedAt < DISMISS_MS;
}

export function markInstallDismissed(now = Date.now()) {
  try {
    window.localStorage.setItem(PWA_CONFIG.install.storageKey, String(now));
  } catch {
    // Ignore storage failures (private mode, etc.).
  }
}

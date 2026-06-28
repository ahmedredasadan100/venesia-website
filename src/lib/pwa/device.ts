export function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

export function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}

export function isStandaloneDisplayMode() {
  if (typeof window === "undefined") return false;

  const standaloneMedia = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;

  return standaloneMedia || iosStandalone;
}

export function canRegisterServiceWorker() {
  return typeof window !== "undefined" && "serviceWorker" in navigator;
}

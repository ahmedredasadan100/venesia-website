"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { PWA_CONFIG } from "../../config/pwa";
import {
  canRegisterServiceWorker,
  isIosDevice,
  isMobileViewport,
  isStandaloneDisplayMode,
} from "../../lib/pwa/device";
import {
  isInstallRecentlyDismissed,
  markInstallDismissed,
} from "../../lib/pwa/install-storage";
import { registerServiceWorker } from "../../lib/pwa/register-service-worker";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type PwaInstallContextValue = {
  visible: boolean;
  isIOS: boolean;
  canNativeInstall: boolean;
  dismiss: () => void;
  install: () => Promise<void>;
};

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

export function usePwaInstall() {
  const context = useContext(PwaInstallContext);
  if (!context) {
    throw new Error("usePwaInstall must be used within PwaProvider");
  }
  return context;
}

export default function PwaProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [canNativeInstall, setCanNativeInstall] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const engagementReadyRef = useRef(false);

  const dismiss = useCallback(() => {
    markInstallDismissed();
    setVisible(false);
  }, []);

  const install = useCallback(async () => {
    const deferredPrompt = deferredPromptRef.current;
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPromptRef.current = null;
    setCanNativeInstall(false);
    setVisible(false);
  }, []);

  const evaluateVisibility = useCallback(() => {
    if (!isMobileViewport()) {
      setVisible(false);
      return;
    }

    if (isStandaloneDisplayMode() || isInstallRecentlyDismissed()) {
      setVisible(false);
      return;
    }

    if (!engagementReadyRef.current) {
      setVisible(false);
      return;
    }

    const ios = isIosDevice();
    setIsIOS(ios);

    if (ios) {
      setVisible(true);
      return;
    }

    setVisible(Boolean(deferredPromptRef.current));
  }, []);

  useEffect(() => {
    if (!canRegisterServiceWorker()) return;
    void registerServiceWorker();
  }, []);

  useEffect(() => {
    const markEngaged = () => {
      engagementReadyRef.current = true;
      evaluateVisibility();
    };

    const timer = window.setTimeout(markEngaged, PWA_CONFIG.install.delayMs);
    window.addEventListener("pointerdown", markEngaged, { once: true, passive: true });
    window.addEventListener("keydown", markEngaged, { once: true });
    window.addEventListener("scroll", markEngaged, { once: true, passive: true });

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", markEngaged);
      window.removeEventListener("keydown", markEngaged);
      window.removeEventListener("scroll", markEngaged);
    };
  }, [evaluateVisibility]);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
      setCanNativeInstall(true);
      evaluateVisibility();
    };

    const onAppInstalled = () => {
      deferredPromptRef.current = null;
      setCanNativeInstall(false);
      setVisible(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [evaluateVisibility]);

  useEffect(() => {
    setIsIOS(isIosDevice());
    evaluateVisibility();

    const media = window.matchMedia("(max-width: 767px)");
    const onViewportChange = () => evaluateVisibility();
    media.addEventListener("change", onViewportChange);

    return () => media.removeEventListener("change", onViewportChange);
  }, [evaluateVisibility]);

  const value = useMemo(
    () => ({
      visible,
      isIOS,
      canNativeInstall,
      dismiss,
      install,
    }),
    [visible, isIOS, canNativeInstall, dismiss, install],
  );

  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>;
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { canRegisterServiceWorker } from "../../lib/pwa/device";
import { registerServiceWorker } from "../../lib/pwa/register-service-worker";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallHint = "android-fallback" | "iphone" | null;

const ANDROID_FALLBACK_MESSAGE = "من قائمة Chrome اختر Install app أو Add to Home screen.";
const IPHONE_INSTRUCTIONS = "اضغط Share ثم اختر Add to Home Screen.";

function AndroidIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-[#D8B87A]">
      <path
        fill="currentColor"
        d="M17.6 9.5 18.8 7l.2-.4a.6.6 0 0 0-.2-.8.6.6 0 0 0-.8.2l-.2.4-1.1 2.1a7.2 7.2 0 0 0-4.7-1.7 7.2 7.2 0 0 0-4.7 1.7L6.2 6.4a.6.6 0 0 0-.8-.2.6.6 0 0 0-.2.8l.2.4 1.2 2.5A6.4 6.4 0 0 0 4 14.8v1.2a1.6 1.6 0 0 0 1.6 1.6h.8v3.2a1.6 1.6 0 0 0 3.2 0v-3.2h4.8v3.2a1.6 1.6 0 0 0 3.2 0v-3.2h.8A1.6 1.6 0 0 0 20 16V14.8a6.4 6.4 0 0 0-2.4-5.3ZM9.2 13.2a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Zm5.6 0a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Z"
      />
    </svg>
  );
}

function IPhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-[#D8B87A]">
      <path
        fill="currentColor"
        d="M16.8 2H7.2A2.2 2.2 0 0 0 5 4.2v15.6A2.2 2.2 0 0 0 7.2 22h9.6a2.2 2.2 0 0 0 2.2-2.2V4.2A2.2 2.2 0 0 0 16.8 2ZM12 19.1a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2Zm4.8-14H7.2V16h9.6V5.1Z"
      />
    </svg>
  );
}

export default function MaintenanceInstallTeaser() {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [hint, setHint] = useState<InstallHint>(null);

  useEffect(() => {
    if (canRegisterServiceWorker()) {
      void registerServiceWorker();
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, []);

  const handleAndroidClick = useCallback(async () => {
    const deferredPrompt = deferredPromptRef.current;

    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPromptRef.current = null;
      setHint(null);
      return;
    }

    setHint("android-fallback");
  }, []);

  const handleIPhoneClick = useCallback(() => {
    setHint("iphone");
  }, []);

  return (
    <div className="rounded-[28px] border border-white/8 bg-[#05070B]/55 px-5 py-5 backdrop-blur-sm">
      <p className="text-sm font-medium leading-7 text-white/80">تجربة فينيسيا الجديدة ستكون أقرب إليك.</p>
      <p className="mt-1 text-xs leading-6 text-white/45">ثبّت Venesia على شاشة موبايلك عند الإطلاق.</p>

      <div className="mt-5 flex items-center justify-center gap-8">
        <button
          type="button"
          onClick={() => void handleAndroidClick()}
          className="flex flex-col items-center gap-2 rounded-2xl transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/50"
          aria-label="تثبيت Venesia على Android"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D8B87A]/20 bg-[#D8B87A]/8">
            <AndroidIcon />
          </span>
          <span className="text-[11px] text-white/45">Android</span>
        </button>

        <button
          type="button"
          onClick={handleIPhoneClick}
          className="flex flex-col items-center gap-2 rounded-2xl transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/50"
          aria-label="تثبيت Venesia على iPhone"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D8B87A]/20 bg-[#D8B87A]/8">
            <IPhoneIcon />
          </span>
          <span className="text-[11px] text-white/45">iPhone</span>
        </button>
      </div>

      {hint ? (
        <p
          className="mt-4 rounded-2xl border border-[#D8B87A]/15 bg-[#D8B87A]/5 px-4 py-3 text-center text-xs leading-6 text-[#D8B87A]/85"
          role="status"
          aria-live="polite"
        >
          {hint === "iphone" ? IPHONE_INSTRUCTIONS : ANDROID_FALLBACK_MESSAGE}
        </p>
      ) : null}
    </div>
  );
}

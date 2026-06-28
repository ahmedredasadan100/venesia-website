"use client";

import { usePwaInstall } from "./PwaProvider";

export default function InstallPrompt() {
  const { visible, isIOS, canNativeInstall, dismiss, install } = usePwaInstall();

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="تثبيت التطبيق"
      className="fixed inset-x-0 bottom-0 z-[70] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 md:hidden"
    >
      <div className="mx-auto max-w-md overflow-hidden rounded-2xl border border-[#D8B87A]/25 bg-[#07090E]/95 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-md">
        <div className="px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D8B87A]/30 bg-[#D8B87A]/10 text-sm font-semibold text-[#D8B87A]">
              V
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">ثبّت Venesia على شاشتك</p>
              <p className="mt-1 text-xs leading-6 text-white/60">
                {isIOS
                  ? "للوصول السريع: اضغط زر المشاركة ثم اختر «إضافة إلى الشاشة الرئيسية»."
: "ثبّت الموقع   للوصول السريع إلى Venesia Developments."}              </p>

              {isIOS ? (
                <p className="mt-2 text-[11px] leading-6 text-[#D8B87A]/75">
                  Share <span aria-hidden="true">□↑</span> → Add to Home Screen{" "}
                  <span aria-hidden="true">➕</span>
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={dismiss}
              aria-label="إغلاق"
              className="shrink-0 rounded-lg px-2 py-1 text-lg leading-none text-white/45 transition hover:text-white/80"
            >
              ×
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2">
            {!isIOS && canNativeInstall ? (
              <button
                type="button"
                onClick={() => void install()}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#D8B87A] px-4 py-2.5 text-sm font-medium text-[#06101C] transition hover:bg-[#c9a760]"
              >
                تثبيت التطبيق
              </button>
            ) : null}

            <button
              type="button"
              onClick={dismiss}
              className={`inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 transition hover:border-white/20 hover:text-white ${!isIOS && canNativeInstall ? "" : "flex-1"}`}
            >
              لاحقًا
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

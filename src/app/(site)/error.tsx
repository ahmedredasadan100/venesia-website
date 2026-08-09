"use client";

import { useEffect } from "react";

import { logError } from "../../lib/logging";

export default function PublicSiteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    logError("Public route render failed", error, {
      boundary: "public-site",
      digest: error.digest,
    });
  }, [error]);

  return (
    <main
      className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-6 py-20 text-center"
      dir="rtl"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D8B87A]/70">
        VENESIA
      </p>
      <h1 className="mt-4 text-3xl font-semibold text-white">
        تعذّر تحميل الصفحة
      </h1>
      <p className="mt-4 max-w-xl leading-8 text-white/60">
        حدث خطأ غير متوقع أثناء تجهيز المحتوى. يمكنك إعادة المحاولة الآن.
      </p>
      <button
        type="button"
        onClick={retry}
        className="mt-7 rounded-full border border-[#D8B87A]/35 bg-[#D8B87A]/10 px-6 py-3 text-sm font-semibold text-[#D8B87A] transition hover:border-[#D8B87A]/60"
      >
        إعادة المحاولة
      </button>
    </main>
  );
}

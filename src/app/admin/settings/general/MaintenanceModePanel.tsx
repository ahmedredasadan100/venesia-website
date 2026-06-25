"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateMaintenanceModeAction } from "./actions";

type MaintenanceModePanelProps = {
  initialEnabled: boolean;
};

export default function MaintenanceModePanel({ initialEnabled }: MaintenanceModePanelProps) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onToggle() {
    const nextValue = !enabled;
    setError(null);

    startTransition(async () => {
      try {
        await updateMaintenanceModeAction(nextValue);
        setEnabled(nextValue);
        router.refresh();
      } catch (toggleError) {
        const message = toggleError instanceof Error ? toggleError.message : "تعذر تحديث وضع الصيانة.";
        setError(message);
      }
    });
  }

  return (
    <section className="rounded-[28px] border border-white/10 bg-[#080B10]/78 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.22)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D8B87A]/70">Maintenance Mode</p>
          <h2 className="mt-2 text-xl font-semibold text-white">وضع الصيانة</h2>
          <p className="mt-3 text-sm leading-7 text-white/55">
            عند التفعيل، تُحوَّل الصفحات العامة إلى <code className="text-white/75">/maintenance</code> حتى يتم
            تسجيل الدخول بنفس بيانات الأدمن. لوحة التحكم تبقى متاحة من{" "}
            <code className="text-white/75">/admin</code>.
          </p>
        </div>

        <button
          type="button"
          onClick={onToggle}
          disabled={isPending}
          aria-pressed={enabled}
          className={[
            "rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:opacity-60",
            enabled
              ? "border border-red-400/25 bg-red-500/10 text-red-100 hover:bg-red-500/15"
              : "border border-[#D8B87A]/30 bg-[#D8B87A] text-[#06101C] hover:bg-[#e5c98d]",
          ].join(" ")}
        >
          {isPending ? "جاري الحفظ…" : enabled ? "إيقاف الصيانة" : "تشغيل الصيانة"}
        </button>
      </div>

      <p className="mt-4 text-sm text-white/45">
        الحالة الحالية:{" "}
        <span className={enabled ? "font-semibold text-[#D8B87A]" : "font-semibold text-white/70"}>
          {enabled ? "مفعّل" : "متوقف"}
        </span>
      </p>

      {error ? (
        <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</p>
      ) : null}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";

type CountdownValues = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

type CountdownState = CountdownValues | "expired";

function getCountdownState(endMs: number): CountdownState {
  const diff = endMs - Date.now();
  if (diff <= 0) return "expired";

  const totalSeconds = Math.floor(diff / 1000);

  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

const UNITS: { key: keyof CountdownValues; label: string }[] = [
  { key: "days", label: "يوم" },
  { key: "hours", label: "ساعة" },
  { key: "minutes", label: "دقيقة" },
  { key: "seconds", label: "ثانية" },
];

type MaintenanceCountdownProps = {
  endIso: string;
};

export default function MaintenanceCountdown({ endIso }: MaintenanceCountdownProps) {
  const endMs = Date.parse(endIso);
  const [state, setState] = useState<CountdownState>(() => getCountdownState(endMs));

  useEffect(() => {
    setState(getCountdownState(endMs));

    const timer = window.setInterval(() => {
      setState(getCountdownState(endMs));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [endMs]);

  if (state === "expired") {
    return (
      <div
        className="rounded-[28px] border border-[#D8B87A]/20 bg-[#05070B]/70 px-5 py-6 text-center backdrop-blur-sm"
        aria-live="polite"
      >
        <p className="text-sm font-medium text-[#D8B87A]">اكتمل الوقت المتوقع للإطلاق</p>
        <p className="mt-2 text-xs leading-6 text-white/45">نعمل على اللمسات الأخيرة — ترقّبونا قريبًا.</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-[28px] border border-[#D8B87A]/20 bg-[#05070B]/70 px-4 py-5 backdrop-blur-sm"
      aria-live="polite"
      aria-label="العد التنازلي للإطلاق"
    >
      <p className="mb-4 text-center text-xs font-semibold tracking-[0.18em] text-[#D8B87A]/75">
        الوقت المتبقي للإطلاق
      </p>

      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {UNITS.map(({ key, label }) => (
          <div key={key} className="text-center">
            <div className="rounded-2xl border border-white/8 bg-[#080B10]/80 px-2 py-3 sm:px-3 sm:py-4">
              <span className="block font-semibold tabular-nums text-[clamp(1.35rem,4vw,1.85rem)] leading-none text-[#D8B87A]">
                {pad(state[key])}
              </span>
            </div>
            <span className="mt-2 block text-[11px] text-white/40">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

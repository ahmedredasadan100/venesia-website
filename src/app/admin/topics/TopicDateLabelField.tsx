"use client";

import { useMemo, useRef, useState } from "react";

import {
  formatArabicContentDate,
  getDateInputValue,
  getTodayInputValue,
} from "../../../lib/content-dates";

type TopicDateLabelFieldProps = {
  defaultValue?: string | null;
  publishedAt?: string | null;
};

function formatArabicDate(value: string) {
  return formatArabicContentDate(value);
}

export default function TopicDateLabelField({ defaultValue, publishedAt }: TopicDateLabelFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const defaultIsDate = /^\d{4}-\d{2}-\d{2}$/.test(defaultValue ?? "");
  const publishedDateValue = getDateInputValue(publishedAt);
  const [dateValue, setDateValue] = useState(() => {
    if (publishedDateValue) return publishedDateValue;
    if (defaultIsDate) return defaultValue ?? "";
    if (!defaultValue) return getTodayInputValue();
    return "";
  });
  const [manualLabel, setManualLabel] = useState(defaultValue && !defaultIsDate ? defaultValue : "");

  const computedLabel = useMemo(() => manualLabel.trim() || formatArabicDate(dateValue), [dateValue, manualLabel]);

  function openCalendar() {
    const input = inputRef.current;
    if (!input) return;
    const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof pickerInput.showPicker === "function") {
      pickerInput.showPicker();
      return;
    }
    input.focus();
    input.click();
  }

  return (
    <div className="block">
      <span className="text-sm font-medium text-white/70">تاريخ النشر</span>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1.2fr]">
        <div className="flex overflow-hidden rounded-2xl border border-white/10 bg-black/30 focus-within:border-[#D8B87A]/45">
          <input
            ref={inputRef}
            type="date"
            value={dateValue}
            onChange={(event) => {
              setDateValue(event.target.value);
              setManualLabel("");
            }}
            className="w-full bg-transparent px-4 py-3 text-sm text-white outline-none"
          />
          <button
            type="button"
            onClick={openCalendar}
            className="border-r border-white/10 px-4 text-xs font-medium text-[#D8B87A] transition hover:bg-[#D8B87A]/10"
          >
            فتح التقويم
          </button>
        </div>
        <input
          value={manualLabel}
          onChange={(event) => setManualLabel(event.target.value)}
          placeholder="اختياري: Label يدوي مثل دليل محدث"
          className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
        />
      </div>
      <input type="hidden" name="published_at" value={dateValue} />
      <input type="hidden" name="date_label" value={computedLabel} />
      <p className="mt-2 text-xs leading-6 text-white/35">
        التاريخ المعروض للزائر: <span className="text-[#D8B87A]">{computedLabel || "—"}</span>
      </p>
    </div>
  );
}

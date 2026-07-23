"use client";

import { useRef, useState } from "react";

import {
  getDateInputValue,
  getTodayInputValue,
} from "../../../../../lib/content-dates";
import { TOPIC_SETTINGS_SURFACE_CLASS_NAME } from "./TopicFormSwitch";

type TopicDateLabelFieldProps = {
  defaultValue?: string | null;
  publishedAt?: string | null;
  disabled?: boolean;
};

export default function TopicDateLabelField({ defaultValue, publishedAt, disabled = false }: TopicDateLabelFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const defaultIsDate = /^\d{4}-\d{2}-\d{2}$/.test(defaultValue ?? "");
  const publishedDateValue = getDateInputValue(publishedAt);
  const [dateValue, setDateValue] = useState(() => {
    if (publishedDateValue) return publishedDateValue;
    if (defaultIsDate) return defaultValue ?? "";
    if (!defaultValue) return getTodayInputValue();
    return "";
  });
  const preservedLegacyLabel = defaultValue?.trim() ?? "";

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
    <>
      <div id="topic-publish-date-field" className={`${TOPIC_SETTINGS_SURFACE_CLASS_NAME} min-w-0`} data-topic-publish-date-field>
        <span className="text-xs font-medium text-white/70">تاريخ النشر</span>
        <div className="mt-2 flex min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30 focus-within:border-[#D8B87A]/45">
          <input
            ref={inputRef}
            type="date"
            name="published_at"
            disabled={disabled}
            value={dateValue}
            onChange={(event) => {
              setDateValue(event.target.value);
            }}
            aria-label="تاريخ النشر"
            className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-white outline-none"
          />
          <button
            type="button"
            disabled={disabled}
            onClick={openCalendar}
            className="shrink-0 whitespace-nowrap border-r border-white/10 px-3 text-xs font-medium text-[#D8B87A] transition hover:bg-[#D8B87A]/10"
          >
            فتح التقويم
          </button>
        </div>
      </div>
      <input type="hidden" name="date_label" value={preservedLegacyLabel} />
    </>
  );
}

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
    if (disabled) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus({ preventScroll: true });
    const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof pickerInput.showPicker === "function") {
      try {
        pickerInput.showPicker();
        return;
      } catch {
        // Fall through to the native input click while the user gesture is
        // still active.
      }
    }
    input.click();
  }

  return (
    <>
      <div id="topic-publish-date-field" className={`${TOPIC_SETTINGS_SURFACE_CLASS_NAME} min-w-0`} data-topic-publish-date-field>
        <button
          type="button"
          disabled={disabled}
          onClick={openCalendar}
          aria-controls="topic-published-at"
          aria-label="فتح تقويم تاريخ النشر"
          data-topic-date-picker-trigger="label"
          className="flex w-full items-center justify-between gap-3 text-xs font-medium text-white/70 transition hover:text-[#D8B87A] disabled:cursor-not-allowed disabled:opacity-55"
        >
          <span>تاريخ النشر</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            data-topic-date-picker-icon=""
            className="size-4 shrink-0 text-[#D8B87A]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
          </svg>
        </button>
        <div className="mt-2 flex min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30 focus-within:border-[#D8B87A]/45">
          <input
            ref={inputRef}
            id="topic-published-at"
            type="date"
            name="published_at"
            disabled={disabled}
            value={dateValue}
            onChange={(event) => {
              setDateValue(event.target.value);
            }}
            aria-label="تاريخ النشر"
            data-topic-date-picker-input=""
            className="min-w-0 flex-1 cursor-pointer bg-transparent px-3 py-3 text-sm text-white outline-none disabled:cursor-not-allowed"
          />
        </div>
      </div>
      <input type="hidden" name="date_label" value={preservedLegacyLabel} />
    </>
  );
}

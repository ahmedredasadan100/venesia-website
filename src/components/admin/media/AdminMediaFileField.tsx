"use client";

import { useState } from "react";

import AdminMediaPickerModal from "./AdminMediaPickerModal";

type AdminMediaFileFieldProps = {
  name: string;
  label: string;
  defaultValue?: string | null;
  browseFolder?: string;
  helperText?: string;
};

export default function AdminMediaFileField({
  name,
  label,
  defaultValue = "",
  browseFolder = "files/projects",
  helperText,
}: AdminMediaFileFieldProps) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [prevDefaultValue, setPrevDefaultValue] = useState(defaultValue);
  const [pickerOpen, setPickerOpen] = useState(false);

  if (defaultValue !== prevDefaultValue) {
    setPrevDefaultValue(defaultValue);
    setValue(defaultValue ?? "");
  }

  function updateValue(next: string) {
    setValue(next);
  }

  const fileName = value ? (value.split("/").pop() ?? value) : null;

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={value} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-semibold text-white/55">{label}</span>
        <div className="flex flex-wrap gap-2">
          {value ? (
            <>
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer rounded-2xl border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white"
              >
                View
              </a>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="cursor-pointer rounded-2xl border border-[#D8B87A]/35 bg-[#D8B87A]/10 px-4 py-2 text-sm font-semibold text-[#D8B87A] hover:bg-[#D8B87A]/15"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => updateValue("")}
                className="cursor-pointer rounded-2xl border border-white/10 px-4 py-2 text-sm text-white/55 hover:bg-white/5 hover:text-white"
              >
                Remove
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="cursor-pointer rounded-2xl border border-[#D8B87A]/35 bg-[#D8B87A]/10 px-4 py-2 text-sm font-semibold text-[#D8B87A] hover:bg-[#D8B87A]/15"
            >
              Choose PDF
            </button>
          )}
        </div>
      </div>

      {helperText ? <p className="text-xs leading-6 text-white/42">{helperText}</p> : null}

      {value ? (
        <div className="max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-black/25">
          <div className="flex items-center gap-3 px-4 py-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#D8B87A]/25 bg-[#D8B87A]/10 text-xs font-bold uppercase tracking-wide text-[#D8B87A]">
              PDF
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{fileName}</p>
              <p className="truncate font-mono text-[11px] text-white/45" dir="ltr">
                {value}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex h-32 w-full max-w-sm cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-[#05070B] text-sm text-white/45 hover:border-[#D8B87A]/30 hover:text-white/70"
        >
          No brochure PDF selected
        </button>
      )}

      <AdminMediaPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={updateValue}
        initialFolder={browseFolder}
        mode="pdf"
        replacePath={value || null}
      />
    </div>
  );
}

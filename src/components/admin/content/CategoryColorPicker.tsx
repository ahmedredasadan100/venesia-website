"use client";

import { useEffect, useRef, useState } from "react";
import {
  ADMIN_TONE_PALETTE,
  resolveAdminTone,
  type AdminToneToken,
} from "../../../lib/admin/content/admin-tone-palette";
import AdminCategoryBadge from "./AdminCategoryBadge";

function PaletteIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a9 9 0 1 0 0 18h1.2a1.8 1.8 0 0 0 0-3.6h-.7a1.7 1.7 0 0 1 0-3.4H15a6 6 0 0 0 0-12h-3Z" />
      <circle cx="7.5" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="6.8" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function CategoryColorPicker({
  defaultToken,
  previewName = "معاينة التصنيف",
}: {
  defaultToken?: string | null;
  previewName?: string;
}) {
  const hasStoredToken = Boolean(defaultToken);
  const [selected, setSelected] = useState<AdminToneToken | "">(
    hasStoredToken ? resolveAdminTone(defaultToken).token : "",
  );
  const sourceRef = useRef<HTMLInputElement>(null);
  const initialRenderRef = useRef(true);
  const previewToken = selected || "slate";

  useEffect(() => {
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      return;
    }
    sourceRef.current?.dispatchEvent(new Event("change", { bubbles: true }));
  }, [selected]);

  return (
    <fieldset className="space-y-3 md:col-span-2">
      <legend className="flex items-center gap-2 text-xs font-medium text-white/55">
        <PaletteIcon />
        لون التصنيف
      </legend>
      <input ref={sourceRef} type="hidden" name="color_token" value={selected} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelected("")}
          aria-pressed={selected === ""}
          className={`rounded-[10px] border px-3 py-2 text-xs transition ${
            selected === ""
              ? "border-[#D8B87A]/45 bg-[#D8B87A]/12 text-[#F4D99A]"
              : "border-white/10 text-white/48 hover:border-white/20"
          }`}
        >
          تلقائي
        </button>
        {ADMIN_TONE_PALETTE.map((tone) => (
          <button
            key={tone.token}
            type="button"
            onClick={() => setSelected(tone.token)}
            aria-label={`اختيار اللون ${tone.label}`}
            aria-pressed={selected === tone.token}
            title={tone.label}
            className={`flex h-10 w-10 items-center justify-center rounded-[10px] border transition ${
              selected === tone.token ? "border-white/65 bg-white/10" : "border-white/10 hover:border-white/30"
            }`}
          >
            <span className={`h-4 w-4 rounded-full ${tone.swatchClassName}`} />
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-white/8 bg-black/20 px-3 py-3">
        <span className="text-xs text-white/38">المعاينة:</span>
        <AdminCategoryBadge name={previewName} colorToken={previewToken} />
        {!selected ? (
          <span className="text-[11px] text-white/35">يُحدد اللون تلقائيًا من Slug عند الحفظ.</span>
        ) : null}
      </div>
    </fieldset>
  );
}

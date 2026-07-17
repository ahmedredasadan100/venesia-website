"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveContentTablePreferences } from "../../../app/admin/content/topics/actions";
import {
  DEFAULT_UNIFIED_CONTENT_COLUMN_KEYS,
  UNIFIED_CONTENT_COLUMNS,
  type UnifiedContentColumnKey,
} from "./unified-content-columns";

export default function AdminColumnVisibilityMenu({
  visibleColumns,
  onChange,
}: {
  visibleColumns: UnifiedContentColumnKey[];
  onChange: (columns: UnifiedContentColumnKey[]) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    function close(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function persist(next: UnifiedContentColumnKey[]) {
    onChange(next);
    setError("");
    startTransition(async () => {
      const result = await saveContentTablePreferences(next);
      if (!result.ok) setError("تعذر حفظ تفضيلات الأعمدة.");
    });
  }

  function toggle(key: UnifiedContentColumnKey) {
    const column = UNIFIED_CONTENT_COLUMNS.find((item) => item.key === key);
    if (!column?.hideable) return;
    const next = visibleColumns.includes(key)
      ? visibleColumns.filter((item) => item !== key)
      : [...visibleColumns, key];
    persist(next);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-white/10 bg-black/25 px-4 text-sm font-semibold text-white/72 transition hover:border-[#D8B87A]/30 hover:text-[#D8B87A]"
      >
        <span aria-hidden="true">▥</span>
        الأعمدة
        {isPending ? <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" /> : null}
      </button>

      {isOpen ? (
        <div
          role="menu"
          dir="rtl"
          className="absolute left-0 top-full z-50 mt-2 w-[280px] rounded-[16px] border border-[#D8B87A]/20 bg-[#080B10]/98 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl"
        >
          <p className="px-2 py-2 text-xs font-semibold text-white/45">الأعمدة الظاهرة</p>
          <div className="max-h-[340px] space-y-1 overflow-y-auto">
            {UNIFIED_CONTENT_COLUMNS.map((column) => (
              <label
                key={column.key}
                className={`flex items-center justify-between gap-3 rounded-[9px] px-2.5 py-2 text-sm ${
                  column.hideable ? "cursor-pointer text-white/76 hover:bg-white/[0.05]" : "cursor-not-allowed text-white/38"
                }`}
              >
                <span>{column.label}</span>
                <input
                  type="checkbox"
                  checked={visibleColumns.includes(column.key)}
                  disabled={!column.hideable}
                  onChange={() => toggle(column.key)}
                  className="h-4 w-4 accent-[#D8B87A]"
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => persist([...DEFAULT_UNIFIED_CONTENT_COLUMN_KEYS])}
            className="mt-2 w-full rounded-[9px] border border-white/10 px-3 py-2.5 text-sm font-semibold text-[#D8B87A] transition hover:bg-[#D8B87A]/10"
          >
            استعادة الأعمدة الافتراضية
          </button>
          {error ? <p role="alert" className="px-2 pt-2 text-xs text-red-200">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

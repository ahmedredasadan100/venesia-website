"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import AdminCheckbox from "./AdminCheckbox";

export type AdminColumnVisibilityItem<Key extends string = string> = {
  key: Key;
  label: string;
  hideable: boolean;
};

type PersistResult = {
  ok: boolean;
  message?: string;
};

type AdminColumnVisibilityMenuProps<Key extends string> = {
  columns: readonly AdminColumnVisibilityItem<Key>[];
  visibleColumns: readonly Key[];
  defaultColumns: readonly Key[];
  onChange: (columns: Key[]) => void;
  onPersist: (columns: Key[]) => Promise<PersistResult>;
  onPersisted?: (columns: Key[]) => void;
  label?: string;
};

export default function AdminColumnVisibilityMenu<Key extends string>({
  columns,
  visibleColumns,
  defaultColumns,
  onChange,
  onPersist,
  onPersisted,
  label = "الأعمدة",
}: AdminColumnVisibilityMenuProps<Key>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const saveQueueRef = useRef<Promise<PersistResult>>(Promise.resolve({ ok: true }));
  const latestColumnsRef = useRef<Key[]>([...visibleColumns]);

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

  function persist(next: Key[]) {
    latestColumnsRef.current = next;
    onChange(next);
    setError("");
    startTransition(async () => {
      const resultPromise = saveQueueRef.current.then(() => onPersist(next));
      saveQueueRef.current = resultPromise.catch(() => ({
        ok: false,
        message: "تعذر حفظ تفضيلات الأعمدة.",
      }));
      const result = await resultPromise.catch(() => ({
        ok: false,
        message: "تعذر حفظ تفضيلات الأعمدة.",
      }));
      if (!result.ok) {
        setError(result.message || "تعذر حفظ تفضيلات الأعمدة.");
      } else if (
        latestColumnsRef.current.length === next.length &&
        latestColumnsRef.current.every((key, index) => key === next[index])
      ) {
        onPersisted?.(next);
      }
    });
  }

  function toggle(key: Key) {
    const column = columns.find((item) => item.key === key);
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
        className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[10px] border border-white/10 bg-black/25 px-4 text-sm font-semibold text-white/72 transition hover:border-[#D8B87A]/30 hover:bg-white/[0.04] hover:text-[#D8B87A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70"
      >
        <span aria-hidden="true">▥</span>
        {label}
        {isPending ? (
          <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
        ) : null}
      </button>

      {isOpen ? (
        <div
          role="menu"
          dir="rtl"
          className="absolute left-0 top-full z-50 mt-2 w-[280px] rounded-[16px] border border-[#D8B87A]/20 bg-[#080B10]/98 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl"
        >
          <p className="px-2 py-2 text-xs font-semibold text-white/45">
            الأعمدة الظاهرة
          </p>
          <div className="max-h-[340px] space-y-1 overflow-y-auto">
            {columns.map((column) => {
              const checked = visibleColumns.includes(column.key);
              return (
                <label
                  key={column.key}
                  className={`flex items-center justify-between gap-3 rounded-[9px] border border-transparent px-2.5 py-2 text-sm transition focus-within:border-[#D8B87A]/35 focus-within:bg-[#D8B87A]/8 ${
                    column.hideable
                      ? `cursor-pointer hover:bg-white/[0.05] ${
                          checked ? "text-[#F4E7C5]" : "text-white/76"
                        }`
                      : "cursor-not-allowed text-white/38"
                  }`}
                >
                  <span>{column.label}</span>
                  <AdminCheckbox
                    checked={checked}
                    disabled={!column.hideable}
                    onChange={() => toggle(column.key)}
                    label={`${checked ? "إخفاء" : "إظهار"} عمود ${column.label}`}
                  />
                </label>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => persist([...defaultColumns])}
            className="mt-2 w-full cursor-pointer rounded-[9px] border border-white/10 px-3 py-2.5 text-sm font-semibold text-[#D8B87A] transition hover:border-[#D8B87A]/30 hover:bg-[#D8B87A]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70"
          >
            استعادة الأعمدة الافتراضية
          </button>
          {error ? (
            <p role="alert" className="px-2 pt-2 text-xs text-red-200">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

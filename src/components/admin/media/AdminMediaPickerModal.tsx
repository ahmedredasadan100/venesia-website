"use client";

import { useEffect, useId, useRef } from "react";

import MediaLibraryCore from "./MediaLibraryCore";

type AdminMediaPickerModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  onSelectMany?: (paths: string[]) => void;
  initialFolder?: string;
  mode?: "image" | "pdf";
  multiple?: boolean;
  /** Kept for source compatibility. Picker replacement now selects a new asset; it never overwrites this path. */
  replacePath?: string | null;
};

const FOCUSABLE = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export default function AdminMediaPickerModal({
  open,
  onClose,
  onSelect,
  onSelectMany,
  initialFolder,
  mode = "image",
  multiple = false,
}: AdminMediaPickerModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    });
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) window.requestAnimationFrame(() => previousFocus.focus());
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/78 p-2 backdrop-blur-sm sm:p-4" dir="rtl">
      <button type="button" tabIndex={-1} aria-label="إغلاق مكتبة الوسائط" onClick={onClose} className="absolute inset-0" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[94vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-[24px] border border-white/12 bg-[#05070B] shadow-[0_35px_140px_rgba(0,0,0,.7)]"
      >
        <header className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-white">{mode === "pdf" ? "اختيار مستند من المكتبة" : "اختيار صورة من المكتبة"}</h2>
            <p className="mt-1 text-xs text-white/42">التحديد لا يغيّر الحقل. اضغط «تأكيد الاختيار» بعد المراجعة.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/60 hover:text-white">إغلاق</button>
        </header>
        <div className="overflow-y-auto p-3 sm:p-5">
          <MediaLibraryCore
            mode={multiple ? "select-many" : "select-one"}
            initialFolder={initialFolder || (mode === "pdf" ? "files" : "images")}
            initialKind={mode === "pdf" ? "document" : "image"}
            onCancelSelection={onClose}
            onConfirmSelection={(paths) => {
              if (multiple) onSelectMany?.(paths);
              else if (paths[0]) onSelect(paths[0]);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}

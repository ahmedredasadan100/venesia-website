"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

import { useClientMounted } from "../../../hooks/use-client-mounted";
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

function visibleFocusableElements(panel: HTMLElement) {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => {
    const style = window.getComputedStyle(element);
    return (
      element.tabIndex >= 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      element.getClientRects().length > 0
    );
  });
}

export default function AdminMediaPickerModal({
  open,
  onClose,
  onSelect,
  onSelectMany,
  initialFolder,
  mode = "image",
  multiple = false,
}: AdminMediaPickerModalProps) {
  const mounted = useClientMounted();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || !mounted) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.documentElement;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const scrollTop = document.scrollingElement?.scrollTop ?? 0;
    const scrollLeft = document.scrollingElement?.scrollLeft ?? 0;
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      (visibleFocusableElements(panel)[0] ?? panel).focus({ preventScroll: true });
    });
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = visibleFocusableElements(panelRef.current);
      if (!focusable.length) {
        event.preventDefault();
        panelRef.current.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (!panelRef.current.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus({ preventScroll: true });
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      root.style.overflow = previousRootOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.scrollingElement?.scrollTo({ top: scrollTop, left: scrollLeft });
      if (previousFocus?.isConnected) {
        window.requestAnimationFrame(() => previousFocus.focus({ preventScroll: true }));
      }
    };
  }, [mounted, open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex min-w-0 items-center justify-center bg-black/78 p-2 backdrop-blur-sm sm:p-4" dir="rtl" data-media-picker-root>
      <button type="button" tabIndex={-1} aria-label="إغلاق مكتبة الوسائط" onClick={onClose} className="absolute inset-0" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative z-10 flex max-h-[calc(100dvh-1rem)] min-w-0 w-full max-w-[1500px] flex-col overflow-hidden rounded-[24px] border border-white/12 bg-[#05070B] shadow-[0_35px_140px_rgba(0,0,0,.7)] sm:max-h-[calc(100dvh-2rem)]"
      >
        <header className="flex min-w-0 items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-white">{mode === "pdf" ? "اختيار مستند من المكتبة" : "اختيار صورة من المكتبة"}</h2>
            <p className="mt-1 text-xs text-white/42">التحديد لا يغيّر الحقل. اضغط «تأكيد الاختيار» بعد المراجعة.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/60 hover:text-white">إغلاق</button>
        </header>
        <div className="admin-scrollbar min-h-0 min-w-0 max-w-full flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5" data-media-picker-scroll>
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
    </div>,
    document.body,
  );
}

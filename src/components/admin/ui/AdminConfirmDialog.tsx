"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useClientMounted } from "../../../hooks/use-client-mounted";
import { ADMIN_MODAL } from "../../../lib/admin/admin-ui-styles";
import {
  AdminModalCancelButton,
  AdminModalDangerButton,
} from "./AdminModalButtons";

export type AdminConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger";
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export default function AdminConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "إلغاء",
  tone = "danger",
  pending = false,
  onCancel,
  onConfirm,
  returnFocusRef,
}: AdminConfirmDialogProps) {
  const mounted = useClientMounted();
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLElement | null>(null);
  const cancelRef = useRef(onCancel);
  const confirmRef = useRef(onConfirm);
  const pendingRef = useRef(pending);
  const invokingRef = useRef(false);
  const [invoking, setInvoking] = useState(false);
  const busy = pending || invoking;

  useEffect(() => {
    cancelRef.current = onCancel;
    confirmRef.current = onConfirm;
    pendingRef.current = pending;
  }, [onCancel, onConfirm, pending]);

  useEffect(() => {
    if (!open) return;

    const configuredFocusTarget = returnFocusRef?.current ?? null;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLElement>("[data-admin-confirm-cancel]")
        ?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (pendingRef.current || invokingRef.current) return;
        event.preventDefault();
        cancelRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.tabIndex >= 0);
      if (!focusable.length) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      const focusTarget = configuredFocusTarget ?? previouslyFocused;
      if (focusTarget?.isConnected) {
        window.requestAnimationFrame(() => focusTarget.focus());
      }
    };
  }, [open, returnFocusRef]);

  async function handleConfirm() {
    if (pendingRef.current || invokingRef.current) return;
    invokingRef.current = true;
    setInvoking(true);
    try {
      await confirmRef.current();
    } finally {
      invokingRef.current = false;
      setInvoking(false);
    }
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${ADMIN_MODAL.zIndex} flex items-center justify-center px-4 py-6`}
      dir="rtl"
      data-admin-confirm-dialog-root=""
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="إغلاق نافذة التأكيد"
        disabled={busy}
        onClick={() => cancelRef.current()}
        className={ADMIN_MODAL.backdrop}
      />
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={busy || undefined}
        tabIndex={-1}
        data-admin-confirm-dialog=""
        data-tone={tone}
        className={`${ADMIN_MODAL.panel} relative z-10 max-w-[480px] border-red-400/24`}
      >
        <header className="border-b border-white/8 px-6 py-5 text-right">
          <p className="text-xs font-bold text-red-300">إجراء حساس</p>
          <h2 id={titleId} className="mt-2 text-xl font-bold text-white">
            {title}
          </h2>
        </header>
        <p
          id={descriptionId}
          className="px-6 py-5 text-sm leading-7 text-white/62"
        >
          {description}
        </p>
        <footer className={ADMIN_MODAL.footer}>
          <AdminModalCancelButton
            data-admin-confirm-cancel=""
            disabled={busy}
            onClick={() => cancelRef.current()}
            className="disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </AdminModalCancelButton>
          <AdminModalDangerButton
            type="button"
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={handleConfirm}
            className="min-w-[132px] justify-center disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <>
                <span
                  aria-hidden="true"
                  className="me-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                />
                جارٍ التنفيذ…
              </>
            ) : (
              confirmLabel
            )}
          </AdminModalDangerButton>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

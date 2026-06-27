"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

import {
  ADMIN_FORM,
  ADMIN_MODAL,
  ADMIN_MODAL_SIZES,
  adminFormFieldClassName,
  adminFormHintClassName,
  adminFormLabelClassName,
} from "../../lib/admin/admin-ui-styles";
import { AdminModalCancelButton, AdminModalDangerButton, AdminModalPrimaryButton } from "./ui/AdminModalButtons";

export type VenesiaModalSize = keyof typeof ADMIN_MODAL_SIZES;

type VenesiaModalProps = {
  open: boolean;
  title: string;
  description?: string;
  eyebrow?: string;
  size?: VenesiaModalSize;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
};

export default function VenesiaModal({
  open,
  title,
  description,
  eyebrow = "VENESIA CMS",
  size = "md",
  children,
  footer,
  onClose,
}: VenesiaModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${ADMIN_MODAL.zIndex} flex items-center justify-center px-4 py-6`}
      dir="rtl"
    >
      <button
        type="button"
        aria-label="إغلاق النافذة"
        onClick={onClose}
        className={ADMIN_MODAL.backdrop}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="venesia-modal-title"
        className={`${ADMIN_MODAL.panel} ${ADMIN_MODAL_SIZES[size]}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={ADMIN_MODAL.header}>
          <div className="text-right">
            <p className={ADMIN_MODAL.eyebrow}>{eyebrow}</p>
            <h2 id="venesia-modal-title" className={ADMIN_MODAL.title}>
              {title}
            </h2>
            {description ? <p className={ADMIN_MODAL.description}>{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} className={ADMIN_MODAL.closeButton} aria-label="إغلاق">
            ×
          </button>
        </header>

        <div className={ADMIN_MODAL.body}>{children}</div>

        {footer ? <footer className={ADMIN_MODAL.footer}>{footer}</footer> : null}
      </section>
    </div>,
    document.body,
  );
}

export {
  ADMIN_FORM,
  ADMIN_MODAL,
  ADMIN_MODAL_SIZES,
  AdminModalCancelButton,
  AdminModalDangerButton,
  AdminModalPrimaryButton,
  adminFormFieldClassName,
  adminFormHintClassName,
  adminFormLabelClassName,
};

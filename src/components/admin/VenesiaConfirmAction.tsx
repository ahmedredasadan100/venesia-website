"use client";

import { useState, type ReactNode } from "react";

import VenesiaModal, {
  AdminModalCancelButton,
  AdminModalDangerButton,
  AdminModalPrimaryButton,
} from "./VenesiaModal";

type VenesiaConfirmActionProps = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  trigger: ReactNode;
  children: ReactNode;
};

export default function VenesiaConfirmAction({
  title,
  description,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  danger = false,
  trigger,
  children,
}: VenesiaConfirmActionProps) {
  const [open, setOpen] = useState(false);
  const ConfirmButton = danger ? AdminModalDangerButton : AdminModalPrimaryButton;

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <VenesiaModal
        open={open}
        title={title}
        description={description}
        size="sm"
        onClose={() => setOpen(false)}
        footer={
          <>
            <AdminModalCancelButton onClick={() => setOpen(false)}>{cancelLabel}</AdminModalCancelButton>
            <ConfirmButton form="venesia-confirm-form">{confirmLabel}</ConfirmButton>
          </>
        }
      >
        <div className="hidden">{children}</div>
      </VenesiaModal>
    </>
  );
}

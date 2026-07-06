"use client";

import type { ReactNode } from "react";

import VenesiaModal, {
  ADMIN_FORM,
  AdminModalCancelButton,
  AdminModalPrimaryButton,
} from "../VenesiaModal";
import { AdminDataGridActionButton } from "./AdminDataGrid";

type AdminDuplicateResourceModalProps = {
  triggerTitle: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  title: string;
  description: string;
  formId: string;
  formAction: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
};

export default function AdminDuplicateResourceModal({
  triggerTitle,
  open,
  onOpen,
  onClose,
  title,
  description,
  formId,
  formAction,
  children,
}: AdminDuplicateResourceModalProps) {
  return (
    <>
      <AdminDataGridActionButton action="duplicate" size="compact" title={triggerTitle} onClick={onOpen} />

      <VenesiaModal
        open={open}
        title={title}
        description={description}
        size="lg"
        onClose={onClose}
        footer={
          <>
            <AdminModalCancelButton onClick={onClose}>إلغاء</AdminModalCancelButton>
            <AdminModalPrimaryButton type="submit" form={formId}>
              إنشاء النسخة
            </AdminModalPrimaryButton>
          </>
        }
      >
        <form id={formId} action={formAction} className={ADMIN_FORM.gridTwoCol}>
          {children}
        </form>
      </VenesiaModal>
    </>
  );
}

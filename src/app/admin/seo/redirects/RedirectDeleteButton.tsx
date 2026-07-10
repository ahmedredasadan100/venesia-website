"use client";

import { useState, useTransition } from "react";

import {
  AdminDataGridActionButton,
  AdminModalCancelButton,
  AdminModalDangerButton,
  VenesiaModal,
} from "../../../../components/admin/ui";
import type { UrlRedirectRecord } from "../../../../lib/redirects/redirect-types";

import { deleteRedirectAction } from "./actions";

type RedirectDeleteButtonProps = {
  redirect: UrlRedirectRecord;
};

export default function RedirectDeleteButton({ redirect }: RedirectDeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const formData = new FormData();
    formData.set("id", String(redirect.id));
    startTransition(async () => {
      await deleteRedirectAction(formData);
    });
  }

  return (
    <>
      <AdminDataGridActionButton
        action="delete"
        size="compact"
        title="حذف التحويل"
        onClick={() => setOpen(true)}
      />

      <VenesiaModal
        open={open}
        title="تأكيد حذف التحويل"
        description={`هل أنت متأكد من حذف التحويل من ${redirect.source_path}؟ لا يمكن التراجع عن هذا الإجراء.`}
        size="md"
        onClose={() => {
          if (!isPending) setOpen(false);
        }}
        footer={
          <>
            <AdminModalCancelButton onClick={() => setOpen(false)} disabled={isPending}>
              إلغاء
            </AdminModalCancelButton>
            <AdminModalDangerButton onClick={handleDelete} disabled={isPending}>
              {isPending ? "جار الحذف..." : "حذف التحويل"}
            </AdminModalDangerButton>
          </>
        }
      >
        <span className="sr-only">تأكيد حذف التحويل</span>
      </VenesiaModal>
    </>
  );
}

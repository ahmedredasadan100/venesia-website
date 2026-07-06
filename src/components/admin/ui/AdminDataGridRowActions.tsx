"use client";

import type { ReactNode } from "react";

import { AdminDataGridActionButton, AdminDataGridActionsCell } from "./AdminDataGrid";

type RowActionFormConfig = {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Record<string, string | number>;
};

export type AdminDataGridRowActionsProps = {
  edit?: {
    href?: string;
    disabled?: boolean;
    title?: string;
  };
  preview?: {
    href: string;
    title?: string;
  } | null;
  visibility?: RowActionFormConfig & {
    isPublished: boolean;
    title?: string;
  };
  duplicate?: ReactNode;
  delete?: RowActionFormConfig & {
    title?: string;
  };
};

function RowActionForm({
  action,
  hiddenFields,
  children,
}: RowActionFormConfig & { children: ReactNode }) {
  return (
    <form action={action} className="contents">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={String(value)} />
      ))}
      {children}
    </form>
  );
}

export default function AdminDataGridRowActions({
  edit,
  preview,
  visibility,
  duplicate,
  delete: deleteAction,
}: AdminDataGridRowActionsProps) {
  const editTitle = edit?.title ?? "تعديل";

  return (
    <AdminDataGridActionsCell compact>
      {edit?.href && !edit.disabled ? (
        <AdminDataGridActionButton action="edit" href={edit.href} size="compact" title={editTitle} />
      ) : (
        <AdminDataGridActionButton action="edit" size="compact" disabled title={editTitle} />
      )}

      {preview ? (
        <AdminDataGridActionButton
          action="preview"
          href={preview.href}
          target="_blank"
          size="compact"
          title={preview.title ?? "معاينة"}
        />
      ) : null}

      {visibility ? (
        <RowActionForm action={visibility.action} hiddenFields={visibility.hiddenFields}>
          <AdminDataGridActionButton
            type="submit"
            action="visibility"
            size="compact"
            hidden={visibility.isPublished}
            title={visibility.title ?? (visibility.isPublished ? "إخفاء" : "نشر")}
          />
        </RowActionForm>
      ) : null}

      {duplicate}

      {deleteAction ? (
        <RowActionForm action={deleteAction.action} hiddenFields={deleteAction.hiddenFields}>
          <AdminDataGridActionButton
            type="submit"
            action="delete"
            size="compact"
            title={deleteAction.title ?? "حذف آمن"}
          />
        </RowActionForm>
      ) : null}
    </AdminDataGridActionsCell>
  );
}

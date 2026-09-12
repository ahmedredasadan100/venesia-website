"use client";

import { useMemo, type ReactNode } from "react";
import type { AdminActionFeedback } from "../../../lib/admin/admin-action-feedback";

import { statusMeta } from "../../../lib/page-blocks/admin-utils";
import { AdminFeedbackRegion } from "../AdminFeedbackProvider";
import { AdminActionButton, AdminPageContextHeader } from "../ui";

export type BlockEditorContextHeaderProps = {
  backHref: string;
  backLabel: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  status?: string;
  meta?: ReactNode;
  saved?: boolean;
  actions?: ReactNode;
};

export default function BlockEditorContextHeader({
  backHref,
  backLabel,
  eyebrow,
  title,
  description,
  status,
  meta,
  actions,
}: BlockEditorContextHeaderProps) {
  const statusInfo = status ? statusMeta(status) : null;
  return (
    <AdminPageContextHeader
      eyebrow={eyebrow}
      title={title}
      description={description}
      meta={
        meta ?? statusInfo?.label
      }
      actions={
        <>
          {actions}
          <AdminActionButton href={backHref} variant="ghost">
            {backLabel}
          </AdminActionButton>
        </>
      }
    />
  );
}

export function BlockEditorSaveFeedback({ backHref, saved, message = "تم حفظ الموديول بنجاح.", mediaSynchronizationWarning, entityKey, savedRevision }: Pick<BlockEditorContextHeaderProps, "backHref" | "saved"> & {
  message?: string;
  mediaSynchronizationWarning?: boolean;
  entityKey?: string;
  savedRevision?: string;
}) {
  const feedback = useMemo<AdminActionFeedback | null>(() => saved || mediaSynchronizationWarning ? {
    variant: mediaSynchronizationWarning ? "warning" : "success",
    title: mediaSynchronizationWarning ? "تم الحفظ مع تنبيه" : "تم الحفظ",
    message: mediaSynchronizationWarning
      ? "تم حفظ بيانات الموديول، لكن تعذرت مزامنة ارتباطات الميديا. يظل الحذف الآمن متوقفًا حتى اكتمال الإصلاح أو الفحص."
      : message,
    layout: "inline", dismissible: true, lifecycle: "manual",
    dismissSearchParams: ["saved", "notice"],
  } : null, [saved, message, mediaSynchronizationWarning]);
  return (
    <AdminFeedbackRegion
      key={savedRevision}
      channel={entityKey ? `form:${entityKey}` : `block-editor:${backHref}`}
      label="نتيجة حفظ الموديول"
      feedback={feedback}
    />
  );
}

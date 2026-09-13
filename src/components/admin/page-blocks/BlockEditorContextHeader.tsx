"use client";

import { useMemo, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const cacheWarning = searchParams.get("cache_warning") === "1";
  const mediaWarning = mediaSynchronizationWarning || searchParams.get("notice") === "saved_with_media_sync_warning";
  const warning = cacheWarning || mediaWarning;
  const feedback = useMemo<AdminActionFeedback | null>(() => saved || warning ? {
    variant: warning ? "warning" : "success",
    title: warning ? "تم الحفظ مع تنبيه" : "تم الحفظ",
    message: (mediaWarning
      ? "تم حفظ بيانات الموديول، لكن تعذرت مزامنة ارتباطات الميديا. يظل الحذف الآمن متوقفًا حتى اكتمال الإصلاح أو الفحص."
      : message) + (cacheWarning ? " تعذر تحديث الكاش بعد إعادة المحاولة؛ قد تتأخر القراءة العامة." : ""),
    layout: "inline", dismissible: true, lifecycle: "manual",
    dismissSearchParams: ["saved", "notice", "cache_warning"],
  } : null, [saved, message, mediaWarning, cacheWarning, warning]);
  return (
    <AdminFeedbackRegion
      key={savedRevision}
      channel={entityKey ? `form:${entityKey}` : `block-editor:${backHref}`}
      label="نتيجة حفظ الموديول"
      feedback={feedback}
    />
  );
}

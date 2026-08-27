"use client";

import type { ReactNode } from "react";

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

export function BlockEditorSaveFeedback({ backHref, saved }: Pick<BlockEditorContextHeaderProps, "backHref" | "saved">) {
  return (
    <AdminFeedbackRegion
      channel={`block-editor:${backHref}`}
      label="نتيجة حفظ الموديول"
      feedback={
        saved
          ? {
              variant: "success",
              title: "تم الحفظ",
              message: "تم حفظ الموديول بنجاح.",
              layout: "inline",
              dismissible: true,
              lifecycle: "manual",
              dismissSearchParams: ["saved"],
            }
          : null
      }
    />
  );
}

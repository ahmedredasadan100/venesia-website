"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { statusMeta } from "../../../lib/page-blocks/admin-utils";
import { AdminFeedbackRegion } from "../AdminFeedbackProvider";
import { AdminPageContextHeader, AdminStatusPill } from "../ui";

export type BlockEditorContextHeaderProps = {
  backHref: string;
  backLabel: string;
  eyebrow: string;
  title: string;
  description?: string;
  status?: string;
  saved?: boolean;
  slotContext?: string | null;
  actions?: ReactNode;
};

export default function BlockEditorContextHeader({
  backHref,
  backLabel,
  eyebrow,
  title,
  description,
  status,
  slotContext,
  actions,
}: BlockEditorContextHeaderProps) {
  const statusInfo = status ? statusMeta(status) : null;
  return (
    <AdminPageContextHeader
        eyebrow={eyebrow}
        title={title}
        description={
          description || slotContext ? (
            <>
              {description}
              {slotContext ? (
                <span className="mt-2 block text-xs text-white/40">
                  الفتحة المفضلة:{" "}
                  <span className="text-[#D8B87A]/85">{slotContext}</span>
                </span>
              ) : null}
            </>
          ) : undefined
        }
        breadcrumb={
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 transition hover:text-[#D8B87A]"
          >
            <span aria-hidden="true">→</span>
            {backLabel}
          </Link>
        }
        meta={
          statusInfo ? (
            <AdminStatusPill
              tone={
                statusInfo.tone === "green"
                  ? "green"
                  : statusInfo.tone === "gold"
                    ? "gold"
                    : "muted"
              }
            >
              {statusInfo.label}
            </AdminStatusPill>
          ) : undefined
        }
        actions={actions}
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

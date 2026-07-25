"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import {
  DEFAULT_MEDIA_SETTINGS,
  parseMediaSettings,
  saveMediaSettings,
} from "../../../../lib/admin/media-catalog/settings";

export type MediaSettingsActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const MEDIA_SETTINGS_ACTION_INITIAL: MediaSettingsActionState = {
  status: "idle",
  message: "",
};

function megabytes(formData: FormData, key: string, fallback: number) {
  const parsed = Number(formData.get(key));
  return Number.isFinite(parsed) ? Math.round(parsed * 1024 * 1024) : fallback;
}

export async function updateMediaSettingsAction(
  _previous: MediaSettingsActionState,
  formData: FormData,
): Promise<MediaSettingsActionState> {
  try {
    const actor = await requireAdminSession();
    const settings = parseMediaSettings({
      maxImageBytes: megabytes(formData, "maxImageMb", DEFAULT_MEDIA_SETTINGS.maxImageBytes),
      maxDocumentBytes: megabytes(formData, "maxDocumentMb", DEFAULT_MEDIA_SETTINGS.maxDocumentBytes),
      allowedKinds: formData.getAll("allowedKinds").map(String),
      allowedImageExtensions: formData.getAll("allowedImageExtensions").map(String),
      allowedDocumentExtensions: formData.getAll("allowedDocumentExtensions").map(String),
      mimeVerification: formData.get("mimeVerification") === "on",
    });
    await saveMediaSettings(settings);
    await recordCmsAdminAudit(
      {
        action: buildCmsAuditAction("site_settings", "update"),
        entityType: "site_settings",
        entityLabel: "media.settings",
        metadata: {
          maxImageBytes: settings.maxImageBytes,
          maxDocumentBytes: settings.maxDocumentBytes,
          allowedKinds: settings.allowedKinds,
        },
      },
      actor,
    );
    revalidatePath("/admin/settings/media");
    return { status: "success", message: "تم حفظ إعدادات الميديا وتفعيلها داخل مالك الرفع." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "تعذر حفظ إعدادات الميديا.",
    };
  }
}

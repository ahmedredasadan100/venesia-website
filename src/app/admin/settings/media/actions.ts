"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import {
  CMS_IMAGE_EXTENSIONS,
  CMS_PDF_EXTENSIONS,
} from "../../../../lib/admin/media-intelligence/cms-upload-policy";
import {
  MediaSettingsSaveError,
  parseMediaSettings,
  saveMediaSettings,
} from "../../../../lib/admin/media-catalog/settings";
import {
  MEDIA_SETTINGS_LIMITS,
  type MediaSettingsActionState,
  type MediaSettingsField,
} from "./media-settings-action-contract";

type MediaSettingsFieldErrors = NonNullable<MediaSettingsActionState["fieldErrors"]>;

const FIELD_ORDER: MediaSettingsField[] = [
  "maxImageMb",
  "maxDocumentMb",
  "allowedKinds",
  "allowedImageExtensions",
  "allowedDocumentExtensions",
];

function addFieldError(
  fieldErrors: MediaSettingsFieldErrors,
  field: MediaSettingsField,
  message: string,
) {
  fieldErrors[field] = [...(fieldErrors[field] ?? []), message];
}

function parseMegabytes(
  formData: FormData,
  field: "maxImageMb" | "maxDocumentMb",
  label: string,
  maximum: number,
  fieldErrors: MediaSettingsFieldErrors,
) {
  const rawValue = formData.get(field);
  const parsed = typeof rawValue === "string" ? Number(rawValue) : Number.NaN;
  if (
    !Number.isInteger(parsed) ||
    parsed < MEDIA_SETTINGS_LIMITS.minimumMegabytes ||
    parsed > maximum
  ) {
    addFieldError(
      fieldErrors,
      field,
      `${label} يجب أن يكون عددًا صحيحًا بين ${MEDIA_SETTINGS_LIMITS.minimumMegabytes} و${maximum} ميجابايت.`,
    );
    return null;
  }
  return parsed * 1024 * 1024;
}

function stringValues(formData: FormData, field: string) {
  return formData
    .getAll(field)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function validationFailure(
  previous: MediaSettingsActionState,
  fieldErrors: MediaSettingsFieldErrors,
): MediaSettingsActionState {
  const focusTarget = FIELD_ORDER.find((field) => fieldErrors[field]?.length);
  const message = focusTarget ? fieldErrors[focusTarget]?.[0] : undefined;
  return {
    status: "error",
    mode: "edit",
    revision: previous.revision + 1,
    code: "validation_error",
    message: message ?? "تعذر التحقق من إعدادات رفع الملفات.",
    fieldErrors,
    focusTarget,
  };
}

export async function updateMediaSettingsAction(
  previous: MediaSettingsActionState,
  formData: FormData,
): Promise<MediaSettingsActionState> {
  try {
    const actor = await requireAdminSession();
    const fieldErrors: MediaSettingsFieldErrors = {};
    const maxImageBytes = parseMegabytes(
      formData,
      "maxImageMb",
      "أقصى حجم للصورة",
      MEDIA_SETTINGS_LIMITS.maximumImageMegabytes,
      fieldErrors,
    );
    const maxDocumentBytes = parseMegabytes(
      formData,
      "maxDocumentMb",
      "أقصى حجم للمستند",
      MEDIA_SETTINGS_LIMITS.maximumDocumentMegabytes,
      fieldErrors,
    );
    const allowedKinds = stringValues(formData, "allowedKinds");
    const allowedImageExtensions = stringValues(formData, "allowedImageExtensions");
    const allowedDocumentExtensions = stringValues(formData, "allowedDocumentExtensions");

    if (!allowedKinds.length) {
      addFieldError(fieldErrors, "allowedKinds", "اختر الصور أو مستندات PDF على الأقل.");
    } else if (allowedKinds.some((kind) => kind !== "image" && kind !== "document")) {
      addFieldError(fieldErrors, "allowedKinds", "يوجد نوع ملف غير مدعوم ضمن القيم المرسلة.");
    }
    if (allowedKinds.includes("image") && !allowedImageExtensions.length) {
      addFieldError(fieldErrors, "allowedImageExtensions", "اختر امتداد صورة واحدًا على الأقل.");
    } else if (allowedImageExtensions.some((extension) => !CMS_IMAGE_EXTENSIONS.some((supported) => supported === extension))) {
      addFieldError(fieldErrors, "allowedImageExtensions", "يوجد امتداد صورة غير مدعوم ضمن القيم المرسلة.");
    }
    if (allowedKinds.includes("document") && !allowedDocumentExtensions.length) {
      addFieldError(fieldErrors, "allowedDocumentExtensions", "اختر امتداد PDF واحدًا على الأقل.");
    } else if (allowedDocumentExtensions.some((extension) => !CMS_PDF_EXTENSIONS.some((supported) => supported === extension))) {
      addFieldError(fieldErrors, "allowedDocumentExtensions", "يوجد امتداد مستند غير مدعوم ضمن القيم المرسلة.");
    }

    if (Object.keys(fieldErrors).length || maxImageBytes === null || maxDocumentBytes === null) {
      return validationFailure(previous, fieldErrors);
    }

    const settings = parseMediaSettings({
      maxImageBytes,
      maxDocumentBytes,
      allowedKinds,
      allowedImageExtensions,
      allowedDocumentExtensions,
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
    return {
      status: "success",
      mode: "edit",
      revision: previous.revision + 1,
      code: "saved",
      message: "تم حفظ إعدادات رفع الملفات.",
      savedRevision: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof MediaSettingsSaveError) {
      return {
        status: "error",
        mode: "edit",
        revision: previous.revision + 1,
        code: error.reason,
        message: error.message,
      };
    }
    return {
      status: "error",
      mode: "edit",
      revision: previous.revision + 1,
      code: "settings_write_failed",
      message: "تعذر حفظ إعدادات رفع الملفات. لم يتم تسجيل أي تغيير.",
    };
  }
}

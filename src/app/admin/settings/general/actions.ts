"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import { coordinateMediaReferenceEntityMutation } from "../../../../lib/admin/media-catalog/domain-write-coordination";
import {
  getMediaReferenceWriteLeaseUserMessage,
  MediaReferenceWriteLeaseError,
} from "../../../../lib/admin/media-catalog/write-lease";
import { setMaintenanceModeSetting } from "../../../../lib/maintenance/site-settings";
import type { AdminFormActionState } from "../../../../lib/admin/form-runtime";
import {
  parseAdminCompanyIdentity,
  revalidateAdminCompanyConfig,
  saveAdminCompanyConfig,
} from "../../../../lib/admin/shell/company-config";

export type AdminCompanyActionState = AdminFormActionState;

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateAdminCompanyAction(
  previousState: AdminCompanyActionState,
  formData: FormData,
): Promise<AdminCompanyActionState> {
  const revision = previousState.revision + 1;
  let persistedCompanyKey: string | null = null;
  try {
    const adminUser = await requireAdminSession();
    const candidate = {
      key: formString(formData, "key"),
      name: formString(formData, "name"),
      adminLabel: formString(formData, "adminLabel"),
      cmsLabel: formString(formData, "cmsLabel"),
      logoUrl: formString(formData, "logoUrl"),
      compactLogoUrl: formString(formData, "compactLogoUrl"),
      publicWebsiteUrl: formString(formData, "publicWebsiteUrl"),
      accentColor: formString(formData, "accentColor"),
      accentStrongColor: formString(formData, "accentStrongColor"),
      surfaceColor: formString(formData, "surfaceColor"),
    };
    const parsed = parseAdminCompanyIdentity(candidate);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const [field, messages] of Object.entries(
        parsed.error.flatten().fieldErrors,
      )) {
        if (messages?.length) fieldErrors[field] = messages;
      }
      return {
        status: "error",
        mode: "edit",
        revision,
        title: "تعذر حفظ هوية لوحة الإدارة",
        message: "تحقق من الحقول المطلوبة وألوان الهوية بصيغة #RRGGBB.",
        fieldErrors,
        focusTarget: Object.keys(fieldErrors)[0],
      };
    }

    const coordinated = await coordinateMediaReferenceEntityMutation({
      domainKey: "site_settings",
      leaseEntityIdentity: "admin.company",
      intendedRow: { key: "admin.company", value: parsed.data },
      actorId: adminUser.id,
      requestIdentity: `site_settings:admin.company:update:${crypto.randomUUID()}`,
      mutate: () => saveAdminCompanyConfig(parsed.data),
      resolveEntityIdentity: () => "admin.company",
    });
    persistedCompanyKey = parsed.data.key;

    const postCommitWarnings: string[] = [];
    try {
      revalidateAdminCompanyConfig();
    } catch (error) {
      console.error("Admin company cache-tag revalidation failed after commit", error);
      postCommitWarnings.push("تعذر تحديث كاش الهوية فورًا");
    }
    try {
      await recordCmsAdminAudit({
        action: buildCmsAuditAction("site_settings", "update"),
        entityType: "site_settings",
        entityLabel: "admin.company",
        metadata: { companyKey: parsed.data.key },
      });
    } catch (error) {
      console.error("Admin company audit failed after commit", error);
      postCommitWarnings.push("تعذر تسجيل حدث التدقيق");
    }
    try {
      revalidatePath("/admin", "layout");
    } catch (error) {
      console.error("Admin company layout revalidation failed after commit", error);
      postCommitWarnings.push("تعذر تحديث واجهة الإدارة فورًا");
    }

    const mediaSynchronizationWarning =
      coordinated.mediaSynchronization.status ===
      "saved_with_media_sync_warning";
    if (mediaSynchronizationWarning || postCommitWarnings.length > 0) {
      const warningMessages = [
        ...(mediaSynchronizationWarning
          ? [
              "تعذرت مزامنة ارتباطات الميديا، ولذلك يظل الحذف الآمن متوقفًا",
            ]
          : []),
        ...postCommitWarnings,
      ];
      return {
        status: "warning",
        mode: "edit",
        revision,
        title: "تم الحفظ مع تنبيه",
        code:
          mediaSynchronizationWarning && postCommitWarnings.length === 0
            ? "saved_with_media_sync_warning"
            : "saved_with_infrastructure_warning",
        message: `تم حفظ هوية لوحة الإدارة، لكن ${warningMessages.join(" و")}.`,
        savedRevision: `${parsed.data.key}:${revision}`,
      };
    }
    return {
      status: "success",
      mode: "edit",
      revision,
      title: "تم حفظ هوية لوحة الإدارة",
      message: "تم حفظ هوية لوحة الإدارة.",
      code: "updated",
      savedRevision: `${parsed.data.key}:${revision}`,
    };
  } catch (error) {
    if (persistedCompanyKey) {
      console.error("Admin company follow-up failed after commit", error);
      return {
        status: "warning",
        mode: "edit",
        revision,
        title: "تم الحفظ مع تنبيه",
        code: "saved_with_infrastructure_warning",
        message:
          "تم حفظ هوية لوحة الإدارة، لكن تعذر إكمال التحقق اللاحق. حدّث الصفحة قبل إعادة المحاولة.",
        savedRevision: `${persistedCompanyKey}:${revision}`,
      };
    }
    return {
      status: "error",
      mode: "edit",
      revision,
      title: "تعذر حفظ هوية لوحة الإدارة",
      message:
        error instanceof MediaReferenceWriteLeaseError
          ? getMediaReferenceWriteLeaseUserMessage(error.code)
          : error instanceof Error
            ? error.message
            : "تعذر حفظ الهوية.",
    };
  }
}

export async function updateMaintenanceModeAction(enabled: boolean) {
  await requireAdminSession();
  await setMaintenanceModeSetting(enabled);

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("site_settings", "update"),
    entityType: "site_settings",
    entityLabel: "maintenance_mode",
    metadata: { enabled },
  });

  revalidatePath("/");
  revalidatePath("/maintenance");
  revalidatePath("/admin/settings/general");
}

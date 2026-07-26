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
import {
  parseAdminCompanyIdentity,
  revalidateAdminCompanyConfig,
  saveAdminCompanyConfig,
} from "../../../../lib/admin/shell/company-config";

export type AdminCompanyActionState = {
  status: "idle" | "success" | "warning" | "error";
  message: string;
  code?: string;
};

export const ADMIN_COMPANY_ACTION_INITIAL: AdminCompanyActionState = {
  status: "idle",
  message: "",
};

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateAdminCompanyAction(
  _previous: AdminCompanyActionState,
  formData: FormData,
): Promise<AdminCompanyActionState> {
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
      return {
        status: "error",
        message: "تحقق من الحقول المطلوبة وألوان الهوية بصيغة #RRGGBB.",
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
    revalidateAdminCompanyConfig();
    await recordCmsAdminAudit({
      action: buildCmsAuditAction("site_settings", "update"),
      entityType: "site_settings",
      entityLabel: "admin.company",
      metadata: { companyKey: parsed.data.key },
    });
    revalidatePath("/admin", "layout");
    if (coordinated.mediaSynchronization.status === "saved_with_media_sync_warning") {
      return {
        status: "warning",
        code: "saved_with_media_sync_warning",
        message:
          "تم حفظ هوية لوحة الإدارة، لكن تعذرت مزامنة ارتباطات الميديا. يظل الحذف الآمن متوقفًا.",
      };
    }
    return { status: "success", message: "تم حفظ هوية لوحة الإدارة." };
  } catch (error) {
    return {
      status: "error",
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

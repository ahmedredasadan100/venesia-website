"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import { setMaintenanceModeSetting } from "../../../../lib/maintenance/site-settings";
import {
  parseAdminCompanyIdentity,
  saveAdminCompanyConfig,
} from "../../../../lib/admin/shell/company-config";

export type AdminCompanyActionState = {
  status: "idle" | "success" | "error";
  message: string;
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
    await requireAdminSession();
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

    await saveAdminCompanyConfig(parsed.data);
    await recordCmsAdminAudit({
      action: buildCmsAuditAction("site_settings", "update"),
      entityType: "site_settings",
      entityLabel: "admin.company",
      metadata: { companyKey: parsed.data.key },
    });
    revalidatePath("/admin", "layout");
    return { status: "success", message: "تم حفظ هوية لوحة الإدارة." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "تعذر حفظ الهوية.",
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

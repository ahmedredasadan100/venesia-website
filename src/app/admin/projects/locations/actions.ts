"use server";

import { revalidatePath } from "next/cache";

import {
  adminActionFailure,
  adminActionSuccess,
  type AdminActionResult,
} from "../../../../lib/admin/admin-action-result";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import type { AdminFormActionState } from "../../../../lib/admin/form-runtime";
import {
  PROJECT_LOCATION_LEVEL_CONFIG,
  PROJECT_LOCATION_LEVELS,
  projectLocationManagementPath,
  type ProjectLocationLevel,
  type ProjectLocationManagementRow,
} from "../../../../lib/admin/projects/location-management-contract";
import { loadProjectLocationManagementRow } from "../../../../lib/admin/projects/location-management-adapter";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export type ProjectLocationFormActionState =
  AdminFormActionState<ProjectLocationManagementRow>;

type DatabaseErrorLike = { code?: string; message?: string };

function getText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseLevel(value: string): ProjectLocationLevel | null {
  return PROJECT_LOCATION_LEVELS.includes(value as ProjectLocationLevel)
    ? (value as ProjectLocationLevel)
    : null;
}

function parsePositiveId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function parseNonNegativeOrder(value: string) {
  const order = Number(value);
  return Number.isSafeInteger(order) && order >= 0 ? order : null;
}

function parseActive(formData: FormData) {
  return formData.get("is_active") === "on";
}

function revalidateLocationDomain() {
  revalidatePath("/admin/projects/locations", "layout");
  revalidatePath("/admin/projects/new", "page");
  revalidatePath("/admin/projects/[id]", "page");
}

function formFailure(
  mode: "create" | "edit",
  revision: number,
  message: string,
  field?: string,
): ProjectLocationFormActionState {
  return {
    status: "error",
    mode,
    revision,
    title: "تعذر حفظ الموقع",
    message,
    ...(field
      ? { fieldErrors: { [field]: [message] }, focusTarget: field }
      : {}),
  };
}

function mapDatabaseError(
  mode: "create" | "edit",
  revision: number,
  error: unknown,
) {
  const databaseError =
    error && typeof error === "object" ? (error as DatabaseErrorLike) : {};
  if (databaseError.code === "23505") {
    return formFailure(
      mode,
      revision,
      "يوجد موقع بالاسم العربي نفسه داخل هذا المستوى والأب.",
      "name_ar",
    );
  }
  if (databaseError.code === "23503" || databaseError.code === "23514") {
    return formFailure(
      mode,
      revision,
      databaseError.message ?? "علاقة الموقع غير صالحة.",
      "parent_id",
    );
  }
  return formFailure(
    mode,
    revision,
    databaseError.message ?? "تعذر حفظ بيانات الموقع.",
  );
}

async function mutateLocation(
  action: "create" | "update" | "delete",
  locationId: number | null,
  payload: Record<string, unknown>,
) {
  const { data, error } = await getSupabaseAdmin().rpc(
    "mutate_project_location",
    {
      p_action: action,
      p_location_id: locationId,
      p_payload: payload,
    },
  );
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    throw new Error("Location command returned no canonical row.");
  }
  return row as Record<string, unknown>;
}

function readLocationPayload(formData: FormData) {
  const level = parseLevel(getText(formData, "level"));
  const nameAr = getText(formData, "name_ar");
  const nameEn = getText(formData, "name_en");
  const sortOrder = parseNonNegativeOrder(getText(formData, "sort_order"));
  const parentText = getText(formData, "parent_id");
  const parentId = parentText ? parsePositiveId(parentText) : null;

  if (!level) return { error: ["level", "نوع الموقع غير صالح."] as const };
  if (!nameAr) return { error: ["name_ar", "اسم الموقع بالعربية مطلوب."] as const };
  if (sortOrder === null) {
    return { error: ["sort_order", "الترتيب يجب أن يكون رقمًا صحيحًا غير سالب."] as const };
  }
  const parentLevel = PROJECT_LOCATION_LEVEL_CONFIG[level].parentLevel;
  if (parentLevel && parentId === null) {
    return { error: ["parent_id", "اختر العنصر الأب الصحيح."] as const };
  }
  if (!parentLevel && parentId !== null) {
    return { error: ["parent_id", "المحافظة لا تقبل عنصرًا أبًا."] as const };
  }

  return {
    level,
    payload: {
      level,
      parent_id: parentId,
      name_ar: nameAr,
      name_en: nameEn || null,
      sort_order: sortOrder,
      is_active: parseActive(formData),
    },
  };
}

async function saveProjectLocation(
  mode: "create" | "edit",
  previousState: ProjectLocationFormActionState,
  formData: FormData,
): Promise<ProjectLocationFormActionState> {
  const revision = previousState.revision + 1;
  const actor = await requireAdminSession();
  const parsed = readLocationPayload(formData);
  if (parsed.error) {
    return formFailure(mode, revision, parsed.error[1], parsed.error[0]);
  }
  const id = mode === "edit" ? parsePositiveId(getText(formData, "id")) : null;
  if (mode === "edit" && !id) {
    return formFailure(mode, revision, "معرّف الموقع غير صالح.");
  }

  try {
    const raw = await mutateLocation(
      mode === "create" ? "create" : "update",
      id,
      parsed.payload,
    );
    const savedId = Number(raw.id);
    const saved = await loadProjectLocationManagementRow(
      savedId,
      parsed.level,
    );
    if (!saved) throw new Error("تعذر إعادة قراءة الموقع بعد الحفظ.");

    await recordCmsAdminAudit(
      {
        action: buildCmsAuditAction(
          "project_location",
          mode === "create" ? "create" : "update",
        ),
        entityType: "project_location",
        entityId: saved.id,
        entityLabel: saved.name_ar,
        metadata: {
          level: saved.level,
          parent_id: saved.parent_id,
          sort_order: saved.sort_order,
          is_active: saved.is_active,
        },
      },
      actor,
    );
    revalidateLocationDomain();
    return {
      status: "success",
      mode,
      revision,
      title: "تم حفظ الموقع",
      message:
        mode === "create"
          ? "تم إنشاء الموقع داخل التسلسل المعتمد."
          : "تم تحديث بيانات الموقع.",
      code: mode === "create" ? "created" : "saved",
      entityId: saved.id,
      savedRevision: `${saved.id}:${saved.updated_at}`,
      result: saved,
    };
  } catch (error) {
    return mapDatabaseError(mode, revision, error);
  }
}

export async function createProjectLocationAction(
  previousState: ProjectLocationFormActionState,
  formData: FormData,
) {
  return saveProjectLocation("create", previousState, formData);
}

export async function updateProjectLocationAction(
  previousState: ProjectLocationFormActionState,
  formData: FormData,
) {
  return saveProjectLocation("edit", previousState, formData);
}

export async function setProjectLocationActiveAction(
  id: number,
  level: ProjectLocationLevel,
  isActive: boolean,
) {
  const actor = await requireAdminSession();
  if (!Number.isSafeInteger(id) || id <= 0 || !PROJECT_LOCATION_LEVELS.includes(level)) {
    return adminActionFailure("تعذر تحديث الحالة", "معرّف الموقع غير صالح.");
  }
  try {
    await mutateLocation("update", id, { level, is_active: isActive });
    const saved = await loadProjectLocationManagementRow(id, level);
    if (!saved) throw new Error("الموقع غير موجود.");
    await recordCmsAdminAudit(
      {
        action: buildCmsAuditAction(
          "project_location",
          isActive ? "publish" : "unpublish",
        ),
        entityType: "project_location",
        entityId: id,
        entityLabel: saved.name_ar,
        metadata: { level, is_active: saved.is_active },
      },
      actor,
    );
    revalidateLocationDomain();
    return {
      ...adminActionSuccess(
        isActive ? "تم تفعيل الموقع" : "تم تعطيل الموقع",
        isActive
          ? "أصبح الموقع متاحًا للاختيار في المشاريع."
          : "تم تعطيل الموقع ولن يظهر للاختيار الجديد.",
        { code: isActive ? "published" : "unpublished", entityId: id },
      ),
      location: saved,
    };
  } catch (error) {
    const databaseError = error as DatabaseErrorLike;
    return adminActionFailure(
      "تعذر تحديث حالة الموقع",
      databaseError.message ?? "تعذر تحديث حالة الموقع.",
      { entityId: id },
    );
  }
}

export async function deleteProjectLocationAction(
  id: number,
  level: ProjectLocationLevel,
): Promise<AdminActionResult> {
  const actor = await requireAdminSession();
  if (!Number.isSafeInteger(id) || id <= 0 || !PROJECT_LOCATION_LEVELS.includes(level)) {
    return adminActionFailure("تعذر حذف الموقع", "معرّف الموقع غير صالح.");
  }
  try {
    const existing = await loadProjectLocationManagementRow(id, level);
    if (!existing) {
      return adminActionFailure("تعذر حذف الموقع", "الموقع غير موجود.", {
        entityId: id,
      });
    }
    await mutateLocation("delete", id, {});
    await recordCmsAdminAudit(
      {
        action: buildCmsAuditAction("project_location", "delete"),
        entityType: "project_location",
        entityId: id,
        entityLabel: existing.name_ar,
        metadata: { level, parent_id: existing.parent_id },
      },
      actor,
    );
    revalidateLocationDomain();
    return adminActionSuccess(
      "تم حذف الموقع",
      "تم حذف الموقع غير المرتبط من التسلسل المعتمد.",
      { code: "deleted", entityId: id },
    );
  } catch (error) {
    const databaseError = error as DatabaseErrorLike;
    const message =
      databaseError.code === "23503"
        ? databaseError.message?.includes("child")
          ? "لا يمكن حذف الموقع لأنه يحتوي عناصر فرعية."
          : "لا يمكن حذف الموقع لأنه مرتبط بمشروعات."
        : databaseError.message ?? "تعذر حذف الموقع.";
    return adminActionFailure("تعذر حذف الموقع", message, { entityId: id });
  }
}

export function projectLocationLevelPath(level: ProjectLocationLevel) {
  return projectLocationManagementPath(level);
}

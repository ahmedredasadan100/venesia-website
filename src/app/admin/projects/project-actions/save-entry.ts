"use server";

import { revalidatePath } from "next/cache";

import type {
  AdminFormActionState,
  AdminFormMode,
} from "../../../../lib/admin/form-runtime";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import {
  getMediaReferenceWriteLeaseUserMessage,
  MediaReferenceWriteLeaseError,
} from "../../../../lib/admin/media-catalog/write-lease";
import {
  projectEntryFirstErrorTarget,
  projectEntryPayloadFromFormData,
  validateProjectEntryPayload,
  type ProjectEntryBundle,
  type ProjectEntryFieldErrors,
} from "../../../../lib/admin/projects/project-entry-contract";
import { loadProjectEntry } from "../../../../lib/admin/projects/project-entry-data";
import { coordinateProjectEntrySave } from "../../../../lib/admin/projects/project-entry-media-coordination";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export type ProjectEntrySaveResult = {
  mediaSynchronizationStatus: "synced" | "warning";
  reconciledBundle: ProjectEntryBundle | null;
};

function failure(
  mode: AdminFormMode,
  revision: number,
  message: string,
  fieldErrors?: ProjectEntryFieldErrors,
  code = "project_entry_save_failed",
): AdminFormActionState<ProjectEntrySaveResult> {
  const target = fieldErrors ? projectEntryFirstErrorTarget(fieldErrors) : null;
  return {
    status: "error",
    mode,
    revision,
    title: "تعذر حفظ المشروع",
    message,
    code,
    ...(fieldErrors ? { fieldErrors } : {}),
    ...(target ?? {}),
  };
}

function safeProjectId(formData: FormData) {
  const raw = formData.get("id");
  if (typeof raw !== "string" || !raw.trim()) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : Number.NaN;
}

function databaseFailure(
  mode: AdminFormMode,
  revision: number,
  error: { message?: string; code?: string; details?: string } | null,
) {
  const code = error?.code ?? "project_entry_rpc_failed";
  const text = [error?.message, error?.details].filter(Boolean).join(" ");
  if (
    code === "23505" &&
    /slug|projects_slug/i.test(text)
  ) {
    return failure(
      mode,
      revision,
      "هذا الرابط مستخدم بالفعل في مشروع آخر.",
      { slug: ["اختر Slug مختلفًا."] },
      "project_slug_conflict",
    );
  }
  if (/Project type is immutable/i.test(text)) {
    return failure(
      mode,
      revision,
      "نوع المشروع ثابت بعد الإنشاء.",
      { type: ["لا يمكن نقل مشروع قائم بين Residential وCommercial من نموذج التعديل."] },
      "project_type_immutable",
    );
  }
  if (/location hierarchy/i.test(text)) {
    return failure(
      mode,
      revision,
      "اختيارات الموقع لم تعد مترابطة. أعد اختيار التسلسل الجغرافي.",
      { governorate_id: ["اختر المحافظة ثم المدينة ثم المنطقة الرئيسية بالترتيب."] },
      "project_location_hierarchy_invalid",
    );
  }
  return failure(
    mode,
    revision,
    text || "تعذر تنفيذ عقد الحفظ الذري. لم يتم اعتماد حفظ جزئي.",
    undefined,
    code,
  );
}

export async function saveProjectEntry(
  previousState: AdminFormActionState<ProjectEntrySaveResult>,
  formData: FormData,
): Promise<AdminFormActionState<ProjectEntrySaveResult>> {
  const actor = await requireAdminSession();
  const projectId = safeProjectId(formData);
  const mode: AdminFormMode = projectId === null ? "create" : "edit";
  const revision = previousState.revision + 1;

  if (Number.isNaN(projectId)) {
    return failure(mode, revision, "معرّف المشروع غير صالح.");
  }

  const payload = projectEntryPayloadFromFormData(formData);
  const fieldErrors = validateProjectEntryPayload(payload);
  if (Object.keys(fieldErrors).length) {
    return failure(
      mode,
      revision,
      "راجع الحقول الموضحة. احتفظ النموذج بكل القيم غير المحفوظة.",
      fieldErrors,
      "project_entry_validation_failed",
    );
  }

  if (mode === "edit" && payload.project.id !== projectId) {
    return failure(mode, revision, "تعارض معرّف المشروع داخل النموذج.");
  }

  try {
    const coordinated = await coordinateProjectEntrySave({
      actorId: actor.id,
      projectId,
      payload,
      mutate: async () => {
        const { data, error } = await getSupabaseAdmin().rpc(
          "save_project_admin_entry",
          {
            p_project_id: projectId,
            p_payload: payload,
          },
        );
        if (error) {
          throw Object.assign(new Error(error.message), {
            code: error.code,
            details: error.details,
          });
        }
        const row = Array.isArray(data) ? data[0] : data;
        const savedId = Number(row?.project_id);
        const slug = String(row?.slug ?? payload.project.slug);
        const updatedAt = String(row?.updated_at ?? new Date().toISOString());
        if (!Number.isSafeInteger(savedId) || savedId <= 0) {
          throw new Error("project_entry_rpc_identity_missing");
        }
        return { id: savedId, slug, updatedAt };
      },
    });

    const saved = coordinated.value;
    const mediaWarning =
      coordinated.mediaSynchronization.status === "saved_with_media_sync_warning";
    let reconciledBundle: ProjectEntryBundle | null = null;

    if (mode === "edit") {
      try {
        reconciledBundle = await loadProjectEntry(saved.id);
      } catch (reconciliationError) {
        console.error("Project entry post-save reconciliation read failed", {
          projectId: saved.id,
          error: reconciliationError,
        });
      }
    }
    const reconciliationWarning = mode === "edit" && !reconciledBundle;
    const savedWithWarning = mediaWarning || reconciliationWarning;

    revalidatePath(`/admin/projects/${saved.id}`);
    revalidatePath("/admin/projects/residential");
    revalidatePath("/admin/projects/commercial");

    await recordCmsAdminAudit(
      {
        action: buildCmsAuditAction("project", mode === "create" ? "create" : "update"),
        entityType: "project",
        entityId: saved.id,
        entityLabel: payload.project.arabic_name,
        metadata: {
          slug: saved.slug,
          type: payload.project.type,
          aggregateContract: "project_admin_entry_v2",
          mediaSynchronization: coordinated.mediaSynchronization.status,
        },
      },
      actor,
    );

    return {
      status: savedWithWarning ? "warning" : "success",
      mode,
      revision,
      title: reconciliationWarning
        ? "تم حفظ المشروع — يلزم تحديث المحرر"
        : mediaWarning
          ? "تم حفظ المشروع مع تنبيه للميديا"
          : "تم حفظ المشروع",
      message: reconciliationWarning
        ? "حُفظ المشروع وكل عناصره، لكن تعذرت إعادة قراءة عقد التعديل بأمان. سيُعاد تحميل المحرر قبل السماح بحفظ آخر."
        : mediaWarning
          ? "حُفظ Project Aggregate ذريًا، لكن تعذر إثبات اكتمال مزامنة مراجع الميديا. يظل الحذف الآمن متوقفًا حتى reconciliation."
          : "حُفظ أصل المشروع وكل العناصر التابعة كوحدة واحدة.",
      code: reconciliationWarning
        ? "saved_requires_reconciliation_reload"
        : mediaWarning
          ? "saved_with_media_sync_warning"
          : "saved",
      entityId: saved.id,
      ...(mode === "create" ? { editHref: `/admin/projects/${saved.id}` } : {}),
      savedRevision: `${saved.id}:${saved.updatedAt}`,
      result: {
        mediaSynchronizationStatus: mediaWarning ? "warning" : "synced",
        reconciledBundle,
      },
    };
  } catch (error) {
    if (error instanceof MediaReferenceWriteLeaseError) {
      const message = getMediaReferenceWriteLeaseUserMessage(error.code);
      return failure(
        mode,
        revision,
        message,
        { image: [message] },
        error.code,
      );
    }
    const normalized = error instanceof Error
      ? {
          message: error.message,
          code: "code" in error ? String(error.code ?? "") : undefined,
          details: "details" in error ? String(error.details ?? "") : undefined,
        }
      : null;
    return databaseFailure(mode, revision, normalized);
  }
}

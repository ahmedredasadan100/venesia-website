"use server";

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
  assessProjectEntryPayload,
  projectEntryFirstErrorTarget,
  projectEntryPayloadFromFormData,
  type ProjectEntryBundle,
  type ProjectEntryFieldErrors,
} from "../../../../lib/admin/projects/project-entry-contract";
import { loadProjectEntry } from "../../../../lib/admin/projects/project-entry-data";
import { coordinateProjectEntrySave } from "../../../../lib/admin/projects/project-entry-media-coordination";
import {
  getProjectPublishingReadiness,
  resolveProjectPublicationAuditOperation,
  type ProjectPublicationStatus,
} from "../../../../lib/admin/projects/project-publishing-capability";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { revalidateProjectPaths } from "./revalidate";

export type ProjectEntrySaveResult = {
  mediaSynchronizationStatus: "synced" | "warning";
  reconciledBundle: ProjectEntryBundle | null;
  publicationStatus: ProjectPublicationStatus;
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
  if (/PROJECT_PUBLISH_BLOCKED|PROJECT_PUBLICATION_ACTOR_REQUIRED/i.test(text)) {
    return failure(
      mode,
      revision,
      "تعذر نشر المشروع لأن بيانات العرض العام غير مكتملة. راجع قائمة الجاهزية.",
      { publication_status: ["راجع متطلبات النشر وأصلح الحقول المشار إليها."] },
      "project_publish_validation_failed",
    );
  }
  if (/PROJECT_PUBLICATION_STATE_CONFLICT/i.test(text)) {
    return failure(
      mode,
      revision,
      "تغيرت حالة نشر المشروع أثناء التحرير. أعد تحميل المحرر ثم حاول مرة أخرى.",
      undefined,
      "project_publication_state_conflict",
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
  const validation = assessProjectEntryPayload(payload);
  const fieldErrors = validation.fieldErrors;
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

  const publishingReadiness = getProjectPublishingReadiness({
    validationChecks: validation.checks,
    seoTitle: payload.project.seo_title,
    seoDescription: payload.project.seo_description,
  });
  if (
    payload.project.publication_status === "published" &&
    !publishingReadiness.ready
  ) {
    return failure(
      mode,
      revision,
      "أكمل متطلبات العرض العام قبل نشر المشروع.",
      fieldErrors,
      "project_publish_validation_failed",
    );
  }

  try {
    let previousPublicationStatus: ProjectPublicationStatus | null = null;
    let previousPublishedAt: string | null = null;
    let previousSlug: string | null = null;
    if (mode === "edit" && projectId) {
      const { data: current, error: currentError } = await getSupabaseAdmin()
        .from("projects")
        .select("publication_status,published_at,slug")
        .eq("id", projectId)
        .maybeSingle<{
          publication_status: ProjectPublicationStatus;
          published_at: string | null;
          slug: string;
        }>();
      if (currentError || !current) {
        return databaseFailure(mode, revision, currentError);
      }
      previousPublicationStatus = current.publication_status;
      previousPublishedAt = current.published_at;
      previousSlug = current.slug;
    }

    const requestedPublicationStatus = payload.project.publication_status;
    const trustedPayload = {
      ...payload,
      project: {
        ...payload.project,
        publication_status: requestedPublicationStatus,
      },
      publication_actor_id: actor.id,
      publication_previous_status: previousPublicationStatus,
    };
    const coordinated = await coordinateProjectEntrySave({
      actorId: actor.id,
      projectId,
      payload: trustedPayload,
      mutate: async () => {
        const { data, error } = await getSupabaseAdmin().rpc(
          "save_project_admin_entry",
          {
            p_project_id: projectId,
            p_payload: trustedPayload,
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
    const nextPublicationStatus =
      reconciledBundle?.project.publication_status ??
      trustedPayload.project.publication_status;
    const auditOperation = resolveProjectPublicationAuditOperation({
      mode,
      previousStatus: previousPublicationStatus,
      nextStatus: nextPublicationStatus,
    });
    const firstPublishedAt =
      reconciledBundle?.project.published_at ??
      previousPublishedAt ??
      (nextPublicationStatus === "published" ? saved.updatedAt : null);

    revalidateProjectPaths(
      payload.project.type,
      saved.id,
      saved.slug,
      previousSlug,
    );

    await recordCmsAdminAudit(
      {
        action: buildCmsAuditAction("project", auditOperation),
        entityType: "project",
        entityId: saved.id,
        entityLabel: payload.project.arabic_name,
        metadata: {
          slug: saved.slug,
          type: payload.project.type,
          aggregateContract: "project_admin_entry_v2",
          mediaSynchronization: coordinated.mediaSynchronization.status,
          previousPublicationStatus,
          nextPublicationStatus,
          firstPublishedAt,
          featured: payload.project.featured,
          mutationSource: "form_save",
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
          : nextPublicationStatus === "published"
            ? "تم حفظ المشروع ونشره"
            : nextPublicationStatus === "unpublished"
              ? "تم حفظ المشروع وإخفاؤه"
              : mode === "create"
                ? "تم إنشاء المشروع كغير منشور"
                : "تم حفظ المشروع",
      message: reconciliationWarning
        ? "حُفظ المشروع وكل عناصره، لكن تعذرت إعادة قراءة عقد التعديل بأمان. سيُعاد تحميل المحرر قبل السماح بحفظ آخر."
        : mediaWarning
          ? "حُفظ Project Aggregate ذريًا، لكن تعذر إثبات اكتمال مزامنة مراجع الميديا. يظل الحذف الآمن متوقفًا حتى reconciliation."
          : nextPublicationStatus === "published"
            ? "حُفظ Project Aggregate وأصبح المشروع ظاهرًا للعامة."
            : nextPublicationStatus === "unpublished"
              ? "حُفظ المشروع وأُخفي عن العرض العام مع الاحتفاظ بتاريخ أول نشر."
              : "حُفظ أصل المشروع وكل العناصر التابعة كغير منشورة ضمن عملية ذرية واحدة.",
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
        publicationStatus: nextPublicationStatus,
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

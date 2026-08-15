"use server";

import { z } from "zod";

import { adminActionFailure } from "../../../../lib/admin/admin-action-result";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import {
  assessProjectEntryPayload,
  projectEntryFirstErrorTarget,
} from "../../../../lib/admin/projects/project-entry-contract";
import { loadProjectEntry } from "../../../../lib/admin/projects/project-entry-data";
import {
  getProjectPublishingReadiness,
  type ProjectPublicationStatus,
} from "../../../../lib/admin/projects/project-publishing-capability";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { revalidateProjectPaths } from "./revalidate";

const commandSchema = z.object({
  id: z.number().int().positive(),
  visible: z.boolean(),
});

const resultSchema = z.object({
  project_id: z.coerce.number().int().positive(),
  project_type: z.enum(["residential", "commercial"]),
  project_slug: z.string().min(1),
  publication_status: z.enum(["published", "unpublished"]),
  published_at: z.string().nullable(),
  published_by: z.coerce.number().int().positive().nullable(),
  featured: z.boolean(),
  updated_at: z.string().min(1),
});

function publicationFailure(
  title: string,
  message: string,
  options: Parameters<typeof adminActionFailure>[2] = {},
) {
  const failure = adminActionFailure(title, message, options);
  return {
    ...failure,
    ok: false as const,
    code: failure.code ?? "project_publication_failed",
  };
}

export async function setProjectPublicationAjax(
  id: number,
  visible: boolean,
) {
  const actor = await requireAdminSession();
  const command = commandSchema.safeParse({ id, visible });
  if (!command.success) {
    return publicationFailure(
      "تعذر تحديث ظهور المشروع",
      "بيانات أمر النشر غير صالحة.",
      {},
    );
  }

  let bundle;
  try {
    bundle = await loadProjectEntry(command.data.id);
  } catch (error) {
    return publicationFailure(
      "تعذر التحقق من جاهزية المشروع",
      error instanceof Error ? error.message : "تعذر تحميل Project Aggregate.",
      { entityId: command.data.id },
    );
  }
  if (!bundle) {
    return publicationFailure(
      "المشروع غير موجود",
      "حدّث القائمة ثم حاول مرة أخرى.",
      { entityId: command.data.id },
    );
  }

  const previousStatus = bundle.project
    .publication_status as ProjectPublicationStatus;
  if (command.data.visible) {
    const validation = assessProjectEntryPayload(bundle);
    const fieldErrors = validation.fieldErrors;
    const readiness = getProjectPublishingReadiness({
      validationChecks: validation.checks,
      seoTitle: bundle.project.seo_title,
      seoDescription: bundle.project.seo_description,
    });
    if (!readiness.ready) {
      const firstTarget = projectEntryFirstErrorTarget(fieldErrors);
      return publicationFailure(
        "تعذر نشر المشروع",
        readiness.blockers[0]?.message ?? "بيانات العرض العام غير مكتملة.",
        {
          code: "publish_validation",
          entityId: command.data.id,
          focusTarget: firstTarget?.focusTarget,
        },
      );
    }
  }

  const { data, error } = await getSupabaseAdmin().rpc(
    "set_project_publication_admin_entry",
    {
      p_project_id: command.data.id,
      p_visible: command.data.visible,
      p_actor_id: actor.id,
    },
  );
  if (error) {
    return publicationFailure(
      command.data.visible ? "تعذر نشر المشروع" : "تعذر إخفاء المشروع",
      /PROJECT_PUBLISH_BLOCKED/.test(error.message)
        ? "بيانات العرض العام غير مكتملة. افتح المحرر وراجع قائمة الجاهزية."
        : error.message,
      {
        code: /PROJECT_PUBLISH_BLOCKED/.test(error.message)
          ? "publish_validation"
          : undefined,
        entityId: command.data.id,
      },
    );
  }

  const parsed = resultSchema.safeParse(data?.[0]);
  if (!parsed.success) {
    return publicationFailure(
      "تعذر إثبات حالة النشر النهائية",
      "حُفظ الأمر دون نتيجة موثوقة. حدّث القائمة قبل أي محاولة جديدة.",
      { entityId: command.data.id },
    );
  }

  const result = parsed.data;
  const changed = previousStatus !== result.publication_status;
  if (changed) {
    await recordCmsAdminAudit(
      {
        action: buildCmsAuditAction(
          "project",
          result.publication_status === "published" ? "publish" : "unpublish",
        ),
        entityType: "project",
        entityId: result.project_id,
        entityLabel: bundle.project.arabic_name,
        metadata: {
          previousPublicationStatus: previousStatus,
          nextPublicationStatus: result.publication_status,
          firstPublishedAt: result.published_at,
          featured: result.featured,
          aggregateContract: "project_admin_entry_v2",
          mutationSource: "row_action",
        },
      },
      actor,
    );
  }

  try {
    revalidateProjectPaths(
      result.project_type,
      result.project_id,
      result.project_slug,
    );
  } catch (revalidationError) {
    console.error("Project publication cache revalidation failed", {
      projectId: result.project_id,
      error: revalidationError,
    });
    return {
      ok: true as const,
      feedbackStatus: "warning" as const,
      code: result.publication_status === "published" ? "published" : "unpublished",
      message:
        "تم حفظ حالة النشر، لكن تعذر تحديث بعض القراءات المخبأة فورًا.",
      projectId: result.project_id,
      ...result,
    };
  }

  return {
    ok: true as const,
    feedbackStatus: "success" as const,
    code: result.publication_status === "published" ? "published" : "unpublished",
    message:
      result.publication_status === "published"
        ? "أصبح المشروع ظاهرًا في قنوات المشاريع العامة."
        : "أصبح المشروع غير منشور مع الاحتفاظ بتاريخ أول نشر.",
    projectId: result.project_id,
    ...result,
  };
}

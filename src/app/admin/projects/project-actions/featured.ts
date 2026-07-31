"use server";

import { z } from "zod";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { revalidateProjectPaths } from "./revalidate";

const featuredCommandSchema = z.object({
  id: z.number().int().positive(),
  featured: z.boolean(),
});

const featuredResultSchema = z.object({
  project_id: z.coerce.number().int().positive(),
  project_type: z.enum(["residential", "commercial"]),
  project_slug: z.string().min(1),
  featured: z.boolean(),
  updated_at: z.string().min(1),
});

export async function setProjectFeaturedAjax(
  id: number,
  featured: boolean,
) {
  const actor = await requireAdminSession();
  const command = featuredCommandSchema.safeParse({ id, featured });
  if (!command.success) {
    return {
      ok: false as const,
      code: "invalid_project_featured_command",
      message: "بيانات تمييز المشروع غير صالحة.",
    };
  }

  const { data, error } = await getSupabaseAdmin().rpc(
    "set_project_featured_admin_entry",
    {
      p_project_id: command.data.id,
      p_featured: command.data.featured,
    },
  );
  if (error) {
    return {
      ok: false as const,
      code: error.code === "P0002" ? "project_not_found" : "project_featured_failed",
      message:
        error.code === "P0002"
          ? "المشروع غير موجود."
          : "تعذر تحديث تمييز المشروع. لم تتغير القيمة المحفوظة.",
    };
  }

  const parsed = featuredResultSchema.safeParse(Array.isArray(data) ? data[0] : data);
  if (!parsed.success) {
    return {
      ok: false as const,
      code: "project_featured_result_invalid",
      message: "حُفظت العملية لكن تعذر إثبات القيمة النهائية. حدّث القائمة قبل المحاولة مرة أخرى.",
    };
  }

  await recordCmsAdminAudit(
    {
      action: buildCmsAuditAction("project", "update"),
      entityType: "project",
      entityId: parsed.data.project_id,
      metadata: {
        featured: parsed.data.featured,
        slug: parsed.data.project_slug,
        source: "project_row_actions",
      },
    },
    actor,
  );

  try {
    revalidateProjectPaths(
      parsed.data.project_type,
      parsed.data.project_id,
      parsed.data.project_slug,
    );
  } catch (revalidationError) {
    console.error("Project featured cache revalidation failed", {
      projectId: parsed.data.project_id,
      error: revalidationError,
    });
    return {
      ok: true as const,
      feedbackStatus: "warning" as const,
      code: parsed.data.featured ? "featured" : "unfeatured",
      message: "تم حفظ قيمة التمييز، لكن تعذر تحديث بعض القراءات المخبأة فورًا.",
      projectId: parsed.data.project_id,
      featured: parsed.data.featured,
      updatedAt: parsed.data.updated_at,
    };
  }

  return {
    ok: true as const,
    feedbackStatus: "success" as const,
    code: parsed.data.featured ? "featured" : "unfeatured",
    message: parsed.data.featured
      ? "تم تمييز المشروع وتحديث مصادر العرض العامة."
      : "تم إلغاء تمييز المشروع وتحديث مصادر العرض العامة.",
    projectId: parsed.data.project_id,
    featured: parsed.data.featured,
    updatedAt: parsed.data.updated_at,
  };
}

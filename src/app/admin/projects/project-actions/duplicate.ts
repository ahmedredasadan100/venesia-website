"use server";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import type { ProjectCategory } from "../../../../config/projects-data";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { revalidateProjectPaths } from "./revalidate";

async function ensureUniqueProjectField(field: "code" | "slug", base: string) {
  const supabase = getSupabaseAdmin();
  let candidate = `${base}-copy`;
  let counter = 2;

  while (true) {
    const { data } = await supabase.from("projects").select("id").eq(field, candidate).maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-copy-${counter}`;
    counter += 1;
  }
}

export async function duplicateProjectAjax(id: number) {
  await requireAdminSession();
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false as const, code: "invalid_id", message: "معرف المشروع غير صالح." };
  }

  const supabase = getSupabaseAdmin();
  const { data: source, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle<Record<string, unknown>>();

  if (error) return { ok: false as const, code: "lookup_failed", message: error.message };
  if (!source) return { ok: false as const, code: "project_not_found", message: "المشروع غير موجود." };

  const type = source.type as ProjectCategory;
  if (type !== "residential") {
    return { ok: false as const, code: "duplicate_type_forbidden", message: "النسخ متاح للمشاريع السكنية فقط." };
  }

  const sourceCode = String(source.code ?? "").trim();
  const sourceSlug = String(source.slug ?? "").trim();
  if (!sourceCode || !sourceSlug) {
    return { ok: false as const, code: "duplicate_missing_identity", message: "لا يمكن نسخ مشروع بدون code أو slug." };
  }

  const now = new Date().toISOString();
  const nextCode = await ensureUniqueProjectField("code", sourceCode);
  const nextSlug = await ensureUniqueProjectField("slug", sourceSlug);

  const [
    { data: floorPlans, error: floorPlansSelectError },
    { data: deliveryItems, error: deliverySelectError },
    { data: media, error: mediaSelectError },
  ] = await Promise.all([
    supabase.from("project_floor_plans").select("area, label, plan_image, specs, featured, sort_order").eq("project_id", id),
    supabase.from("project_delivery_spec_items").select("body, sort_order").eq("project_id", id),
    supabase.from("project_media").select("collection, image, label, sort_order").eq("project_id", id),
  ]);

  if (floorPlansSelectError || deliverySelectError || mediaSelectError) {
    return {
      ok: false as const,
      code: "child_read_failed",
      message: "تعذر قراءة بيانات المشروع الفرعية قبل النسخ. لم يتم إنشاء نسخة.",
    };
  }

  const {
    id: sourceId,
    created_at: sourceCreatedAt,
    updated_at: sourceUpdatedAt,
    ...projectFields
  } = source;
  void sourceId;
  void sourceCreatedAt;
  void sourceUpdatedAt;

  const { data: inserted, error: insertError } = await supabase
    .from("projects")
    .insert({
      ...projectFields,
      code: nextCode,
      slug: nextSlug,
      arabic_name: `${String(source.arabic_name ?? sourceCode)} - نسخة`,
      publication_status: "draft",
      featured: false,
      show_on_homepage: false,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .maybeSingle<{ id: number }>();

  if (insertError || !inserted) {
    return {
      ok: false as const,
      code: "duplicate_insert_failed",
      message: insertError?.message ?? "تعذر نسخ المشروع.",
    };
  }

  const newProjectId = inserted.id;

  if (floorPlans?.length) {
    const { error: floorPlansError } = await supabase.from("project_floor_plans").insert(
      floorPlans.map((row) => ({ ...row, project_id: newProjectId })),
    );
    if (floorPlansError) {
      return { ok: false as const, code: "duplicate_children_failed", message: floorPlansError.message };
    }
  }

  if (deliveryItems?.length) {
    const { error: deliveryError } = await supabase.from("project_delivery_spec_items").insert(
      deliveryItems.map((row) => ({ ...row, project_id: newProjectId })),
    );
    if (deliveryError) {
      return { ok: false as const, code: "duplicate_children_failed", message: deliveryError.message };
    }
  }

  if (media?.length) {
    const { error: mediaError } = await supabase.from("project_media").insert(
      media.map((row) => ({ ...row, project_id: newProjectId })),
    );
    if (mediaError) {
      return { ok: false as const, code: "duplicate_children_failed", message: mediaError.message };
    }
  }

  revalidateProjectPaths(type, newProjectId, nextSlug);
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("project", "duplicate"),
    entityType: "project",
    entityId: newProjectId,
    metadata: { source_project_id: id, slug: nextSlug, code: nextCode },
  });
  return { ok: true as const, message: "تم نسخ المشروع كمسودة." };
}

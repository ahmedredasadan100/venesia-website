"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { moduleEditHref } from "../../../../../lib/page-blocks/admin-utils";
import { BLOCK_MODULE_REGISTRY } from "../../../../../lib/page-blocks/block-module-registry";
import { type PageBlockActionResult } from "../../../../../lib/page-blocks/action-result";
import { revalidatePageBlocksPath } from "../../../../../lib/page-blocks/admin-revalidate";
import { cleanText, parseNumber } from "../../../../../lib/page-blocks/admin-utils";
import type { PageBlockType, PageModuleKind } from "../../../../../lib/page-blocks/types";
import {
  MEDIA_HUB_ASSIGNMENT_TABLE,
  MEDIA_HUB_TEMPLATE_TABLE,
} from "../../../../../lib/media-hub-modules/registry";
import {
  MEDIA_SIDEBAR_ASSIGNMENT_TABLE,
  MEDIA_SIDEBAR_TEMPLATE_TABLE,
} from "../../../../../lib/media-sidebar-modules/registry";
import {
  coordinateMediaReferenceEntityMutation,
  MediaDomainMutationError,
} from "../../../../../lib/admin/media-catalog/domain-write-coordination";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  assignmentTable,
  auditPageBlockAssignment,
  failure,
  isMediaHubKind,
  isMediaSidebarKind,
  success,
  templateTable,
} from "./helpers";

function uniqueCopySlug(baseSlug: string) {
  const safe = (baseSlug || "module").trim() || "module";
  return `${safe}-copy-${Date.now()}`;
}

async function bumpAssignmentSortOrders(table: string, pageId: number, afterSort: number) {
  const { data, error } = await getSupabaseAdmin()
    .from(table)
    .select("id, sort_order")
    .eq("page_id", pageId)
    .gt("sort_order", afterSort);

  if (error) throw new Error(error.message);
  if (!data?.length) return;

  for (const row of data) {
    const { error: updateError } = await getSupabaseAdmin()
      .from(table)
      .update({ sort_order: Number(row.sort_order) + 10 })
      .eq("id", row.id)
      .eq("page_id", pageId);
    if (updateError) throw new Error(updateError.message);
  }
}

async function deleteTemplateOrphan(table: string, templateId: number) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from(table).delete().eq("id", templateId);
  if (!error) return true;
  const { data, error: verificationError } = await supabase
    .from(table)
    .select("id")
    .eq("id", templateId)
    .maybeSingle();
  return !verificationError && !data;
}

type DuplicateModuleParams = {
  pageId: number;
  assignmentId: number;
  moduleKind: PageModuleKind;
  templateId: number;
  actorId: number;
};

function mutationError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function moduleRedirectWithMediaSynchronization(
  moduleKind: PageModuleKind,
  templateId: number,
  status: "synced" | "saved_with_media_sync_warning",
) {
  const href = moduleEditHref(moduleKind, templateId);
  return status === "saved_with_media_sync_warning"
    ? `${href}?notice=saved_with_media_sync_warning`
    : href;
}

async function duplicateStandardBlockModule({
  pageId,
  assignmentId,
  moduleKind,
  templateId,
  actorId,
}: DuplicateModuleParams): Promise<PageBlockActionResult> {
  const blockType = moduleKind as PageBlockType;
  if (!(blockType in BLOCK_MODULE_REGISTRY)) {
    return failure("نوع الموديول غير مدعوم.");
  }

  const tplTable = templateTable(blockType);
  const asgTable = assignmentTable(blockType);

  const { data: sourceAssignment, error: asgError } = await getSupabaseAdmin()
    .from(asgTable)
    .select("id, page_id, template_id, slot, sort_order, is_visible")
    .eq("id", assignmentId)
    .eq("page_id", pageId)
    .maybeSingle();

  if (asgError || !sourceAssignment) {
    return failure(asgError?.message || "الربط غير موجود.");
  }

  if (Number(sourceAssignment.template_id) !== templateId) {
    return failure("معرّف القالب لا يطابق الربط.");
  }

  const { data: sourceTemplate, error: tplError } = await getSupabaseAdmin()
    .from(tplTable)
    .select("*")
    .eq("id", templateId)
    .maybeSingle();

  if (tplError || !sourceTemplate) {
    return failure(tplError?.message || "القالب غير موجود.");
  }

  const copySlug = uniqueCopySlug(String(sourceTemplate.slug ?? "module"));
  const insertPayload = {
    name: `${sourceTemplate.name} - نسخة`,
    slug: copySlug,
    description: sourceTemplate.description ?? null,
    variant: sourceTemplate.variant,
    style_preset: sourceTemplate.style_preset,
    status: "draft",
    config: sourceTemplate.config,
    sort_order: Number(sourceTemplate.sort_order ?? 0) + 1,
  };

  const sourceSort = Number(sourceAssignment.sort_order ?? 0);
  const newSort = sourceSort + 10;
  const provisionalIdentity = `duplicate:${templateId}:${crypto.randomUUID()}`;

  try {
    const coordinated = await coordinateMediaReferenceEntityMutation({
      domainKey: tplTable,
      leaseEntityIdentity: provisionalIdentity,
      intendedRow: insertPayload,
      actorId,
      requestIdentity: `page-module:${moduleKind}:duplicate:${actorId}:${provisionalIdentity}`,
      mutate: async () => {
        const { data: inserted, error: insertError } = await getSupabaseAdmin()
          .from(tplTable)
          .insert(insertPayload)
          .select("id")
          .single();

        if (insertError || !inserted?.id) {
          throw new Error(insertError?.message || "تعذر إنشاء نسخة القالب.");
        }

        const newTemplateId = Number(inserted.id);
        try {
          await bumpAssignmentSortOrders(asgTable, pageId, sourceSort);

          const { data: newAssignment, error: linkError } = await getSupabaseAdmin()
            .from(asgTable)
            .insert({
              page_id: pageId,
              template_id: newTemplateId,
              slot: sourceAssignment.slot,
              sort_order: newSort,
              is_visible: false,
            })
            .select("id")
            .single();

          if (linkError || !newAssignment?.id) {
            throw new Error(linkError?.message || "تعذر ربط النسخة بالصفحة.");
          }

          return {
            templateId: newTemplateId,
            assignmentId: Number(newAssignment.id),
          };
        } catch (error) {
          const compensated = await deleteTemplateOrphan(tplTable, newTemplateId);
          throw new MediaDomainMutationError(
            mutationError(error, "تعذر إكمال النسخ."),
            !compensated,
            { cause: error },
          );
        }
      },
      resolveEntityIdentity: (value) => String(value.templateId),
    });

    await auditPageBlockAssignment("duplicate", pageId, coordinated.value.assignmentId, {
      module_kind: moduleKind,
      source_template_id: templateId,
      new_template_id: coordinated.value.templateId,
      source_assignment_id: assignmentId,
      new_assignment_id: coordinated.value.assignmentId,
      slug: copySlug,
    });
    await revalidatePageBlocksPath(pageId);
    return success({
      redirectTo: moduleRedirectWithMediaSynchronization(
        moduleKind,
        coordinated.value.templateId,
        coordinated.mediaSynchronization.status,
      ),
    });
  } catch (error) {
    return failure(error instanceof Error ? error.message : "تعذر إكمال النسخ.");
  }
}

async function duplicateMediaModule({
  pageId,
  assignmentId,
  moduleKind,
  templateId,
  actorId,
}: DuplicateModuleParams): Promise<PageBlockActionResult> {
  const isHub = isMediaHubKind(moduleKind);
  const tplTable = isHub ? MEDIA_HUB_TEMPLATE_TABLE : MEDIA_SIDEBAR_TEMPLATE_TABLE;
  const asgTable = isHub ? MEDIA_HUB_ASSIGNMENT_TABLE : MEDIA_SIDEBAR_ASSIGNMENT_TABLE;

  const { data: sourceAssignment, error: asgError } = await getSupabaseAdmin()
    .from(asgTable)
    .select("id, page_id, template_id, slot, sort_order, is_visible")
    .eq("id", assignmentId)
    .eq("page_id", pageId)
    .maybeSingle();

  if (asgError || !sourceAssignment) {
    return failure(asgError?.message || "الربط غير موجود.");
  }
  if (Number(sourceAssignment.template_id) !== templateId) {
    return failure("معرّف القالب لا يطابق الربط.");
  }

  const { data: sourceTemplate, error: tplError } = await getSupabaseAdmin()
    .from(tplTable)
    .select("*")
    .eq("id", templateId)
    .maybeSingle();

  if (tplError || !sourceTemplate) {
    return failure(tplError?.message || "القالب غير موجود.");
  }

  const copySlug = uniqueCopySlug(String(sourceTemplate.slug ?? "module"));
  const insertPayload: Record<string, unknown> = {
    name: `${sourceTemplate.name} - نسخة`,
    slug: copySlug,
    description: sourceTemplate.description ?? null,
    status: "draft",
    config: sourceTemplate.config,
    sort_order: Number(sourceTemplate.sort_order ?? 0) + 1,
  };

  if (isHub) {
    insertPayload.section_key = sourceTemplate.section_key;
  } else {
    insertPayload.widget_key = sourceTemplate.widget_key;
  }

  const sourceSort = Number(sourceAssignment.sort_order ?? 0);
  const newSort = sourceSort + 10;
  const provisionalIdentity = `duplicate:${templateId}:${crypto.randomUUID()}`;

  try {
    const coordinated = await coordinateMediaReferenceEntityMutation({
      domainKey: tplTable,
      leaseEntityIdentity: provisionalIdentity,
      intendedRow: insertPayload,
      actorId,
      requestIdentity: `page-module:${moduleKind}:duplicate:${actorId}:${provisionalIdentity}`,
      mutate: async () => {
        const { data: inserted, error: insertError } = await getSupabaseAdmin()
          .from(tplTable)
          .insert(insertPayload)
          .select("id")
          .single();

        if (insertError || !inserted?.id) {
          throw new Error(insertError?.message || "تعذر إنشاء نسخة القالب.");
        }

        const newTemplateId = Number(inserted.id);
        try {
          await bumpAssignmentSortOrders(asgTable, pageId, sourceSort);
          const { data: newAssignment, error: linkError } = await getSupabaseAdmin()
            .from(asgTable)
            .insert({
              page_id: pageId,
              template_id: newTemplateId,
              slot: sourceAssignment.slot,
              sort_order: newSort,
              is_visible: false,
            })
            .select("id")
            .single();

          if (linkError || !newAssignment?.id) {
            throw new Error(linkError?.message || "تعذر ربط النسخة بالصفحة.");
          }

          return {
            templateId: newTemplateId,
            assignmentId: Number(newAssignment.id),
          };
        } catch (error) {
          const compensated = await deleteTemplateOrphan(tplTable, newTemplateId);
          throw new MediaDomainMutationError(
            mutationError(error, "تعذر إكمال النسخ."),
            !compensated,
            { cause: error },
          );
        }
      },
      resolveEntityIdentity: (value) => String(value.templateId),
    });

    await auditPageBlockAssignment("duplicate", pageId, coordinated.value.assignmentId, {
      module_kind: moduleKind,
      source_template_id: templateId,
      new_template_id: coordinated.value.templateId,
      source_assignment_id: assignmentId,
      new_assignment_id: coordinated.value.assignmentId,
      slug: copySlug,
    });
    await revalidatePageBlocksPath(pageId);
    return success({
      redirectTo: moduleRedirectWithMediaSynchronization(
        moduleKind,
        coordinated.value.templateId,
        coordinated.mediaSynchronization.status,
      ),
    });
  } catch (error) {
    return failure(error instanceof Error ? error.message : "تعذر إكمال النسخ.");
  }
}

async function duplicateHeroModule({
  pageId,
  assignmentId,
  templateId,
  actorId,
}: Omit<DuplicateModuleParams, "moduleKind">): Promise<PageBlockActionResult> {
  const { data: sourceAssignment, error: asgError } = await getSupabaseAdmin()
    .from("hero_assignments")
    .select("id, hero_id, target_id, target_type")
    .eq("id", assignmentId)
    .eq("target_id", pageId)
    .eq("target_type", "page")
    .maybeSingle();

  if (asgError || !sourceAssignment) {
    return failure(asgError?.message || "ربط الهيرو غير موجود.");
  }
  if (Number(sourceAssignment.hero_id) !== templateId) {
    return failure("معرّف الهيرو لا يطابق الربط.");
  }

  const { data: hero, error: heroError } = await getSupabaseAdmin()
    .from("hero_templates")
    .select("*")
    .eq("id", templateId)
    .maybeSingle();

  if (heroError || !hero) {
    return failure(heroError?.message || "قالب الهيرو غير موجود.");
  }

  const copySlug = uniqueCopySlug(String(hero.slug ?? "hero"));
  const insertPayload = {
    name: `${hero.name} - نسخة`,
    slug: copySlug,
    description: hero.description,
    section_key: hero.section_key,
    variant: hero.variant,
    style_preset: hero.style_preset,
    source_type: hero.source_type,
    source_id: hero.source_id,
    source_slug: hero.source_slug,
    limit_count: hero.limit_count,
    is_visible: false,
    sort_order: Number(hero.sort_order ?? 0) + 1,
    config: hero.config,
  };
  const provisionalIdentity = `duplicate:${templateId}:${crypto.randomUUID()}`;
  let coordinated;
  try {
    coordinated = await coordinateMediaReferenceEntityMutation({
      domainKey: "hero_templates",
      leaseEntityIdentity: provisionalIdentity,
      intendedRow: insertPayload,
      actorId,
      requestIdentity: `page-module:hero:duplicate:${actorId}:${provisionalIdentity}`,
      mutate: async () => {
        const { data: inserted, error: insertError } = await getSupabaseAdmin()
          .from("hero_templates")
          .insert(insertPayload)
          .select("id")
          .single();

        if (insertError || !inserted?.id) {
          throw new Error(insertError?.message || "تعذر إنشاء نسخة الهيرو.");
        }

        return { templateId: Number(inserted.id) };
      },
      resolveEntityIdentity: (value) => String(value.templateId),
    });
  } catch (error) {
    return failure(error instanceof Error ? error.message : "تعذر إكمال نسخ الهيرو.");
  }

  await auditPageBlockAssignment("duplicate", pageId, null, {
    module_kind: "hero",
    source_template_id: templateId,
    new_template_id: coordinated.value.templateId,
    source_assignment_id: assignmentId,
    new_assignment_id: null,
    slug: copySlug,
    note: "hero_copy_without_active_assignment",
  });
  await revalidatePageBlocksPath(pageId);

  const editHref = moduleEditHref("hero", coordinated.value.templateId);
  const notice = encodeURIComponent(
    "تم نسخ قالب الهيرو كمسودة مخفية. لم يُستبدل هيرو الصفحة الحالي ولم يُنشأ ربط نشط ثانٍ.",
  );
  const redirectTo = coordinated.mediaSynchronization.status === "saved_with_media_sync_warning"
    ? `${editHref}?notice=saved_with_media_sync_warning`
    : `${editHref}?notice=${notice}`;

  return success({
    message:
      "تم نسخ قالب الهيرو كمسودة مخفية. لم يُستبدل هيرو الصفحة الحالي ولم يُنشأ ربط نشط ثانٍ.",
    redirectTo,
  });
}

/**
 * Duplicates an assigned page module template and (for non-hero kinds) creates a
 * hidden assignment on the same page, placed immediately after the source.
 */
export async function duplicateAssignedPageModule(formData: FormData): Promise<PageBlockActionResult> {
  const actor = await requireAdminSession();

  const pageId = parseNumber(formData.get("page_id"));
  const assignmentId = parseNumber(formData.get("assignment_id"));
  const templateId = parseNumber(formData.get("template_id"));
  const moduleKind = cleanText(formData.get("module_kind")) as PageModuleKind;

  if (!pageId || !assignmentId || !templateId || !moduleKind) {
    return failure("بيانات النسخ غير مكتملة.");
  }

  if (moduleKind === "hero") {
    return duplicateHeroModule({ pageId, assignmentId, templateId, actorId: actor.id });
  }

  if (isMediaHubKind(moduleKind) || isMediaSidebarKind(moduleKind)) {
    return duplicateMediaModule({ pageId, assignmentId, moduleKind, templateId, actorId: actor.id });
  }

  if (moduleKind in BLOCK_MODULE_REGISTRY) {
    return duplicateStandardBlockModule({ pageId, assignmentId, moduleKind, templateId, actorId: actor.id });
  }

  return failure("نوع الموديول غير مدعوم للنسخ.");
}

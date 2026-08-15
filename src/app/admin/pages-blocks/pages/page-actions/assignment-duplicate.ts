"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import { coordinateMediaReferenceEntityMutation } from "../../../../../lib/admin/media-catalog/domain-write-coordination";
import { MEDIA_HUB_TEMPLATE_TABLE } from "../../../../../lib/media-hub-modules/registry";
import { MEDIA_SIDEBAR_TEMPLATE_TABLE } from "../../../../../lib/media-sidebar-modules/registry";
import type { TablesInsert } from "../../../../../lib/database.types";
import { type PageBlockActionResult } from "../../../../../lib/page-blocks/action-result";
import type { PageModuleTemplateTable } from "../../../../../lib/page-blocks/block-module-registry";
import { revalidatePageBlocksPath } from "../../../../../lib/page-blocks/admin-revalidate";
import { cleanText, moduleEditHref, parseNumber } from "../../../../../lib/page-blocks/admin-utils";
import type { PageModuleKind } from "../../../../../lib/page-blocks/types";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  databaseAssignmentKind,
  failure,
  isMediaHubKind,
  isMediaSidebarKind,
  mutatePageComposition,
  success,
  templateTable,
} from "./helpers";

function templateOwner(kind: PageModuleKind): PageModuleTemplateTable {
  if (isMediaHubKind(kind)) return MEDIA_HUB_TEMPLATE_TABLE;
  if (isMediaSidebarKind(kind)) return MEDIA_SIDEBAR_TEMPLATE_TABLE;
  if (kind === "hero") return "hero_templates";
  return templateTable(kind);
}

function redirectFor(kind: PageModuleKind, templateId: number, warning: boolean) {
  const href = moduleEditHref(kind, templateId);
  return warning ? `${href}?notice=saved_with_media_sync_warning` : href;
}

export async function duplicateAssignedPageModule(formData: FormData): Promise<PageBlockActionResult> {
  const actor = await requireAdminSession();
  const pageId = parseNumber(formData.get("page_id"));
  const assignmentId = parseNumber(formData.get("assignment_id"));
  const templateId = parseNumber(formData.get("template_id"));
  const kind = cleanText(formData.get("module_kind")) as PageModuleKind;
  if (!pageId || !assignmentId || !templateId || !kind) return failure("بيانات النسخ غير مكتملة.");

  const owner = templateOwner(kind);
  const { data: source, error } = await getSupabaseAdmin().from(owner).select("*").eq("id", templateId).maybeSingle();
  if (error || !source) return failure(error?.message ?? "القالب غير موجود.");
  const provisionalIdentity = `duplicate:${templateId}:${crypto.randomUUID()}`;

  try {
    const coordinated = await coordinateMediaReferenceEntityMutation({
      domainKey: owner,
      leaseEntityIdentity: provisionalIdentity,
      intendedRow: source,
      actorId: actor.id,
      requestIdentity: `page-module:${kind}:duplicate:${provisionalIdentity}`,
      mutate: async () => {
        if (kind === "hero") {
          if (!("is_visible" in source)) {
            throw new Error("Hero template owner returned an incompatible row.");
          }
          const slug = `${source.slug || "hero"}-copy-${Date.now().toString().slice(-7)}`;
          const copy: TablesInsert<"hero_templates"> = {
            config: source.config,
            description: source.description,
            is_visible: false,
            limit_count: source.limit_count,
            name: `${source.name || "Hero"} — نسخة`,
            section_key: source.section_key,
            slug,
            sort_order: source.sort_order,
            source_id: source.source_id,
            source_slug: source.source_slug,
            source_type: source.source_type,
            status: source.status,
            style_preset: source.style_preset,
            variant: source.variant,
          };
          const { data, error: insertError } = await getSupabaseAdmin()
            .from("hero_templates")
            .insert(copy)
            .select("id")
            .single();
          if (insertError || !data) throw new Error(insertError?.message ?? "تعذر نسخ Hero.");
          const duplicatedAssignmentId: number | null = null;
          return { templateId: Number(data.id), assignmentId: duplicatedAssignmentId };
        }
        const result = await mutatePageComposition(pageId, "duplicate_assignment", {
          kind: databaseAssignmentKind(kind),
          assignment_id: assignmentId,
        }, actor);
        return { templateId: Number(result.template_id), assignmentId: Number(result.assignment_id) };
      },
      resolveEntityIdentity: (value) => String(value.templateId),
    });
    let auditWarning = false;
    if (kind === "hero") {
      try {
        await recordCmsAdminAudit({
          action: buildCmsAuditAction("content_block_template", "duplicate"),
          entityType: "content_block_template",
          entityId: coordinated.value.templateId,
          metadata: {
            page_id: pageId,
            module_kind: kind,
            source_template_id: templateId,
            creates_assignment: false,
          },
        });
      } catch (auditError) {
        auditWarning = true;
        console.error("Hero template duplicate audit failed after commit", auditError);
      }
    }
    await revalidatePageBlocksPath(pageId);
    return success({
      message: `${kind === "hero" ? "تم نسخ قالب Hero دون إنشاء ربط نشط ثانٍ." : "تم نسخ القالب والربط ذريًا."}${auditWarning ? " تعذر تسجيل حدث التدقيق؛ راجع السجل التشخيصي." : ""}`,
      redirectTo: redirectFor(kind, coordinated.value.templateId, coordinated.mediaSynchronization.status === "saved_with_media_sync_warning"),
    });
  } catch (caught) {
    return failure(caught instanceof Error ? caught.message : "تعذر إكمال النسخ.");
  }
}

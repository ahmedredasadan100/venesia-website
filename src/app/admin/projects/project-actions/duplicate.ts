"use server";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import {
  coordinateMediaReferenceDomainMutation,
  MediaDomainMutationError,
} from "../../../../lib/admin/media-catalog/domain-write-coordination";
import { buildMediaReferenceWriteScope } from "../../../../lib/admin/media-catalog/reference-providers";
import { synchronizeMediaReferenceWriteScopesAfterDomainMutation } from "../../../../lib/admin/media-catalog/synchronization";
import {
  getMediaReferenceWriteLeaseUserMessage,
  MediaReferenceWriteLeaseError,
} from "../../../../lib/admin/media-catalog/write-lease";
import type { ProjectCategory } from "../../../../config/projects-data";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { withProjectMediaSynchronization } from "./helpers";
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
  const actor = await requireAdminSession();
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
  const nextProjectRow = {
    ...projectFields,
    code: nextCode,
    slug: nextSlug,
    arabic_name: `${String(source.arabic_name ?? sourceCode)} - نسخة`,
    publication_status: "draft",
    featured: false,
    show_on_homepage: false,
    created_at: now,
    updated_at: now,
  };
  const floorRows = [...(floorPlans ?? [])].sort(
    (left, right) => Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0),
  );
  const mediaRows = [...(media ?? [])].sort((left, right) => {
    const collectionOrder = String(left.collection ?? "").localeCompare(String(right.collection ?? ""));
    return collectionOrder || Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0);
  });
  const operationIdentity = crypto.randomUUID();
  const projectLeaseIdentity = `duplicate:${id}:${operationIdentity}`;
  const floorLeaseIdentities = floorRows.map(
    (_, index) => `duplicate:${id}:floor:${operationIdentity}:${index}`,
  );
  const mediaLeaseIdentities = mediaRows.map(
    (_, index) => `duplicate:${id}:media:${operationIdentity}:${index}`,
  );

  let coordinated;
  try {
    coordinated = await coordinateMediaReferenceDomainMutation({
      scopes: [
        buildMediaReferenceWriteScope("projects", projectLeaseIdentity, nextProjectRow),
        ...floorRows.map((row, index) =>
          buildMediaReferenceWriteScope("project_floor_plans", floorLeaseIdentities[index], row),
        ),
        ...mediaRows.map((row, index) =>
          buildMediaReferenceWriteScope("project_media", mediaLeaseIdentities[index], row),
        ),
      ],
      actorId: actor.id,
      requestIdentity: `project:duplicate:${id}:${operationIdentity}`,
      mutate: async () => {
        const { data: inserted, error: insertError } = await supabase
          .from("projects")
          .insert(nextProjectRow)
          .select("id")
          .maybeSingle<{ id: number }>();
        if (insertError || !inserted) {
          throw new Error(insertError?.message ?? "تعذر نسخ المشروع.");
        }

        try {
          const newProjectId = inserted.id;
          let insertedFloorRows: { id: number; sort_order: number }[] = [];
          if (floorRows.length) {
            const { data, error: floorPlansError } = await supabase
              .from("project_floor_plans")
              .insert(floorRows.map((row) => ({ ...row, project_id: newProjectId })))
              .select("id, sort_order");
            if (floorPlansError) throw new Error(floorPlansError.message);
            insertedFloorRows = ((data ?? []) as { id: number; sort_order: number }[]).sort(
              (left, right) => left.sort_order - right.sort_order || left.id - right.id,
            );
            if (insertedFloorRows.length !== floorRows.length) {
              throw new Error("project_floor_plan_duplicate_identity_mismatch");
            }
          }

          if (deliveryItems?.length) {
            const { error: deliveryError } = await supabase
              .from("project_delivery_spec_items")
              .insert(deliveryItems.map((row) => ({ ...row, project_id: newProjectId })));
            if (deliveryError) throw new Error(deliveryError.message);
          }

          let insertedMediaRows: { id: number; collection: string; sort_order: number }[] = [];
          if (mediaRows.length) {
            const { data, error: mediaError } = await supabase
              .from("project_media")
              .insert(mediaRows.map((row) => ({ ...row, project_id: newProjectId })))
              .select("id, collection, sort_order");
            if (mediaError) throw new Error(mediaError.message);
            insertedMediaRows = ((data ?? []) as {
              id: number;
              collection: string;
              sort_order: number;
            }[]).sort((left, right) => {
              const collectionOrder = left.collection.localeCompare(right.collection);
              return collectionOrder || left.sort_order - right.sort_order || left.id - right.id;
            });
            if (insertedMediaRows.length !== mediaRows.length) {
              throw new Error("project_media_duplicate_identity_mismatch");
            }
          }

          return { newProjectId, insertedFloorRows, insertedMediaRows };
        } catch (childError) {
          throw new MediaDomainMutationError(
            childError instanceof Error ? childError.message : "تعذر نسخ بيانات المشروع المرتبطة.",
            true,
            { cause: childError },
          );
        }
      },
      resolveEntityIdentity: (value) => String(value.newProjectId),
      synchronize: ({ value, leaseToken }) =>
        synchronizeMediaReferenceWriteScopesAfterDomainMutation(
          [
            {
              domainKey: "projects",
              entityIdentity: value.newProjectId,
              leaseEntityIdentity: projectLeaseIdentity,
            },
            ...value.insertedFloorRows.map((row, index) => ({
              domainKey: "project_floor_plans",
              entityIdentity: row.id,
              leaseEntityIdentity: floorLeaseIdentities[index],
            })),
            ...value.insertedMediaRows.map((row, index) => ({
              domainKey: "project_media",
              entityIdentity: row.id,
              leaseEntityIdentity: mediaLeaseIdentities[index],
            })),
          ],
          leaseToken,
        ),
    });
  } catch (coordinationError) {
    return {
      ok: false as const,
      code: coordinationError instanceof MediaReferenceWriteLeaseError
        ? coordinationError.code
        : "duplicate_failed",
      message: coordinationError instanceof MediaReferenceWriteLeaseError
        ? getMediaReferenceWriteLeaseUserMessage(coordinationError.code)
        : coordinationError instanceof Error
          ? coordinationError.message
          : "تعذر نسخ المشروع.",
    };
  }

  const newProjectId = coordinated.value.newProjectId;
  revalidateProjectPaths(type, newProjectId, nextSlug);
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("project", "duplicate"),
    entityType: "project",
    entityId: newProjectId,
    metadata: { source_project_id: id, slug: nextSlug, code: nextCode },
  });
  return withProjectMediaSynchronization(
    { ok: true as const, message: "أُنشئت نسخة جديدة كمسودة." },
    coordinated.mediaSynchronization,
  );
}

"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import type { AdminFormActionState } from "../../../../../lib/admin/form-runtime";
import { coordinateMediaReferenceEntityMutation } from "../../../../../lib/admin/media-catalog/domain-write-coordination";
import {
  synchronizeMediaReferenceWriteScopesAfterDomainMutation,
  type MediaReferenceSynchronizationResult,
} from "../../../../../lib/admin/media-catalog/synchronization";

import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  cleanText,
  getStatus,
  parseNumber,
  slugify,
} from "../../../../../lib/page-blocks/admin-utils";
import { revalidateBlockModulePaths } from "../../../../../lib/page-blocks/admin-revalidate";
import {
  parsePageIdsFromForm,
  syncBlockModulePageAssignments,
} from "../../../../../lib/page-blocks/sync-module-page-assignments";
import { revalidatePath } from "next/cache";
import { buildFeedModuleConfig } from "../../../../../lib/feed-modules/parse-feed-config";
import {
  isSeriesAllowedForCategory,
  loadTopicFilterOptionsForAdmin,
} from "../../../../../lib/feed-modules/load-topic-filter-options";
import { TOPICS_FEED_TYPES, type TopicsFeedType } from "../../../../../lib/feed-modules/types";

function readFeedType(value: FormDataEntryValue | null): TopicsFeedType {
  const feedType = cleanText(value);
  return TOPICS_FEED_TYPES.includes(feedType as TopicsFeedType) ? (feedType as TopicsFeedType) : "latest";
}

async function sanitizeFeedModuleConfig(formData: FormData) {
  const config = buildFeedModuleConfig(formData);

  if (!config.query.categorySlug) {
    config.query.seriesSlug = null;
    return config;
  }

  if (config.query.seriesSlug) {
    const filterOptions = await loadTopicFilterOptionsForAdmin();
    if (!isSeriesAllowedForCategory(filterOptions, config.query.categorySlug, config.query.seriesSlug)) {
      config.query.seriesSlug = null;
    }
  }

  return config;
}

async function ensureUniqueSlug(slug: string, id?: number) {
  let query = getSupabaseAdmin().from("feed_module_templates").select("id").eq("slug", slug).limit(1);
  if (id) query = query.neq("id", id);
  const { data } = await query.maybeSingle();
  return !data;
}

export type CreateFeedModuleFormActionState = AdminFormActionState;

function createFeedModuleFailure(
  revision: number,
  message: string,
  field?: "name" | "slug" | "widget_title" | "limit",
): CreateFeedModuleFormActionState {
  return {
    status: "error",
    mode: "create",
    revision,
    title: "تعذر إنشاء Feed Module",
    message,
    ...(field
      ? { fieldErrors: { [field]: [message] }, focusTarget: field }
      : {}),
  };
}

function createFeedModuleSuccess(
  revision: number,
  id: number,
  mediaWarning: boolean,
  infrastructureWarning?: string,
): CreateFeedModuleFormActionState {
  const warning = mediaWarning || Boolean(infrastructureWarning);
  return {
    status: warning ? "warning" : "success",
    mode: "create",
    revision,
    title: warning ? "تم إنشاء Feed Module مع تنبيه" : "تم إنشاء Feed Module",
    message:
      infrastructureWarning ??
      (mediaWarning
        ? "تم إنشاء الموديول، لكن مزامنة مراجع الوسائط تحتاج إلى مراجعة."
        : "تم إنشاء الموديول كمسودة بنجاح."),
    code: warning ? "created_with_warning" : "created",
    entityId: id,
    editHref: `/admin/pages-blocks/blocks/feed/${id}${mediaWarning ? "?notice=saved_with_media_sync_warning" : ""}`,
    savedRevision: `${id}:${revision}`,
  };
}

export async function createFeedModule(
  previousState: CreateFeedModuleFormActionState,
  formData: FormData,
): Promise<CreateFeedModuleFormActionState> {
  const revision = previousState.revision + 1;
  const actor = await requireAdminSession();
  const name = cleanText(formData.get("name"));
  const slug = slugify(cleanText(formData.get("slug")) || name);
  const widgetTitle = cleanText(formData.get("widget_title"));
  const limit = Number(cleanText(formData.get("limit")));

  if (!name) return createFeedModuleFailure(revision, "اسم الموديول مطلوب.", "name");
  if (!slug) return createFeedModuleFailure(revision, "اكتب slug صالحًا للموديول.", "slug");
  if (!widgetTitle) {
    return createFeedModuleFailure(
      revision,
      "عنوان الـWidget مطلوب.",
      "widget_title",
    );
  }
  if (!Number.isInteger(limit) || limit < 1) {
    return createFeedModuleFailure(
      revision,
      "Limit يجب أن يكون رقمًا صحيحًا أكبر من أو يساوي 1.",
      "limit",
    );
  }
  if (!(await ensureUniqueSlug(slug))) {
    return createFeedModuleFailure(revision, "الـ slug مستخدم بالفعل.", "slug");
  }

  let createdId: number | null = null;
  let mediaWarning = false;
  try {
    const nextRow = {
      name,
      slug,
      description: cleanText(formData.get("description")) || null,
      status: getStatus(cleanText(formData.get("status")) || "draft"),
      feed_type: readFeedType(formData.get("feed_type")),
      config: await sanitizeFeedModuleConfig(formData),
    };
    const provisionalIdentity = `create:${crypto.randomUUID()}`;
    const coordinated = await coordinateMediaReferenceEntityMutation({
      domainKey: "feed_module_templates",
      leaseEntityIdentity: provisionalIdentity,
      intendedRow: nextRow,
      actorId: actor.id,
      requestIdentity: `feed-module:create:${provisionalIdentity}`,
      mutate: async () => {
        const { data, error } = await getSupabaseAdmin()
          .from("feed_module_templates")
          .insert(nextRow)
          .select("id")
          .single<{ id: number }>();
        if (error || !data) throw new Error(error?.message ?? "تعذر إنشاء Feed Module.");
        return data;
      },
      resolveEntityIdentity: (value) => String(value.id),
    });
    const data = coordinated.value;
    createdId = data.id;
    mediaWarning = coordinated.mediaSynchronization.status === "saved_with_media_sync_warning";

    await revalidateBlockModulePaths("feed");
    return createFeedModuleSuccess(revision, data.id, mediaWarning);
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر إنشاء Feed Module. حاول مرة أخرى.";
    if (createdId) {
      return createFeedModuleSuccess(
        revision,
        createdId,
        mediaWarning,
        `تم إنشاء الموديول، لكن تعذر إكمال التحقق اللاحق: ${message}`,
      );
    }
    return createFeedModuleFailure(
      revision,
      message,
      message.toLowerCase().includes("slug") ? "slug" : undefined,
    );
  }
}

export async function updateFeedModule(formData: FormData) {
  const actor = await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  const name = cleanText(formData.get("name"));
  const slug = slugify(cleanText(formData.get("slug")) || name);

  if (!id || !name || !slug) throw new Error("بيانات الموديول غير مكتملة.");
  if (!(await ensureUniqueSlug(slug, id))) throw new Error("الـ slug مستخدم بالفعل.");

  const nextRow = {
    name,
    slug,
    description: cleanText(formData.get("description")) || null,
    status: getStatus(cleanText(formData.get("status")) || "draft"),
    feed_type: readFeedType(formData.get("feed_type")),
    config: await sanitizeFeedModuleConfig(formData),
    updated_at: new Date().toISOString(),
  };
  const coordinated = await coordinateMediaReferenceEntityMutation({
    domainKey: "feed_module_templates",
    leaseEntityIdentity: String(id),
    intendedRow: nextRow,
    actorId: actor.id,
    requestIdentity: `feed-module:update:${id}`,
    mutate: async () => {
      const { data, error } = await getSupabaseAdmin()
        .from("feed_module_templates")
        .update(nextRow)
        .eq("id", id)
        .select("id")
        .maybeSingle<{ id: number }>();
      if (error || !data) throw new Error(error?.message ?? "Unable to update feed module.");
      return data;
    },
    resolveEntityIdentity: (value) => String(value.id),
  });

  await syncBlockModulePageAssignments("feed", id, parsePageIdsFromForm(formData));
  await revalidateBlockModulePaths("feed");
  revalidatePath(`/admin/pages-blocks/blocks/feed/${id}`, "page");
  redirect(`/admin/pages-blocks/blocks/feed/${id}?saved=1${coordinated.mediaSynchronization.status === "saved_with_media_sync_warning" ? "&notice=saved_with_media_sync_warning" : ""}`);
}

export async function toggleFeedModuleStatus(formData: FormData) {
  await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  const nextStatus = getStatus(cleanText(formData.get("next_status")) || "draft");
  if (!id) throw new Error("معرّف الموديول مفقود.");

  const { error } = await getSupabaseAdmin()
    .from("feed_module_templates")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  await revalidateBlockModulePaths("feed");
}

export async function deleteFeedModule(formData: FormData) {
  await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  if (!id) throw new Error("معرّف الموديول مفقود.");

  const { data: existing, error: lookupError } = await getSupabaseAdmin()
    .from("feed_module_templates")
    .select("id")
    .eq("id", id)
    .maybeSingle<{ id: number }>();
  if (lookupError) throw new Error(lookupError.message);
  const cleanupIdentity = existing?.id ?? id;

  const { error } = await getSupabaseAdmin()
    .from("feed_module_templates")
    .delete()
    .eq("id", cleanupIdentity);
  if (error) throw new Error(error.message);

  const mediaSynchronization = await synchronizeMediaReferenceWriteScopesAfterDomainMutation(
    [],
    null,
    [{ domainKey: "feed_module_templates", entityIdentity: cleanupIdentity }],
  );
  if (mediaSynchronization.status === "saved_with_media_sync_warning") {
    try {
      await revalidateBlockModulePaths("feed");
    } catch (revalidationError) {
      console.error("Feed module delete committed with a Media synchronization warning; cache revalidation also failed.", revalidationError);
    }
    redirect("/admin/pages-blocks/blocks/feed?notice=saved_with_media_sync_warning");
  }
  await revalidateBlockModulePaths("feed");
}

export async function duplicateFeedModule(formData: FormData) {
  const actor = await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  if (!id) throw new Error("معرّف الموديول مفقود.");

  const { data: source, error } = await getSupabaseAdmin()
    .from("feed_module_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !source) throw new Error(error?.message || "الموديول غير موجود.");

  const nextRow = {
    name: `${source.name} - نسخة`,
    slug: `${source.slug}-copy-${Date.now()}`,
    description: source.description,
    status: "draft",
    feed_type: source.feed_type,
    config: source.config,
    sort_order: (source.sort_order ?? 0) + 1,
  };
  const provisionalIdentity = `duplicate:${id}:${crypto.randomUUID()}`;
  const coordinated = await coordinateMediaReferenceEntityMutation({
    domainKey: "feed_module_templates",
    leaseEntityIdentity: provisionalIdentity,
    intendedRow: nextRow,
    actorId: actor.id,
    requestIdentity: `feed-module:duplicate:${id}`,
    mutate: async () => {
      const { data, error: insertError } = await getSupabaseAdmin()
        .from("feed_module_templates")
        .insert(nextRow)
        .select("id")
        .single<{ id: number }>();
      if (insertError || !data) throw new Error(insertError?.message ?? "Unable to duplicate feed module.");
      return data;
    },
    resolveEntityIdentity: (value) => String(value.id),
  });
  await revalidateBlockModulePaths("feed");
  if (coordinated.mediaSynchronization.status === "saved_with_media_sync_warning") {
    redirect("/admin/pages-blocks/blocks/feed?notice=saved_with_media_sync_warning");
  }
}

export async function bulkFeedModules(formData: FormData) {
  await requireAdminSession();
  const action = cleanText(formData.get("bulk_action"));
  const ids = formData
    .getAll("ids")
    .flatMap((value) => String(value).split(","))
    .map((value) => Number(value))
    .filter(Boolean);

  if (!ids.length) return;

  const now = new Date().toISOString();

  if (action === "publish" || action === "hide" || action === "draft") {
    const status = action === "publish" ? "published" : action === "hide" ? "unpublished" : "draft";
    const { error } = await getSupabaseAdmin()
      .from("feed_module_templates")
      .update({ status, updated_at: now })
      .in("id", ids);
    if (error) throw new Error(error.message);
  }

  let mediaSynchronization: MediaReferenceSynchronizationResult | null = null;
  if (action === "delete") {
    const { data: existingRows, error: lookupError } = await getSupabaseAdmin()
      .from("feed_module_templates")
      .select("id")
      .in("id", ids);
    if (lookupError) throw new Error(lookupError.message);

    const capturedIds = (existingRows ?? []).map((row) => Number(row.id));
    const cleanupIds = [...new Set([...capturedIds, ...ids])];
    const { error } = await getSupabaseAdmin()
      .from("feed_module_templates")
      .delete()
      .in("id", cleanupIds);
    if (error) throw new Error(error.message);

    mediaSynchronization = await synchronizeMediaReferenceWriteScopesAfterDomainMutation(
      [],
      null,
      cleanupIds.map((cleanupId) => ({
        domainKey: "feed_module_templates",
        entityIdentity: cleanupId,
      })),
    );
  }

  if (mediaSynchronization?.status === "saved_with_media_sync_warning") {
    try {
      await revalidateBlockModulePaths("feed");
    } catch (revalidationError) {
      console.error("Feed module bulk delete committed with a Media synchronization warning; cache revalidation also failed.", revalidationError);
    }
    redirect("/admin/pages-blocks/blocks/feed?notice=saved_with_media_sync_warning");
  }
  await revalidateBlockModulePaths("feed");
}

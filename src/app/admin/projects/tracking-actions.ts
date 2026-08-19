"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { adminActionFailure, adminActionSuccess, adminActionWarning, type AdminActionResult } from "../../../lib/admin/admin-action-result";
import { buildCmsAuditAction } from "../../../lib/admin/audit/cms-audit-actions";
import { requireAdminSession } from "../../../lib/admin/auth/require-admin-session";
import { recordCmsAdminAudit } from "../../../lib/admin/audit-log";
import type { AdminFormActionState } from "../../../lib/admin/form-runtime";
import { revalidatePublicCacheTags } from "../../../lib/cache/revalidate-public-cache-tags";
import type { Json } from "../../../lib/database.types";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import { trackingMediaAdminSchema } from "../../../lib/admin/projects/tracking-contract";
import {
  cleanupDeletedTrackingUpdateMedia,
  coordinateTrackingUpdateSave,
  type IntendedTrackingMedia,
} from "../../../lib/admin/projects/tracking-media-coordination";
import { projectTrackingMediaReferenceSchema } from "../../../lib/projects/tracking/contract";

type SavedIdentity = { id: number };
export type TrackingFormActionState = AdminFormActionState<SavedIdentity>;

const idSchema = z.coerce.number().int().positive();
const optionalText = z.string().trim().transform((value) => value || null);
const stageSchema = z.object({
  name: z.string().trim().min(1, "اسم المرحلة مطلوب.").max(160),
  description: optionalText,
  start_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).transform((value) => value || null),
  planned_duration_value: z.string().trim().transform((value) => value ? Number(value) : null).pipe(z.number().int().positive().nullable()),
  planned_duration_unit: z.enum(["day", "week", "month", ""]).transform((value) => value || null),
  is_visible: z.boolean(),
}).refine((value) => (value.planned_duration_value === null) === (value.planned_duration_unit === null), { message: "قيمة مدة المرحلة ووحدتها مطلوبتان معًا.", path: ["planned_duration_value"] });
const itemSchema = z.object({
  name: z.string().trim().min(1, "اسم البند مطلوب.").max(180),
  description: optionalText,
  status: z.enum(["not_started", "in_progress", "completed"]),
  start_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).transform((value) => value || null),
  completion_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).transform((value) => value || null),
  is_visible: z.boolean(),
}).refine((value) => value.status !== "completed" || value.completion_date !== null, { message: "تاريخ الإكمال مطلوب للبند المكتمل.", path: ["completion_date"] }).refine((value) => value.status === "completed" || value.completion_date === null, { message: "تاريخ الإكمال مسموح للبند المكتمل فقط.", path: ["completion_date"] });
const profileSchema = z.object({
  project_receipt_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).transform((value) => value || null),
  license_receipt_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).transform((value) => value || null),
  contractor_name: optionalText,
});
const videoInputSchema = z.array(z.object({
  client_key: z.string().uuid().optional(),
  url: z.string().url(),
  poster_url: projectTrackingMediaReferenceSchema.or(z.literal("")).optional(),
  title: z.string().trim().max(180).optional(),
}));
const updateSchema = z.object({
  occurred_on: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ التحديث مطلوب."),
  title: z.string().trim().min(1, "عنوان التحديث مطلوب.").max(180),
  body: z.string().trim().min(1, "تفاصيل التحديث مطلوبة.").max(5000),
  publication_status: z.enum(["draft", "published", "unpublished", "archived"]),
  image_urls: z.array(projectTrackingMediaReferenceSchema),
  videos: videoInputSchema,
});

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
function lastText(formData: FormData, key: string) {
  const values = formData.getAll(key);
  const value = values.at(-1);
  return typeof value === "string" ? value.trim() : "";
}
function positiveId(formData: FormData, key: string) {
  return idSchema.safeParse(text(formData, key));
}
function fieldErrors(error: z.ZodError) {
  return Object.fromEntries(Object.entries(z.flattenError(error).fieldErrors).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0));
}
function failure(mode: "create" | "edit", revision: number, title: string, message: string, errors?: Record<string, string[]>): TrackingFormActionState {
  const focusTarget = errors ? Object.keys(errors)[0] : undefined;
  return { status: "error", mode, revision, title, message, ...(errors ? { fieldErrors: errors } : {}), ...(focusTarget ? { focusTarget } : {}) };
}
function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "تعذر إكمال العملية.";
}
async function projectSlug(projectId: number) {
  const { data, error } = await getSupabaseAdmin().from("projects").select("slug,arabic_name").eq("id", projectId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("المشروع غير موجود.");
  return data;
}
function revalidateTracking(projectId: number, slug: string) {
  revalidatePath(`/admin/projects/${projectId}/tracking`, "layout");
  revalidatePath("/admin/projects/construction-updates");
  revalidatePath(`/track-your-project/${slug}`);
  revalidatePublicCacheTags(["project-tracking", `project-tracking:${slug}`]);
}
async function audit(actor: Awaited<ReturnType<typeof requireAdminSession>>, verb: "create" | "update" | "delete" | "reorder", entityType: string, entityId: number, label: string, metadata: Record<string, unknown> = {}) {
  await recordCmsAdminAudit({ action: buildCmsAuditAction("project_children", verb), entityType, entityId, entityLabel: label, metadata }, actor);
}

export async function saveTrackingProfileAction(previous: TrackingFormActionState, formData: FormData): Promise<TrackingFormActionState> {
  const revision = previous.revision + 1;
  const mode = "edit" as const;
  const project = positiveId(formData, "project_id");
  const parsed = profileSchema.safeParse({ project_receipt_date: text(formData, "project_receipt_date"), license_receipt_date: text(formData, "license_receipt_date"), contractor_name: text(formData, "contractor_name") });
  if (!project.success || !parsed.success) return failure(mode, revision, "تعذر حفظ بيانات المتابعة", "راجع الحقول المطلوبة.", parsed.success ? undefined : fieldErrors(parsed.error));
  const actor = await requireAdminSession();
  try {
    const identity = await projectSlug(project.data);
    const { data, error } = await getSupabaseAdmin().rpc("save_project_tracking_profile", { p_project_id: project.data, p_actor_id: actor.id, p_payload: parsed.data as Json });
    if (error) throw error;
    await audit(actor, "update", "project_tracking_profile", project.data, identity.arabic_name);
    revalidateTracking(project.data, identity.slug);
    return { status: "success", mode, revision, title: "تم حفظ بيانات المتابعة", message: "حُفظت بيانات الاستلام والمقاول داخل ملف المتابعة.", code: "saved", entityId: project.data, savedRevision: String(Date.now()), result: { id: Number((data as { project_id?: number } | null)?.project_id ?? project.data) } };
  } catch (error) { return failure(mode, revision, "تعذر حفظ بيانات المتابعة", errorMessage(error)); }
}

async function saveStage(mode: "create" | "edit", previous: TrackingFormActionState, formData: FormData): Promise<TrackingFormActionState> {
  const revision = previous.revision + 1;
  const project = positiveId(formData, "project_id");
  const stage = mode === "edit" ? positiveId(formData, "stage_id") : null;
  const parsed = stageSchema.safeParse({ name: text(formData, "name"), description: text(formData, "description"), start_date: text(formData, "start_date"), planned_duration_value: text(formData, "planned_duration_value"), planned_duration_unit: text(formData, "planned_duration_unit"), is_visible: formData.get("is_visible") === "on" });
  if (!project.success || (stage && !stage.success) || !parsed.success) return failure(mode, revision, "تعذر حفظ المرحلة", "راجع بيانات المرحلة.", parsed.success ? undefined : fieldErrors(parsed.error));
  const actor = await requireAdminSession();
  try {
    const identity = await projectSlug(project.data);
    const { data, error } = await getSupabaseAdmin().rpc("mutate_project_tracking_stage", { p_project_id: project.data, p_actor_id: actor.id, p_action: mode === "create" ? "create" : "update", p_stage_id: stage?.data ?? null, p_payload: parsed.data as Json });
    if (error) throw error;
    const id = Number((data as { id?: number } | null)?.id);
    await audit(actor, mode === "create" ? "create" : "update", "project_tracking_stage", id, parsed.data.name, { project_id: project.data });
    revalidateTracking(project.data, identity.slug);
    return {
      status: "success",
      mode,
      revision,
      title: "تم حفظ المرحلة",
      message:
        mode === "create"
          ? "أُضيفت المرحلة إلى رحلة التنفيذ."
          : "تم تحديث بيانات المرحلة.",
      code: mode === "create" ? "created" : "saved",
      entityId: id,
      savedRevision: `${id}:${Date.now()}`,
      result: { id },
      ...(mode === "create"
        ? {
            editHref: `/admin/projects/${project.data}/tracking/stages/${id}`,
          }
        : {}),
    };
  } catch (error) { return failure(mode, revision, "تعذر حفظ المرحلة", errorMessage(error)); }
}
export async function createTrackingStageAction(previous: TrackingFormActionState, formData: FormData) { return saveStage("create", previous, formData); }
export async function updateTrackingStageAction(previous: TrackingFormActionState, formData: FormData) { return saveStage("edit", previous, formData); }

async function saveItem(mode: "create" | "edit", previous: TrackingFormActionState, formData: FormData): Promise<TrackingFormActionState> {
  const revision = previous.revision + 1;
  const project = positiveId(formData, "project_id");
  const stage = positiveId(formData, "stage_id");
  const item = mode === "edit" ? positiveId(formData, "item_id") : null;
  const parsed = itemSchema.safeParse({ name: text(formData, "name"), description: text(formData, "description"), status: text(formData, "status"), start_date: text(formData, "start_date"), completion_date: text(formData, "completion_date"), is_visible: formData.get("is_visible") === "on" });
  if (!project.success || !stage.success || (item && !item.success) || !parsed.success) return failure(mode, revision, "تعذر حفظ البند", "راجع بيانات البند.", parsed.success ? undefined : fieldErrors(parsed.error));
  const actor = await requireAdminSession();
  try {
    const identity = await projectSlug(project.data);
    const { data, error } = await getSupabaseAdmin().rpc("mutate_project_tracking_item", { p_project_id: project.data, p_stage_id: stage.data, p_actor_id: actor.id, p_action: mode === "create" ? "create" : "update", p_item_id: item?.data ?? null, p_payload: parsed.data as Json });
    if (error) throw error;
    const id = Number((data as { id?: number } | null)?.id);
    await audit(actor, mode === "create" ? "create" : "update", "project_tracking_item", id, parsed.data.name, { project_id: project.data, stage_id: stage.data, status: parsed.data.status });
    revalidateTracking(project.data, identity.slug);
    return {
      status: "success",
      mode,
      revision,
      title: "تم حفظ البند",
      message:
        mode === "create"
          ? "أُضيف البند إلى المرحلة."
          : "تم تحديث حالة وبيانات البند.",
      code: mode === "create" ? "created" : "saved",
      entityId: id,
      savedRevision: `${id}:${Date.now()}`,
      result: { id },
      ...(mode === "create"
        ? {
            editHref: `/admin/projects/${project.data}/tracking/items/${id}`,
          }
        : {}),
    };
  } catch (error) { return failure(mode, revision, "تعذر حفظ البند", errorMessage(error)); }
}
export async function createTrackingItemAction(previous: TrackingFormActionState, formData: FormData) { return saveItem("create", previous, formData); }
export async function updateTrackingItemAction(previous: TrackingFormActionState, formData: FormData) { return saveItem("edit", previous, formData); }

async function existingMedia(updateId: number | null) {
  if (!updateId) return [];
  const { data, error } = await getSupabaseAdmin().from("project_tracking_update_media").select("id,client_key,update_id,media_kind,public_url,poster_url,title,sort_order").eq("update_id", updateId).order("sort_order");
  if (error) throw error;
  return data ?? [];
}
function intendedMedia(input: z.infer<typeof updateSchema>, existing: Awaited<ReturnType<typeof existingMedia>>): IntendedTrackingMedia[] {
  const unused = [...existing];
  const claim = (kind: "image" | "video", url: string, requested?: string) => {
    if (requested) return requested;
    const index = unused.findIndex((row) => row.media_kind === kind && row.public_url === url);
    if (index < 0) return crypto.randomUUID();
    return unused.splice(index, 1)[0].client_key;
  };
  return [
    ...input.image_urls.map((url, index) => ({ client_key: claim("image", url), media_kind: "image" as const, public_url: url, poster_url: null, title: null, sort_order: index })),
    ...input.videos.map((video, index) => ({ client_key: claim("video", video.url, video.client_key), media_kind: "video" as const, public_url: video.url, poster_url: video.poster_url || null, title: video.title || null, sort_order: input.image_urls.length + index })),
  ];
}
async function saveUpdate(mode: "create" | "edit", previous: TrackingFormActionState, formData: FormData): Promise<TrackingFormActionState> {
  const revision = previous.revision + 1;
  const project = positiveId(formData, "project_id");
  const item = positiveId(formData, "item_id");
  const update = mode === "edit" ? positiveId(formData, "update_id") : null;
  let videos: unknown = [];
  try { videos = JSON.parse(text(formData, "videos_json") || "[]"); } catch { return failure(mode, revision, "تعذر حفظ التحديث", "بيانات الفيديو غير صالحة.", { videos_json: ["بيانات الفيديو غير صالحة."] }); }
  const parsed = updateSchema.safeParse({ occurred_on: text(formData, "occurred_on"), title: text(formData, "title"), body: text(formData, "body"), publication_status: lastText(formData, "publication_status"), image_urls: text(formData, "image_urls").split("\n").map((value) => value.trim()).filter(Boolean), videos });
  if (!project.success || !item.success || (update && !update.success) || !parsed.success) return failure(mode, revision, "تعذر حفظ التحديث", "راجع بيانات التحديث والوسائط.", parsed.success ? undefined : fieldErrors(parsed.error));
  const actor = await requireAdminSession();
  try {
    const identity = await projectSlug(project.data);
    const currentMedia = await existingMedia(update?.data ?? null);
    const media = intendedMedia(parsed.data, currentMedia);
    const coordinated = await coordinateTrackingUpdateSave({ actorId: actor.id, updateId: update?.data ?? null, intendedMedia: media, mutate: async () => {
      const { data, error } = await getSupabaseAdmin().rpc("mutate_project_tracking_update", { p_project_id: project.data, p_item_id: item.data, p_actor_id: actor.id, p_action: mode === "create" ? "create" : "update", p_update_id: update?.data ?? null, p_payload: { occurred_at: `${parsed.data.occurred_on}T12:00:00Z`, title: parsed.data.title, body: parsed.data.body, publication_status: parsed.data.publication_status, media } as Json });
      if (error) throw error;
      const raw = data as { id?: number; media?: unknown } | null;
      return { id: Number(raw?.id), media: z.array(trackingMediaAdminSchema).parse(raw?.media ?? []) };
    } });
    await audit(actor, mode === "create" ? "create" : "update", "project_tracking_update", coordinated.value.id, parsed.data.title, { project_id: project.data, item_id: item.data, publication_status: parsed.data.publication_status, media_count: media.length });
    revalidateTracking(project.data, identity.slug);
    const warning = coordinated.mediaSynchronization.status === "saved_with_media_sync_warning";
    return { status: warning ? "warning" : "success", mode, revision, title: warning ? "تم الحفظ مع تنبيه وسائط" : "تم حفظ التحديث", message: warning ? coordinated.mediaSynchronization.failureReason ?? "تم حفظ التحديث ويلزم تشغيل Media reconciliation." : "حُفظ التحديث التاريخي ووسائطه دون استبدال أي تحديث سابق.", code: warning ? "saved_with_media_sync_warning" : mode === "create" ? "created" : "saved", entityId: coordinated.value.id, savedRevision: `${coordinated.value.id}:${Date.now()}`, result: { id: coordinated.value.id } };
  } catch (error) { return failure(mode, revision, "تعذر حفظ التحديث", errorMessage(error)); }
}
export async function createTrackingUpdateAction(previous: TrackingFormActionState, formData: FormData) { return saveUpdate("create", previous, formData); }
export async function updateTrackingUpdateAction(previous: TrackingFormActionState, formData: FormData) { return saveUpdate("edit", previous, formData); }

export async function setTrackingStageVisibilityAction(
  projectId: number,
  stageId: number,
  visible: boolean,
  label: string,
): Promise<AdminActionResult> {
  const actor = await requireAdminSession();
  try {
    const identity = await projectSlug(projectId);
    const { data: stage, error: readError } = await getSupabaseAdmin()
      .from("project_tracking_stages")
      .select("name,description,start_date,planned_duration_value,planned_duration_unit,is_visible")
      .eq("project_id", projectId)
      .eq("id", stageId)
      .maybeSingle();
    if (readError) throw readError;
    if (!stage) throw new Error("المرحلة غير موجودة.");
    const { error } = await getSupabaseAdmin().rpc("mutate_project_tracking_stage", {
      p_project_id: projectId,
      p_actor_id: actor.id,
      p_action: "update",
      p_stage_id: stageId,
      p_payload: { ...stage, is_visible: visible } as Json,
    });
    if (error) throw error;
    await audit(actor, "update", "project_tracking_stage", stageId, label, {
      project_id: projectId,
      is_visible: visible,
    });
    revalidateTracking(projectId, identity.slug);
    return adminActionSuccess(
      visible ? "تم إظهار المرحلة" : "تم إخفاء المرحلة",
      visible
        ? "أصبحت المرحلة مرئية في صفحة المتابعة العامة."
        : "أصبحت المرحلة مخفية من صفحة المتابعة العامة.",
      { code: "saved", entityId: stageId },
    );
  } catch (error) {
    return adminActionFailure("تعذر تحديث ظهور المرحلة", errorMessage(error), {
      entityId: stageId,
    });
  }
}

export async function setTrackingItemVisibilityAction(
  projectId: number,
  stageId: number,
  itemId: number,
  visible: boolean,
  label: string,
): Promise<AdminActionResult> {
  const actor = await requireAdminSession();
  try {
    const identity = await projectSlug(projectId);
    const { data: item, error: readError } = await getSupabaseAdmin()
      .from("project_tracking_items")
      .select("name,description,status,start_date,completion_date,is_visible")
      .eq("stage_id", stageId)
      .eq("id", itemId)
      .maybeSingle();
    if (readError) throw readError;
    if (!item) throw new Error("البند غير موجود.");
    const { error } = await getSupabaseAdmin().rpc("mutate_project_tracking_item", {
      p_project_id: projectId,
      p_stage_id: stageId,
      p_actor_id: actor.id,
      p_action: "update",
      p_item_id: itemId,
      p_payload: { ...item, is_visible: visible } as Json,
    });
    if (error) throw error;
    await audit(actor, "update", "project_tracking_item", itemId, label, {
      project_id: projectId,
      stage_id: stageId,
      is_visible: visible,
    });
    revalidateTracking(projectId, identity.slug);
    return adminActionSuccess(
      visible ? "تم إظهار البند" : "تم إخفاء البند",
      visible
        ? "أصبح البند مرئيًا في صفحة المتابعة العامة."
        : "أصبح البند مخفيًا من صفحة المتابعة العامة.",
      { code: "saved", entityId: itemId },
    );
  } catch (error) {
    return adminActionFailure("تعذر تحديث ظهور البند", errorMessage(error), {
      entityId: itemId,
    });
  }
}

export async function setTrackingUpdatePublicationVisibilityAction(
  projectId: number,
  itemId: number,
  updateId: number,
  published: boolean,
  label: string,
): Promise<AdminActionResult> {
  const actor = await requireAdminSession();
  try {
    const identity = await projectSlug(projectId);
    const { data: update, error: readError } = await getSupabaseAdmin()
      .from("project_tracking_updates")
      .select("title,body,occurred_at,publication_status")
      .eq("item_id", itemId)
      .eq("id", updateId)
      .maybeSingle();
    if (readError) throw readError;
    if (!update) throw new Error("التحديث غير موجود.");
    const media = (await existingMedia(updateId)).map((entry) => ({
      client_key: entry.client_key,
      media_kind: entry.media_kind,
      public_url: entry.public_url,
      poster_url: entry.poster_url,
      title: entry.title,
      sort_order: entry.sort_order,
    }));
    const publicationStatus = published ? "published" : "draft";
    const { error } = await getSupabaseAdmin().rpc("mutate_project_tracking_update", {
      p_project_id: projectId,
      p_item_id: itemId,
      p_actor_id: actor.id,
      p_action: "update",
      p_update_id: updateId,
      p_payload: {
        occurred_at: update.occurred_at,
        title: update.title,
        body: update.body,
        publication_status: publicationStatus,
        media,
      } as Json,
    });
    if (error) throw error;
    await audit(actor, "update", "project_tracking_update", updateId, label, {
      project_id: projectId,
      item_id: itemId,
      publication_status: publicationStatus,
    });
    revalidateTracking(projectId, identity.slug);
    return adminActionSuccess(
      published ? "تم نشر التحديث" : "تم إخفاء التحديث",
      published
        ? "أصبح التحديث ظاهرًا في صفحة المتابعة العامة."
        : "عاد التحديث إلى المسودة واختفى من الصفحة العامة.",
      { code: "saved", entityId: updateId },
    );
  } catch (error) {
    return adminActionFailure("تعذر تحديث نشر التحديث", errorMessage(error), {
      entityId: updateId,
    });
  }
}

async function deleteCommand(input: { kind: "stage" | "item" | "update"; projectId: number; parentId?: number; id: number; label: string }): Promise<AdminActionResult> {
  const actor = await requireAdminSession();
  try {
    const identity = await projectSlug(input.projectId);
    let media: Awaited<ReturnType<typeof existingMedia>> = [];
    if (input.kind === "update") media = await existingMedia(input.id);
    const rpc = input.kind === "stage"
      ? getSupabaseAdmin().rpc("mutate_project_tracking_stage", { p_project_id: input.projectId, p_actor_id: actor.id, p_action: "delete", p_stage_id: input.id, p_payload: {} })
      : input.kind === "item"
        ? getSupabaseAdmin().rpc("mutate_project_tracking_item", { p_project_id: input.projectId, p_stage_id: input.parentId!, p_actor_id: actor.id, p_action: "delete", p_item_id: input.id, p_payload: {} })
        : getSupabaseAdmin().rpc("mutate_project_tracking_update", { p_project_id: input.projectId, p_item_id: input.parentId!, p_actor_id: actor.id, p_action: "delete", p_update_id: input.id, p_payload: {} });
    const { error } = await rpc;
    if (error) throw error;
    const synchronization = input.kind === "update" ? await cleanupDeletedTrackingUpdateMedia(media) : null;
    await audit(actor, "delete", `project_tracking_${input.kind}`, input.id, input.label, { project_id: input.projectId });
    revalidateTracking(input.projectId, identity.slug);
    if (synchronization?.status === "saved_with_media_sync_warning") return adminActionWarning("تم الحذف مع تنبيه وسائط", synchronization.failureReason ?? "تم حذف الربط ويلزم reconciliation.", { code: "saved_with_media_sync_warning", entityId: input.id });
    return adminActionSuccess("تم الحذف", "تم حذف العنصر وفق قواعد سلامة الأبناء. لم يُحذف أي أصل وسائط فعلي.", { code: "deleted", entityId: input.id });
  } catch (error) { return adminActionFailure("تعذر الحذف", errorMessage(error), { entityId: input.id }); }
}
export async function deleteTrackingStageAction(projectId: number, stageId: number, label: string) { return deleteCommand({ kind: "stage", projectId, id: stageId, label }); }
export async function deleteTrackingItemAction(projectId: number, stageId: number, itemId: number, label: string) { return deleteCommand({ kind: "item", projectId, parentId: stageId, id: itemId, label }); }
export async function deleteTrackingUpdateAction(projectId: number, itemId: number, updateId: number, label: string) { return deleteCommand({ kind: "update", projectId, parentId: itemId, id: updateId, label }); }

async function reorder(kind: "stages" | "items", projectId: number, parentId: number | null, ids: number[]): Promise<AdminActionResult> {
  const actor = await requireAdminSession();
  if (!Number.isSafeInteger(projectId) || projectId <= 0 || !ids.length || ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) return adminActionFailure("تعذر إعادة الترتيب", "قائمة الترتيب غير صالحة.");
  try {
    const identity = await projectSlug(projectId);
    const result = kind === "stages"
      ? await getSupabaseAdmin().rpc("reorder_project_tracking_stages", { p_project_id: projectId, p_actor_id: actor.id, p_stage_ids: ids })
      : await getSupabaseAdmin().rpc("reorder_project_tracking_items", { p_project_id: projectId, p_stage_id: parentId!, p_actor_id: actor.id, p_item_ids: ids });
    if (result.error) throw result.error;
    await audit(actor, "reorder", `project_tracking_${kind}`, parentId ?? projectId, identity.arabic_name, { ids });
    revalidateTracking(projectId, identity.slug);
    return adminActionSuccess("تم حفظ الترتيب", "تم تطبيق الترتيب كاملًا وبصورة ذرية.", { code: "saved", entityId: parentId ?? projectId });
  } catch (error) { return adminActionFailure("تعذر إعادة الترتيب", errorMessage(error)); }
}
export async function reorderTrackingStagesAction(projectId: number, ids: number[]) { return reorder("stages", projectId, null, ids); }
export async function reorderTrackingItemsAction(projectId: number, stageId: number, ids: number[]) { return reorder("items", projectId, stageId, ids); }

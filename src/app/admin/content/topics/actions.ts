"use server";

import { revalidatePath } from "next/cache";
import { AsyncLocalStorage } from "node:async_hooks";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import {
  adminActionFailure,
  adminActionSuccess,
  adminActionWarning,
  withAdminActionCacheWarning,
  type AdminActionResult,
} from "../../../../lib/admin/admin-action-result";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import {
  getMediaPublishBlockingChecks,
  mediaRowToPublishInput,
} from "../../../../lib/admin/content-workflow/media-publish-validation";
import {
  getTopicPublishBlockingChecks,
  parseTopicFaq,
  topicRowToPublishInput,
} from "../../../../lib/admin/content-workflow/topic-publish-validation";
import { getContentReleaseTitleQualityCheck } from "../../../../lib/admin/content-workflow/content-review-capability";
import { isContentType } from "../../../../lib/admin/content/content-types";
import {
  ADMIN_CONTENT_ROUTES,
  adminContentTopicPath,
} from "../../../../lib/admin/content-routes";
import { getContentPublicVisibilityState } from "../../../../lib/content-public-visibility";
import {
  revalidateMediaCenterCache,
  revalidateTopicsCache,
  runBoundedPublicCacheRevalidation,
} from "../../../../lib/cache/revalidate-public-cache-tags";
import { revalidateMediaCenterPublicPaths } from "../../../../lib/media-center/revalidate-public-paths";
import {
  TOPICS_COLUMN_CONTRACT_VERSION,
  TOPICS_LIST_VIEW_KEY,
  TOPICS_PREFERENCE_COLUMN_KEYS,
} from "../../../../lib/admin/content/topics-list-config";
import {
  createTopicsBulkPublishSafeMetadata,
  parseTopicsBulkPublishIds,
  parseTopicsBulkPublishRpcResult,
  runTopicsBulkPublishPostCommit,
  type TopicsBulkPublishRpcResult,
} from "../../../../lib/admin/content/topics-bulk-publish";
import { saveAdminColumnPreferences } from "../../../../lib/admin/preferences/admin-column-preferences";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { logError } from "../../../../lib/logging";
import {
  type MediaReferenceSynchronizationResult,
} from "../../../../lib/admin/media-catalog/synchronization";
import {
  isAdminContentSeriesInCategory,
  TOPIC_SERIES_CATEGORY_MISMATCH_MESSAGE,
} from "../../../../lib/admin/content/category-hierarchy";
import { coordinateMediaReferenceEntityMutation } from "../../../../lib/admin/media-catalog/domain-write-coordination";
import { synchronizeMediaReferenceWriteScopesAfterDomainMutation } from "../../../../lib/admin/media-catalog/synchronization";
import {
  getMediaReferenceWriteLeaseUserMessage,
  MediaReferenceWriteLeaseError,
} from "../../../../lib/admin/media-catalog/write-lease";
import { getResourceLinkUsageCount } from "../../../../lib/admin/links/usage";
import type { Tables, TablesUpdate } from "../../../../lib/database.types";
import { parseMediaTopicPayload } from "../../../../lib/admin/media-topic-payload";
import {
  deriveEntitySeoScore,
  toTopicSeoScoreInput,
} from "../../../../lib/admin/seo/entity-seo-persistence";

type TopicCommandIntent = {
  action: string;
  ids: number[] | null;
  categoryId: number | null;
  expectedCount: number | null;
};
type TopicCommandContext = { id: string; attempted: boolean; rejected: boolean; committed: boolean; committedIds?: number[] };
const topicCommandContext = new AsyncLocalStorage<TopicCommandContext>();
const COMMAND_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function topicCommandWasRejected(code: string): boolean {
  // Connection loss and statement/transaction completion-unknown codes cannot
  // prove rollback. Only explicit statement rejection permits a new command.
  return /^(?:22|23|25|28|3D|3F|42|44)[0-9A-Z]{3}$/.test(code) ||
    ["0A000", "40001", "40P01", "55P03", "57014", "P0001", "P0002", "P0003"].includes(code) ||
    /^PGRST[012][0-9]{2}$/.test(code);
}

function unknownTopicCommand(commandId: string): AdminActionResult {
  return { ok: false, feedbackStatus: "warning", completion: "unknown", commandId,
    title: "نتيجة العملية غير مؤكدة",
    message: "لم نتمكن من تأكيد نتيجة الأمر. لا تكرر العملية؛ استعد نتيجتها أو حدّث القائمة للتحقق.",
    code: "completion_unknown", correlationId: commandId };
}

async function readTopicCommandReceipt(actorId: number, commandId: string) {
  const { data, error } = await getSupabaseAdmin().from("admin_audit_logs")
    .select("metadata").eq("actor_admin_user_id", actorId)
    .contains("metadata", { command: { id: commandId } }).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const metadata = data.metadata as Record<string, unknown> | null;
  const command = metadata?.command as { id?: unknown; intent?: TopicCommandIntent; result?: Record<string, unknown> } | undefined;
  const ids = command?.result?.changedIds ?? command?.result?.requestedIds;
  if (command?.id !== commandId || command.result?.ok !== true || !command.intent ||
      !Array.isArray(ids) || !ids.every(id => Number.isSafeInteger(id) && Number(id) > 0)) {
    throw new Error("Invalid topic command receipt");
  }
  return { intent: command.intent, ids: ids as number[] };
}

async function reconcileTopicCommandReceipt(commandId: string, receipt: NonNullable<Awaited<ReturnType<typeof readTopicCommandReceipt>>>): Promise<AdminActionResult> {
  try {
    // Domain writes and their audit are already committed. Only idempotent
    // downstream work is repeated; current domain state is never rewritten.
    let mediaWarning = false;
    if (["permanent_delete", "empty_trash"].includes(receipt.intent.action)) {
      try {
        const media = await synchronizeMediaReferenceWriteScopesAfterDomainMutation(
          [], null, receipt.ids.map(id => ({ domainKey: "topics", entityIdentity: id })),
        );
        mediaWarning = media.status === "saved_with_media_sync_warning";
      } catch { mediaWarning = true; }
    }
    const cache = await runBoundedPublicCacheRevalidation(() => {
      revalidateTopicsCache();
      revalidateMediaCenterCache();
      revalidateMediaCenterPublicPaths();
      revalidatePath("/topics");
      revalidatePath(ADMIN_CONTENT_ROUTES.topics);
      for (const id of receipt.ids) revalidatePath(adminContentTopicPath(id));
    });
    const result = mediaWarning
      ? adminActionWarning("تم تأكيد الحفظ مع تنبيه للميديا", "تم استرداد نتيجة الأمر المحفوظ، وتعذرت مزامنة بعض مراجع الميديا؛ لا تكرر العملية.", { code: "saved_with_media_sync_warning" })
      : adminActionSuccess("تم استرداد نتيجة العملية", "تأكد حفظ الأمر وسجل المراجعة، وأعيد طلب تحديث القراءات دون تكرار العملية.", { code: "saved" });
    return { ...withAdminActionCacheWarning(result, cache.ok), commandId, correlationId: commandId,
      completion: "committed", ...(receipt.ids.length === 1 ? { entityId: receipt.ids[0] } : {}) };
  } catch {
    return adminActionWarning("تم حفظ العملية مع تنبيه", "تأكد حفظ البيانات وسجل المراجعة، لكن تعذر استكمال تحديث القراءات. لا تكرر العملية.", {
      code: "committed_reconciliation_pending", commandId, correlationId: commandId, completion: "committed",
      ...(receipt.ids.length === 1 ? { entityId: receipt.ids[0] } : {}),
    });
  }
}

export async function recoverUnifiedContentCommand(commandId: string): Promise<AdminActionResult> {
  const actor = await requireAdminSession();
  commandId = commandId.toLowerCase();
  if (!COMMAND_ID.test(commandId)) return invalidMutation("معرّف الأمر غير صالح.");
  try {
    const receipt = await readTopicCommandReceipt(actor.id, commandId);
    return receipt ? await reconcileTopicCommandReceipt(commandId, receipt) : unknownTopicCommand(commandId);
  } catch { return unknownTopicCommand(commandId); }
}

async function withTopicCommand(formData: FormData, intent: TopicCommandIntent, run: () => Promise<AdminActionResult>): Promise<AdminActionResult> {
  const actor = await requireAdminSession();
  const commandId = (getString(formData, "command_id") || crypto.randomUUID()).toLowerCase();
  if (!COMMAND_ID.test(commandId)) return invalidMutation("معرّف الأمر غير صالح.");
  const context: TopicCommandContext = { id: commandId, attempted: false, rejected: false, committed: false };
  try {
    const previous = await readTopicCommandReceipt(actor.id, commandId);
    if (previous) {
      const sameIntent = previous.intent.action === intent.action &&
        previous.intent.categoryId === intent.categoryId && previous.intent.expectedCount === intent.expectedCount &&
        JSON.stringify(previous.intent.ids) === JSON.stringify(intent.ids);
      if (!sameIntent) return { ...adminActionFailure("تعارض هوية الأمر", "استُخدمت هوية الأمر لنية مختلفة. نفّذ الإجراء الجديد بهوية جديدة.", { code: "command_conflict" }), commandId, completion: "not_committed" };
      context.committed = true; context.committedIds = previous.ids;
      return await reconcileTopicCommandReceipt(commandId, previous);
    }
    const result = await topicCommandContext.run(context, run);
    if (context.committed && result.ok) return { ...result, commandId, correlationId: result.correlationId ?? commandId, completion: "committed" };
    if (!context.committed && (!context.attempted || context.rejected)) return { ...result, commandId, completion: "not_committed" };
  } catch {
    if (!context.committed && context.rejected) return { ...adminActionFailure("لم تُحفظ العملية", "رفضت قاعدة البيانات الأمر قبل اكتمال الحفظ. لم تتغير البيانات.", { code: "database_failure" }), commandId, completion: "not_committed" };
    if (!context.committed && !context.attempted) return { ...adminActionFailure("تعذر بدء العملية", "تعذر التحقق من سجل الأمر قبل الحفظ. لم تبدأ الكتابة.", { code: "database_failure" }), commandId, completion: "not_committed" };
  }
  if (context.committed && context.committedIds) {
    // A validated RPC acknowledgement already proves this exact receipt. An
    // unexpected downstream failure cannot erase that known commit, even if
    // reading the audit is currently unavailable. Retry reconciliation only.
    return await reconcileTopicCommandReceipt(commandId, { intent, ids: context.committedIds });
  }
  try {
    const receipt = await readTopicCommandReceipt(actor.id, commandId);
    if (receipt) return await reconcileTopicCommandReceipt(commandId, receipt);
  } catch {}
  return unknownTopicCommand(commandId);
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getIds(formData: FormData) {
  return [...new Set(formData.getAll("topic_ids").map(Number))]
    .filter((id) => Number.isInteger(id) && id > 0);
}

async function loadTopic(id: number) {
  const { data } = await getSupabaseAdmin()
    .from("topics")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

type DeletedTopicMutationRow = {
  id: number;
  title: string | null;
  slug: string;
  content_type: string;
  deleted_at: string;
};

type TopicMutationActor = Awaited<ReturnType<typeof requireAdminSession>>;

async function loadDeletedTopics(ids: number[]) {
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select("id,title,slug,content_type,deleted_at")
    .in("id", ids)
    .not("deleted_at", "is", null)
    .order("id", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function loadAllDeletedTopics() {
  const pageSize = 500;
  const rows: DeletedTopicMutationRow[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await getSupabaseAdmin()
      .from("topics")
      .select("id,title,slug,content_type,deleted_at")
      .not("deleted_at", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

function isTopicSlugConflictError(error: { code?: string; message?: string }) {
  return (
    error.code === "23505" ||
    /topics_slug_key|slug/i.test(error.message ?? "")
  );
}

function topicRestoreSlugConflict(slug: string, entityId: number) {
  return adminActionFailure(
    "تعذر استعادة الموضوع",
    `لا يمكن استعادة الموضوع لأن الـSlug \"${slug}\" مستخدم في موضوع نشط آخر. غيّر Slug الموضوع النشط أولًا ثم أعد المحاولة.`,
    { code: "slug_conflict", entityId },
  );
}

async function findActiveTopicSlugConflict(
  topics: DeletedTopicMutationRow[],
) {
  const slugs = [...new Set(topics.map((topic) => topic.slug.trim()))].filter(
    Boolean,
  );
  if (!slugs.length) return null;
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select("id,slug")
    .in("slug", slugs)
    .is("deleted_at", null)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

type PublishPreflightFailure = {
  message: string;
  focusTarget?: string;
};

function getPublishFailure(
  topic: Tables<"topics">,
): PublishPreflightFailure | null {
  const faq = parseTopicFaq(topic.faq);
  if (topic.content_type === "article" && faq === null) {
    return {
      message: "بيانات الأسئلة الشائعة المحفوظة غير صالحة. افتح تبويب الأسئلة الشائعة وأعد حفظها.",
      focusTarget: "topic-faq-editor",
    };
  }
  const publishTopic = {
    ...topic,
    faq: faq ?? [],
    media_payload: parseMediaTopicPayload(topic.media_payload),
  };
  const contentType = publishTopic.content_type;
  if (!isContentType(contentType)) {
    return { message: "نوع المحتوى غير مدعوم." };
  }
  const issue = contentType === "article"
    ? getTopicPublishBlockingChecks(topicRowToPublishInput(publishTopic))[0]
    : (() => {
        const input = mediaRowToPublishInput(publishTopic);
        return input ? getMediaPublishBlockingChecks(input)[0] : null;
      })();
  if (!issue) return null;
  return {
    message: issue.hint,
    focusTarget: issue.correctionTarget?.targetId,
  };
}

function getReleaseTitleQualityFailure(
  topic: Tables<"topics">,
): PublishPreflightFailure | null {
  if (!isContentType(topic.content_type)) return null;
  const issue = getContentReleaseTitleQualityCheck({
    contentType: topic.content_type,
    title: topic.title,
  });
  if (issue.status !== "fail") return null;
  return {
    message: issue.hint,
    focusTarget: issue.correctionTarget?.targetId,
  };
}

function invalidMutation(message = "تعذر تنفيذ العملية."): AdminActionResult {
  return adminActionFailure("تعذر تنفيذ العملية", message);
}

function mapBulkPublishRpcFailure(
  result: Exclude<TopicsBulkPublishRpcResult, { ok: true }>,
): AdminActionResult {
  switch (result.code) {
    case "command_conflict":
      return adminActionFailure("تعارض هوية الأمر", "استُخدمت هوية الأمر لنية مختلفة؛ لم تنفذ النية الجديدة.", { code: "command_conflict" });
    case "invalid_input":
      return adminActionFailure(
        "تعذر نشر المحتوى",
        "بيانات عملية النشر الجماعي غير صالحة.",
        { code: "invalid_input" },
      );
    case "batch_limit":
      return adminActionFailure(
        "تجاوز حد النشر الجماعي",
        `يمكن نشر ${result.limit} عنصرًا كحد أقصى في العملية الواحدة.`,
        { code: "batch_limit" },
      );
    case "duplicate_ids":
      return adminActionFailure(
        "تعذر نشر المحتوى",
        "تحتوي الدفعة على موضوعات مكررة. لم يتم نشر أي عنصر.",
        { code: "duplicate_ids" },
      );
    case "missing_topics":
      return adminActionFailure(
        "تعذر نشر المحتوى",
        "بعض الموضوعات المطلوبة غير موجودة. لم يتم نشر أي عنصر.",
        { code: "missing_topics" },
      );
    case "deleted_topics":
      return adminActionFailure(
        "تعذر نشر المحتوى",
        "بعض الموضوعات المطلوبة موجودة في المحذوفات. لم يتم نشر أي عنصر.",
        { code: "deleted_topics" },
      );
    case "revision_conflict":
      return adminActionFailure(
        "تغير المحتوى أثناء النشر",
        "تغيرت بعض الموضوعات بعد التحقق منها. لم يتم نشر أي عنصر؛ حدّث القائمة وراجع التغييرات.",
        { code: "revision_conflict" },
      );
    case "unauthorized_actor":
      return adminActionFailure(
        "تعذر نشر المحتوى",
        "حساب المشرف الحالي غير مخول لتنفيذ عملية النشر.",
        { code: "unauthorized_actor" },
      );
  }
}

function hasExactTopicIds(expected: readonly number[], actual: readonly number[]) {
  if (expected.length !== actual.length) return false;
  const sortedExpected = [...expected].sort((left, right) => left - right);
  return sortedExpected.every((id, index) => id === actual[index]);
}

type AtomicTopicsBatchAction =
  | "unpublish"
  | "delete"
  | "move_to_trash"
  | "feature"
  | "unfeature"
  | "move_category"
  | "restore"
  | "permanent_delete"
  | "empty_trash";

type AtomicTopicsBatchResult =
  | { ok: true; changedIds: number[] }
  | { ok: false; code: string };

async function runAtomicTopicsBatch(input: {
  actor: TopicMutationActor;
  action: AtomicTopicsBatchAction;
  ids: number[];
  categoryId?: number;
  expectedDeletedCount?: number;
}): Promise<AtomicTopicsBatchResult> {
  const command = topicCommandContext.getStore();
  if (command) command.attempted = true;
  const { data, error } = await getSupabaseAdmin().rpc(
    "admin_mutate_topics_batch_atomically",
    {
      p_actor_id: input.actor.id,
      p_action: input.action,
      p_command_id: command?.id,
      p_topic_ids: input.ids,
      ...(input.categoryId ? { p_category_id: input.categoryId } : {}),
      ...(input.expectedDeletedCount
        ? { p_expected_deleted_count: input.expectedDeletedCount }
        : {}),
    },
  );
  if (command && error && topicCommandWasRejected(error.code)) command.rejected = true;
  if (error?.code === '23503' && error.message.includes('menu_items_linked_')) return { ok: false, code: 'resource_in_use' };
  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("تعذر تأكيد نتيجة العملية الذرية. حدّث القائمة قبل إعادة المحاولة.");
  }
  const result = data as Record<string, unknown>;
  if (result.ok === false && typeof result.code === "string") {
    if (command) command.rejected = true;
    return { ok: false, code: result.code };
  }
  const changedIds = result.changedIds;
  const requestedIds = result.requestedIds;
  if (
    result.ok !== true ||
    !Array.isArray(changedIds) ||
    !Array.isArray(requestedIds) ||
    !changedIds.every((id) => Number.isSafeInteger(id) && id > 0) ||
    !requestedIds.every((id) => Number.isSafeInteger(id) && id > 0) ||
    !hasExactTopicIds(input.ids, changedIds) ||
    !hasExactTopicIds(input.ids, requestedIds)
  ) {
    throw new Error("تعذر تأكيد نتيجة العملية الذرية. حدّث القائمة قبل إعادة المحاولة.");
  }
  if (command) {
    if (result.commandId !== command.id) throw new Error("Missing atomic command receipt");
    command.committed = true;
    command.committedIds = changedIds;
  }
  return { ok: true, changedIds };
}

function atomicTopicsBatchFailure(code: string, title: string): AdminActionResult {
  return adminActionFailure(
    title,
    code === 'resource_in_use'
      ? 'أضيف رابط داخلي إلى أحد الموضوعات قبل اكتمال الحذف. لم يتم حذف أي موضوع؛ أزل الرابط أولًا ثم أعد المحاولة.'
      : code === "revision_conflict"
      ? "تغيرت حالة بعض الموضوعات أثناء التنفيذ؛ لم تتغير المجموعة. حدّث القائمة ثم راجع الاختيار."
      : code === "missing_topics"
        ? "بعض الموضوعات المحددة لم تعد موجودة؛ لم تتغير المجموعة. حدّث القائمة."
        : "تعذر تنفيذ الإجراء على المجموعة كاملة؛ لم تتغير المجموعة. حدّث القائمة وراجع الاختيار.",
    { code: code === "resource_in_use" ? "resource_in_use" : code === "revision_conflict" ? "revision_conflict" : "database_failure" },
  );
}
async function validateBulkCategoryMoveSeries(
  topicIds: number[],
  categoryId: number,
) {
  const { data: topics, error: topicsError } = await getSupabaseAdmin()
    .from("topics")
    .select("id,series_id")
    .in("id", topicIds);
  if (topicsError) throw topicsError;

  const seriesIds = [
    ...new Set(
      (topics ?? [])
        .map((topic) => Number(topic.series_id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
  if (!seriesIds.length) return null;

  const { data: series, error: seriesError } = await getSupabaseAdmin()
    .from("topic_series")
    .select("id,category_id")
    .is("deleted_at", null)
    .in("id", seriesIds);
  if (seriesError) throw seriesError;
  const seriesById = new Map(
    (series ?? []).map((item) => [Number(item.id), item]),
  );
  const conflict = (topics ?? []).find((topic) => {
    if (!topic.series_id) return false;
    const linkedSeries = seriesById.get(Number(topic.series_id));
    return (
      !linkedSeries ||
      !isAdminContentSeriesInCategory(linkedSeries, categoryId)
    );
  });

  return conflict
    ? `${TOPIC_SERIES_CATEGORY_MISMATCH_MESSAGE} تعارض الموضوع رقم ${conflict.id}.`
    : null;
}

function mediaAwareSuccess(
  synchronization: MediaReferenceSynchronizationResult,
  title: string,
  message: string,
  options: { code?: AdminActionResult["code"]; entityId?: number } = {},
) {
  if (synchronization.status === "saved_with_media_sync_warning") {
    return adminActionWarning(
      "تم حفظ المحتوى مع تنبيه للميديا",
      "تم حفظ بيانات المحتوى، لكن تعذرت مزامنة ارتباطات الميديا. يظل الحذف الآمن متوقفًا حتى اكتمال الإصلاح أو الفحص.",
      { code: "saved_with_media_sync_warning", entityId: options.entityId },
    );
  }
  return adminActionSuccess(title, message, options);
}

async function finishMutation(input: {
  actor: Awaited<ReturnType<typeof requireAdminSession>>;
  action:
    | "publish"
    | "unpublish"
    | "update"
    | "delete"
    | "permanent_delete"
    | "restore"
    | "duplicate";
  entityId?: number;
  entityLabel?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const cacheRevalidation = await runBoundedPublicCacheRevalidation(() => {
    revalidateTopicsCache();
    revalidateMediaCenterCache();
    revalidateMediaCenterPublicPaths();
    revalidatePath("/topics");
    revalidatePath(ADMIN_CONTENT_ROUTES.topics);
    if (input.entityId) revalidatePath(adminContentTopicPath(input.entityId));
  });
  if (!topicCommandContext.getStore()?.committed) await recordCmsAdminAudit(
    {
      action: buildCmsAuditAction("topic", input.action),
      entityType: "topic",
      entityId: input.entityId,
      entityLabel: input.entityLabel,
      metadata: input.metadata,
    },
    input.actor,
  );
  return cacheRevalidation;
}

export async function setUnifiedContentStatus(
  formData: FormData,
): Promise<AdminActionResult> {
  const actor = await requireAdminSession();
  const id = Number(getString(formData, "id"));
  if (!Number.isInteger(id) || id <= 0) {
    return invalidMutation();
  }

  const topic = await loadTopic(id);
  if (!topic) return invalidMutation("المحتوى غير موجود أو تم حذفه.");
  const visibility = getContentPublicVisibilityState({
    status: typeof topic.status === "string" ? topic.status : null,
    deletedAt:
      typeof topic.deleted_at === "string" ? topic.deleted_at : null,
  });
  if (!visibility.nextStatus) {
    return adminActionFailure(
      "تعذر نشر المحتوى",
      visibility.tooltip,
      { entityId: id },
    );
  }
  const nextStatus = getString(formData, "next_status");
  if (nextStatus !== visibility.nextStatus) {
    return invalidMutation("تغيرت حالة المحتوى. حدّث الصفحة وحاول مرة أخرى.");
  }

  if (nextStatus === "published") {
    const publishFailure = getPublishFailure(topic);
    if (publishFailure) {
      return adminActionFailure(
        "تعذر نشر المحتوى",
        publishFailure.message,
        {
          code: "publish_validation",
          entityId: id,
          focusTarget: publishFailure.focusTarget,
        },
      );
    }
  }

  const now = new Date().toISOString();
  const payload: TablesUpdate<"topics"> = {
    status: nextStatus,
    updated_at: now,
    updated_by: actor.id,
  };
  if (nextStatus === "published") {
    payload.published_at = topic.published_at || now;
    payload.published_by = actor.id;
  }
  // A status command never restores a topic. Restore is an explicit lifecycle intent.

  const { data: updated, error } = await getSupabaseAdmin().from("topics").update(payload).eq("id", id).eq("status", topic.status).eq("updated_at", topic.updated_at).is("deleted_at", null).select("id").maybeSingle();
  if (error) return invalidMutation(error.message);
  if (updated?.id !== id) return adminActionFailure("تغير المحتوى أثناء التنفيذ", "تغيرت حالة الموضوع أو نسخته قبل الحفظ. حدّث القائمة وراجع أحدث نسخة قبل إعادة المحاولة.", { code: "revision_conflict", entityId: id });

  const cacheRevalidation = await finishMutation({
    actor,
    action: nextStatus === "published" ? "publish" : "unpublish",
    entityId: id,
    entityLabel: String(topic.title ?? ""),
    metadata: { status: nextStatus, content_type: topic.content_type },
  });
  return withAdminActionCacheWarning(adminActionSuccess(
    nextStatus === "published" ? "تم نشر المحتوى" : "تم إخفاء المحتوى",
    nextStatus === "published" ? "أصبح المحتوى ظاهرًا للعامة." : "لم يعد المحتوى ظاهرًا للعامة.",
    { code: nextStatus === "published" ? "published" : "unpublished", entityId: id },
  ), cacheRevalidation.ok);
}

async function toggleUnifiedContentFeaturedImpl(
  formData: FormData,
): Promise<AdminActionResult> {
  const actor = await requireAdminSession();
  const id = Number(getString(formData, "id"));
  if (!Number.isInteger(id) || id <= 0) return invalidMutation();

  const requested = getString(formData, "desired_featured");
  if (requested !== "true" && requested !== "false") {
    return invalidMutation("حدد حالة التمييز المطلوبة صراحةً.");
  }
  const isFeatured = requested === "true";
  const topic = await loadTopic(id);
  if (!topic) return invalidMutation("المحتوى غير موجود أو تم حذفه.");

  const updated = await runAtomicTopicsBatch({ actor, action: isFeatured ? "feature" : "unfeature", ids: [id] });
  if (!updated.ok) return atomicTopicsBatchFailure(updated.code, "تعذر تحديث التمييز");

  const cacheRevalidation = await finishMutation({
    actor,
    action: "update",
    entityId: id,
    entityLabel: String(topic.title ?? ""),
    metadata: { is_featured: isFeatured },
  });
  return withAdminActionCacheWarning(adminActionSuccess(
    "تم تحديث التمييز",
    isFeatured ? "تم تعيين المحتوى كمميز." : "تم إلغاء تمييز المحتوى.",
    { code: isFeatured ? "featured" : "unfeatured", entityId: id },
  ), cacheRevalidation.ok);
}
async function createUniqueCopySlug(baseSlug: string) {
  let candidate = `${baseSlug || "content"}-copy`;
  let suffix = 2;
  while (true) {
    const { count } = await getSupabaseAdmin()
      .from("topics")
      .select("id", { count: "exact", head: true })
      .eq("slug", candidate);
    if (!count) return candidate;
    candidate = `${baseSlug || "content"}-copy-${suffix}`;
    suffix += 1;
  }
}

export async function duplicateUnifiedContent(
  formData: FormData,
): Promise<AdminActionResult> {
  const actor = await requireAdminSession();
  const id = Number(getString(formData, "id"));
  if (!Number.isInteger(id) || id <= 0) return invalidMutation();
  const topic = await loadTopic(id);
  if (!topic) return invalidMutation("المحتوى غير موجود أو تم حذفه.");

  const slug = await createUniqueCopySlug(String(topic.slug ?? "content"));
  const now = new Date().toISOString();
  const {
    id: _id,
    created_at: _createdAt,
    updated_at: _updatedAt,
    created_by: _createdBy,
    updated_by: _updatedBy,
    published_by: _publishedBy,
    views_count: _viewsCount,
    ...copyable
  } = topic;
  void [_id, _createdAt, _updatedAt, _createdBy, _updatedBy, _publishedBy, _viewsCount];

  const nextRow = {
    ...copyable,
    title: `${String(topic.title ?? "بدون عنوان")} - نسخة`,
    slug,
    status: "unpublished",
    published_at: null,
    published_by: null,
    views_count: 0,
    is_featured: false,
    is_popular: false,
    deleted_at: null,
    created_at: now,
    updated_at: now,
    created_by: actor.id,
    updated_by: actor.id,
  };
  const leaseEntityIdentity = `duplicate:${id}:${crypto.randomUUID()}`;
  let coordinated;
  try {
    Object.assign(nextRow, deriveEntitySeoScore(toTopicSeoScoreInput(nextRow)));
    coordinated = await coordinateMediaReferenceEntityMutation({
      domainKey: "topics",
      leaseEntityIdentity,
      intendedRow: nextRow,
      actorId: actor.id,
      requestIdentity: `topic-duplicate:${id}`,
      mutate: async () => {
        const { data, error } = await getSupabaseAdmin()
          .from("topics")
          .insert(nextRow)
          .select("id")
          .single();
        if (error || !data) throw new Error(error?.message ?? "تعذر نسخ المحتوى.");
        return data;
      },
      resolveEntityIdentity: (value) => String(value.id),
    });
  } catch (error) {
    return invalidMutation(
      error instanceof MediaReferenceWriteLeaseError
        ? getMediaReferenceWriteLeaseUserMessage(error.code)
        : error instanceof Error
          ? error.message
          : "تعذر نسخ المحتوى.",
    );
  }
  const data = coordinated?.value;
  if (!data || !Number.isSafeInteger(data.id) || data.id <= 0) {
    return invalidMutation("تعذر تأكيد هوية نسخة المحتوى. حدّث القائمة للتحقق قبل إعادة المحاولة.");
  }
  const mediaSynchronization = coordinated.mediaSynchronization;
  const cacheRevalidation = await finishMutation({
    actor,
    action: "duplicate",
    entityId: data.id,
    entityLabel: `${String(topic.title ?? "بدون عنوان")} - نسخة`,
    metadata: { source_topic_id: id, content_type: topic.content_type },
  });
  return withAdminActionCacheWarning(mediaAwareSuccess(
    mediaSynchronization,
    "تم نسخ المحتوى",
    "أُنشئت نسخة جديدة كغير منشورة.",
    { code: "created", entityId: data.id },
  ), cacheRevalidation.ok);
}

async function softDeleteUnifiedContentImpl(
  formData: FormData,
): Promise<AdminActionResult> {
  const actor = await requireAdminSession();
  const id = Number(getString(formData, "id"));
  if (!Number.isInteger(id) || id <= 0) return invalidMutation();
  const topic = await loadTopic(id);
  if (!topic) return invalidMutation("المحتوى غير موجود أو تم حذفه.");

  const updated = await runAtomicTopicsBatch({ actor, action: "delete", ids: [id] });
  if (!updated.ok) return atomicTopicsBatchFailure(updated.code, "تعذر نقل المحتوى إلى المحذوفات");

  const cacheRevalidation = await finishMutation({
    actor,
    action: "delete",
    entityId: id,
    entityLabel: String(topic.title ?? ""),
    metadata: {
      permanent: false,
      slug: topic.slug,
      slug_retained: true,
    },
  });
  return withAdminActionCacheWarning(adminActionSuccess(
    "تم نقل الموضوع إلى المحذوفات",
    "اختفى الموضوع من القائمة النشطة، وبقي الـSlug محجوزًا حتى الحذف النهائي.",
    { code: "deleted", entityId: id },
  ), cacheRevalidation.ok);
}

async function restoreTopicsWithCanonicalOwner(input: {
  actor: TopicMutationActor;
  ids: number[];
  scope: "single" | "selected";
}): Promise<AdminActionResult> {
  let topics: DeletedTopicMutationRow[];
  try {
    topics = await loadDeletedTopics(input.ids);
  } catch (error) {
    return invalidMutation(error instanceof Error ? error.message : undefined);
  }
  if (topics.length !== input.ids.length) {
    return adminActionFailure(
      "تعذر الاستعادة",
      "بعض الموضوعات المحددة ليست داخل المحذوفات. لم تتم استعادة أي Topic نشط.",
    );
  }

  let slugConflict: { id: number; slug: string } | null;
  try {
    slugConflict = await findActiveTopicSlugConflict(topics);
  } catch (error) {
    return invalidMutation(error instanceof Error ? error.message : undefined);
  }
  if (slugConflict) {
    const topic =
      topics.find((item) => item.slug === slugConflict.slug) ?? topics[0];
    return topicRestoreSlugConflict(topic.slug, topic.id);
  }

  let restored: AtomicTopicsBatchResult;
  try {
    restored = await runAtomicTopicsBatch({
      actor: input.actor,
      action: "restore",
      ids: input.ids,
    });
  } catch (error) {
    if (isTopicSlugConflictError(error as { code?: string; message?: string })) {
      let conflictAfterWrite: { id: number; slug: string } | null = null;
      try {
        conflictAfterWrite = await findActiveTopicSlugConflict(topics);
      } catch {}
      const topic = conflictAfterWrite
        ? topics.find((item) => item.slug === conflictAfterWrite.slug) ?? topics[0]
        : topics[0];
      return topicRestoreSlugConflict(topic.slug, topic.id);
    }
    return adminActionFailure(
      "تعذر تأكيد الاستعادة",
      "تعذر تأكيد نتيجة الاستعادة. حدّث المحذوفات قبل إعادة الطلب.",
      { code: "database_failure" },
    );
  }
  if (!restored.ok) {
    return atomicTopicsBatchFailure(restored.code, "تعذر الاستعادة");
  }
  const singleTopic = input.scope === "single" ? topics[0] : null;
  const cacheRevalidation = await finishMutation({
    actor: input.actor,
    action: "restore",
    entityId: singleTopic?.id,
    entityLabel: singleTopic?.title ?? undefined,
    metadata: {
      bulk: input.scope === "selected",
      bulk_action: input.scope === "selected" ? "restore" : undefined,
      topic_ids: topics.map((topic) => topic.id),
      count: topics.length,
      restored_status: "unpublished",
      ...(singleTopic
        ? {
            slug: singleTopic.slug,
            previous_deleted_at: singleTopic.deleted_at,
          }
        : { slugs: topics.map((topic) => topic.slug) }),
    },
  });

  return withAdminActionCacheWarning(adminActionSuccess(
    input.scope === "single" ? "تمت استعادة الموضوع" : "تمت استعادة المحدد",
    input.scope === "single"
      ? "عاد الموضوع إلى القائمة النشطة كغير منشور."
      : `تمت استعادة ${topics.length} من الموضوعات المحددة كغير منشورة.`,
    {
      code: "restored",
      entityId: singleTopic?.id,
    },
  ), cacheRevalidation.ok);
}

async function permanentlyDeleteTopicsWithCanonicalOwner(input: {
  actor: TopicMutationActor;
  ids: number[];
  scope: "single" | "selected" | "empty_trash";
  expectedTotalDeletedCount?: number;
}): Promise<AdminActionResult> {
  let topics: DeletedTopicMutationRow[];
  try {
    topics = await loadDeletedTopics(input.ids);
  } catch (error) {
    return invalidMutation(error instanceof Error ? error.message : undefined);
  }
  if (topics.length !== input.ids.length) {
    return adminActionFailure(
      "تعذر الحذف النهائي",
      "بعض الموضوعات المحددة ليست داخل المحذوفات. لم يتم حذف أي Topic نشط.",
    );
  }

  for (const topic of topics) {
    let linkUsageCount: number;
    try {
      linkUsageCount = await getResourceLinkUsageCount({
        linkedType: "topics",
        linkedId: topic.id,
      });
    } catch (error) {
      return invalidMutation(
        error instanceof Error
          ? error.message
          : "تعذر فحص روابط الموضوع قبل الحذف النهائي.",
      );
    }
    if (linkUsageCount > 0) {
      return adminActionFailure(
        "تعذر الحذف النهائي",
        `الموضوع «${topic.title || topic.id}» مستخدم في ${linkUsageCount} من الروابط الداخلية. لم يتم حذف أي موضوع.`,
        { entityId: input.scope === "single" ? topic.id : undefined },
      );
    }
  }

  if (input.scope === "empty_trash") {
    const { count, error: countError } = await getSupabaseAdmin()
      .from("topics")
      .select("id", { count: "exact", head: true })
      .not("deleted_at", "is", null);
    if (countError) return invalidMutation(countError.message);
    if (count !== input.expectedTotalDeletedCount) {
      return adminActionFailure(
        "تغير عدد المحذوفات",
        "تغير عدد الموضوعات المحذوفة بعد فتح التأكيد. حدّث الصفحة وراجع العدد قبل المحاولة مرة أخرى.",
      );
    }
  }

  let deleted: AtomicTopicsBatchResult;
  try {
    deleted = await runAtomicTopicsBatch({
      actor: input.actor,
      action: input.scope === "empty_trash" ? "empty_trash" : "permanent_delete",
      ids: input.ids,
      expectedDeletedCount: input.expectedTotalDeletedCount,
    });
  } catch {
    return adminActionFailure(
      "تعذر تأكيد الحذف النهائي",
      "تعذر تأكيد نتيجة الحذف النهائي. حدّث المحذوفات قبل إعادة الطلب.",
      { code: "database_failure" },
    );
  }
  if (!deleted.ok) {
    return atomicTopicsBatchFailure(deleted.code, "تعذر الحذف النهائي");
  }

  const deletedIds = deleted.changedIds;
  const mediaSynchronization =
    await synchronizeMediaReferenceWriteScopesAfterDomainMutation(
      [],
      null,
      deletedIds.map((id) => ({ domainKey: "topics", entityIdentity: id })),
    );
  const singleTopic = input.scope === "single" ? topics[0] : null;
  const cacheRevalidation = await finishMutation({
    actor: input.actor,
    action: "permanent_delete",
    entityId: singleTopic?.id,
    entityLabel: singleTopic?.title ?? undefined,
    metadata: {
      bulk: input.scope !== "single",
      bulk_action:
        input.scope === "selected"
          ? "permanent_delete"
          : input.scope === "empty_trash"
            ? "empty_trash"
            : undefined,
      empty_trash: input.scope === "empty_trash",
      topic_ids: deletedIds,
      count: deletedIds.length,
      permanent: true,
      slug_released: true,
      ...(singleTopic
        ? {
            slug: singleTopic.slug,
            content_type: singleTopic.content_type,
          }
        : {
            slugs: topics.map((topic) => topic.slug),
            content_types: topics.map((topic) => topic.content_type),
          }),
      media_synchronization_status: mediaSynchronization.status,
    },
  });

  const title =
    input.scope === "single"
      ? "تم حذف الموضوع نهائيًا"
      : input.scope === "selected"
        ? "تم الحذف النهائي للمحدد"
        : "تم إفراغ المحذوفات";
  const message =
    input.scope === "single"
      ? `حُذف السجل نهائيًا وأصبح الـSlug \"${topics[0].slug}\" متاحًا للاستخدام.`
      : `تم حذف ${topics.length} من الموضوعات نهائيًا وتحرير الـSlugs الخاصة بها.`;

  if (mediaSynchronization.status === "saved_with_media_sync_warning") {
    return withAdminActionCacheWarning(adminActionWarning(
      `${title} مع تنبيه للميديا`,
      `${message} تعذر إثبات تنظيف بعض مراجع الميديا بالكامل ويلزم فحصها.`,
      {
        code: "saved_with_media_sync_warning",
        entityId: singleTopic?.id,
      },
    ), cacheRevalidation.ok);
  }
  return withAdminActionCacheWarning(adminActionSuccess(title, message, {
    code: "permanently_deleted",
    entityId: singleTopic?.id,
  }), cacheRevalidation.ok);
}

async function restoreUnifiedContentImpl(
  formData: FormData,
): Promise<AdminActionResult> {
  const actor = await requireAdminSession();
  const id = Number(getString(formData, "id"));
  if (!Number.isInteger(id) || id <= 0) return invalidMutation();
  return restoreTopicsWithCanonicalOwner({ actor, ids: [id], scope: "single" });
}

async function permanentlyDeleteUnifiedContentImpl(
  formData: FormData,
): Promise<AdminActionResult> {
  const actor = await requireAdminSession();
  const id = Number(getString(formData, "id"));
  if (!Number.isInteger(id) || id <= 0) return invalidMutation();
  if (getString(formData, "confirm_permanent") !== "true") {
    return adminActionFailure(
      "يلزم تأكيد الحذف النهائي",
      "أكّد الحذف النهائي صراحةً قبل إزالة الموضوع وتحرير الـSlug.",
      { entityId: id },
    );
  }
  return permanentlyDeleteTopicsWithCanonicalOwner({
    actor,
    ids: [id],
    scope: "single",
  });
}

async function emptyUnifiedContentTrashImpl(
  formData: FormData,
): Promise<AdminActionResult> {
  const actor = await requireAdminSession();
  if (getString(formData, "confirm_permanent") !== "true") {
    return adminActionFailure(
      "يلزم تأكيد إفراغ المحذوفات",
      "أكّد الحذف النهائي لكل الموضوعات الموجودة في المحذوفات.",
    );
  }
  const expectedCount = Number(getString(formData, "expected_count"));
  if (!Number.isInteger(expectedCount) || expectedCount <= 0) {
    return invalidMutation("عدد الموضوعات المطلوب حذفها غير صالح.");
  }

  let topics: DeletedTopicMutationRow[];
  try {
    topics = await loadAllDeletedTopics();
  } catch (error) {
    return invalidMutation(error instanceof Error ? error.message : undefined);
  }
  if (topics.length !== expectedCount) {
    return adminActionFailure(
      "تغير عدد المحذوفات",
      `العدد الحالي هو ${topics.length} وليس ${expectedCount}. حدّث الصفحة وراجع العدد قبل المحاولة مرة أخرى.`,
    );
  }

  return permanentlyDeleteTopicsWithCanonicalOwner({
    actor,
    ids: topics.map((topic) => topic.id),
    scope: "empty_trash",
    expectedTotalDeletedCount: expectedCount,
  });
}

async function bulkUpdateUnifiedContentImpl(
  formData: FormData,
): Promise<AdminActionResult> {
  const actor = await requireAdminSession();
  const action = getString(formData, "bulk_action");
  let ids: number[];
  if (action === "publish") {
    const parsedIds = parseTopicsBulkPublishIds(formData.getAll("topic_ids"));
    if (!parsedIds.ok) {
      return mapBulkPublishRpcFailure(parsedIds);
    }
    ids = parsedIds.ids;
  } else {
    ids = getIds(formData);
  }
  if (!ids.length) return invalidMutation("حدد محتوى واحدًا على الأقل.");

  if (action === "restore") {
    return restoreTopicsWithCanonicalOwner({
      actor,
      ids,
      scope: "selected",
    });
  }
  if (action === "permanent_delete") {
    if (getString(formData, "confirm_permanent") !== "true") {
      return adminActionFailure(
        "يلزم تأكيد الحذف النهائي للمحدد",
        "أكّد الحذف النهائي للموضوعات المحددة قبل تحرير الـSlugs.",
      );
    }
    return permanentlyDeleteTopicsWithCanonicalOwner({
      actor,
      ids,
      scope: "selected",
    });
  }

  let atomicAction: AtomicTopicsBatchAction | null = null;
  let categoryId: number | undefined;
  const moveToTrash = action === "delete" || action === "move_to_trash";

  if (action === "publish") {
    const correlationId = crypto.randomUUID();
    const safeMetadata = createTopicsBulkPublishSafeMetadata(
      ids,
      correlationId,
    );
    const { data, error: readError } = await getSupabaseAdmin()
      .from("topics")
      .select("*")
      .in("id", ids);
    if (readError) {
      logError(
        "Topics bulk publish preflight read failed",
        readError,
        safeMetadata,
      );
      return adminActionFailure(
        "تعذر نشر المحتوى",
        "تعذر تأكيد بيانات الموضوعات قبل النشر. لم تبدأ عملية النشر الذرية.",
        { code: "database_failure" },
      );
    }
    const topicsById = new Map(
      (data ?? []).map((topic) => [Number(topic.id), topic] as const),
    );
    const missingTopicIds = ids.filter((id) => !topicsById.has(id));
    if (missingTopicIds.length > 0) {
      return mapBulkPublishRpcFailure({
        ok: false,
        code: "missing_topics",
        topicIds: missingTopicIds,
      });
    }
    const requestedTopics = ids.map((id) => topicsById.get(id)!);
    const deletedTopicIds = requestedTopics
      .filter((topic) => topic.deleted_at !== null)
      .map((topic) => Number(topic.id));
    if (deletedTopicIds.length > 0) {
      return mapBulkPublishRpcFailure({
        ok: false,
        code: "deleted_topics",
        topicIds: deletedTopicIds,
      });
    }
    const topicsToPublish = requestedTopics.filter(
      (topic) => topic.status !== "published",
    );
    const restoreRequired = topicsToPublish.find(
      (topic) =>
        getContentPublicVisibilityState({
          status: topic.status,
          deletedAt: topic.deleted_at,
        }).actionIntent === "restore_required",
    );
    if (restoreRequired) {
      return adminActionFailure(
        "تعذر نشر المحتوى",
        getContentPublicVisibilityState({
          status: restoreRequired.status,
          deletedAt: restoreRequired.deleted_at,
        }).tooltip,
        {
          code: "publish_validation",
          entityId: Number(restoreRequired.id),
        },
      );
    }
    const invalid =
      requestedTopics
        .map((topic) => ({
          topic,
          failure: getReleaseTitleQualityFailure(topic),
        }))
        .find((entry) => entry.failure) ??
      topicsToPublish
        .map((topic) => ({ topic, failure: getPublishFailure(topic) }))
        .find((entry) => entry.failure);
    if (invalid?.failure) {
      return adminActionFailure(
        "تعذر نشر المحتوى",
        invalid.failure.message,
        {
          code: "publish_validation",
          entityId: Number(invalid.topic.id),
          focusTarget: invalid.failure.focusTarget,
        },
      );
    }
    const expectedRevisions = requestedTopics.map((topic) => ({
      id: Number(topic.id),
      expected_updated_at: topic.updated_at,
    }));
    const command = topicCommandContext.getStore();
    if (command) command.attempted = true;
    const { data: rpcPayload, error: publishError } =
      await getSupabaseAdmin().rpc("admin_publish_topics_atomically", {
        p_actor_id: actor.id,
        p_topics: expectedRevisions,
        p_command_id: command?.id,
      });
    if (publishError) {
      if (command && topicCommandWasRejected(publishError.code)) command.rejected = true;
      logError(
        "Topics bulk publish RPC failed",
        publishError,
        safeMetadata,
      );
      return adminActionFailure(
        "تعذر تأكيد نتيجة النشر",
        "تعذر تأكيد نتيجة عملية النشر الذرية. حدّث القائمة قبل تنفيذ إجراء جديد.",
        { code: "database_failure" },
      );
    }

    let publishResult: TopicsBulkPublishRpcResult;
    try {
      publishResult = parseTopicsBulkPublishRpcResult(rpcPayload);
    } catch (error) {
      logError(
        "Topics bulk publish RPC returned an invalid payload",
        error,
        safeMetadata,
      );
      return adminActionFailure(
        "تعذر إثبات نتيجة النشر",
        "عادت عملية النشر بنتيجة غير موثوقة. حدّث القائمة قبل تنفيذ إجراء جديد.",
        { code: "database_failure" },
      );
    }
    if (!publishResult.ok) {
      if (command) command.rejected = true;
      return mapBulkPublishRpcFailure(publishResult);
    }
    if (!hasExactTopicIds(ids, publishResult.requestedIds)) {
      logError(
        "Topics bulk publish RPC result did not match the requested batch",
        undefined,
        safeMetadata,
      );
      return adminActionFailure(
        "تعذر إثبات نتيجة النشر",
        "لا تطابق نتيجة النشر الدفعة المطلوبة. حدّث القائمة قبل تنفيذ إجراء جديد.",
        { code: "database_failure" },
      );
    }

    if (command) {
      if ((rpcPayload as Record<string, unknown>)?.commandId !== command.id) return unknownTopicCommand(command.id);
      command.committed = true;
      command.committedIds = publishResult.requestedIds;
    }

    if (publishResult.publishedIds.length === 0) {
      return adminActionSuccess(
        "المحتوى منشور بالفعل",
        `لم يتغير أي موضوع؛ العناصر المحددة وعددها ${publishResult.alreadyPublishedIds.length} منشورة بالفعل.`,
        { code: "published" },
      );
    }

    const postCommit = await runTopicsBulkPublishPostCommit(
      safeMetadata,
      {
        cacheInvalidations: [
          { name: "topics-cache", run: () => revalidateTopicsCache() },
          {
            name: "media-center-public-paths",
            run: () => revalidateMediaCenterPublicPaths(),
          },
          { name: "topics-public-path", run: () => revalidatePath("/topics") },
          {
            name: "topics-admin-path",
            run: () => revalidatePath(ADMIN_CONTENT_ROUTES.topics),
          },
        ],
        runCacheInvalidation: runBoundedPublicCacheRevalidation,
        logError: (message, error, metadata) =>
          logError(message, error, metadata),
      },
    );
    if (postCommit.feedbackStatus === "warning") {
      return adminActionWarning(
        "تم النشر وتحديث الـCache معلق",
        `تم نشر ${publishResult.publishedIds.length} من عناصر المحتوى، لكن استمر فشل تحديث بعض القراءات المخبأة بعد المحاولة الآمنة المحدودة.`,
        {
          code: "committed_cache_revalidation_pending",
          correlationId: postCommit.correlationId,
        },
      );
    }
    const alreadyPublishedMessage =
      publishResult.alreadyPublishedIds.length > 0
        ? ` وكان ${publishResult.alreadyPublishedIds.length} منشورًا بالفعل دون تغيير.`
        : "";
    return adminActionSuccess(
      "تم نشر المحتوى",
      `تم نشر ${publishResult.publishedIds.length} من عناصر المحتوى بنجاح.${alreadyPublishedMessage}`,
      { code: "published" },
    );
  } else if (
    action === "unpublish" || moveToTrash ||
    action === "feature" || action === "unfeature"
  ) {
    atomicAction = action as AtomicTopicsBatchAction;
  } else if (action === "move_category") {
    const requestedCategoryId = Number(getString(formData, "category_id"));
    const { data: category } = await getSupabaseAdmin()
      .from("topic_categories")
      .select("id,name,slug")
      .eq("id", requestedCategoryId)
      .is("deleted_at", null)
      .eq("is_active", true)
      .maybeSingle();
    if (!category) return invalidMutation("التصنيف المختار غير متاح.");
    try {
      const seriesCategoryError = await validateBulkCategoryMoveSeries(
        ids,
        category.id,
      );
      if (seriesCategoryError) return invalidMutation(seriesCategoryError);
    } catch (error) {
      return invalidMutation(
        error instanceof Error
          ? error.message
          : "تعذر التحقق من توافق السلاسل مع التصنيف.",
      );
    }
    categoryId = category.id;
    atomicAction = "move_category";
  }

  if (!atomicAction) return invalidMutation("الإجراء الجماعي غير صالح.");
  const { data: activeTopics, error: activeTopicsError } =
    await getSupabaseAdmin()
      .from("topics")
      .select("id")
      .in("id", ids)
      .is("deleted_at", null);
  if (activeTopicsError) return invalidMutation(activeTopicsError.message);
  if ((activeTopics ?? []).length !== ids.length) {
    return adminActionFailure(
      "تعذر تنفيذ الإجراء الجماعي",
      "بعض السجلات غير موجودة أو داخل المحذوفات. لم يتم تعديل أي Topic محذوف.",
    );
  }
  let updated: AtomicTopicsBatchResult;
  try {
    updated = await runAtomicTopicsBatch({
      actor,
      action: atomicAction,
      ids,
      categoryId,
    });
  } catch {
    return adminActionFailure(
      "تعذر تأكيد نتيجة الإجراء الجماعي",
      "تعذر تأكيد نتيجة العملية. حدّث القائمة قبل إعادة الطلب.",
      { code: "database_failure" },
    );
  }
  if (!updated.ok) {
    return atomicTopicsBatchFailure(updated.code, "تعذر تنفيذ الإجراء الجماعي");
  }
  const cacheRevalidation = await finishMutation({
    actor,
    action: action === "publish" ? "publish" : action === "unpublish" ? "unpublish" : moveToTrash ? "delete" : "update",
    metadata: {
      bulk_action: action,
      topic_ids: updated.changedIds,
      count: updated.changedIds.length,
      ...(moveToTrash
        ? { permanent: false, slug_retained: true }
        : {}),
    },
  });
  return withAdminActionCacheWarning(adminActionSuccess(
    moveToTrash ? "تم نقل المحتوى إلى المحذوفات" : "تم تحديث المحتوى",
    moveToTrash
      ? `تم نقل ${ids.length} من عناصر المحتوى إلى المحذوفات مع إبقاء الـSlug محجوزًا.`
      : `تم تحديث ${ids.length} من عناصر المحتوى بنجاح.`,
    { code: moveToTrash ? "deleted" : "saved" },
  ), cacheRevalidation.ok);
}

export async function saveContentTablePreferences(visibleColumns: string[]) {
  return saveAdminColumnPreferences({
    viewKey: TOPICS_LIST_VIEW_KEY,
    visibleColumns,
    allowedColumns: TOPICS_PREFERENCE_COLUMN_KEYS,
    contractVersion: TOPICS_COLUMN_CONTRACT_VERSION,
  });
}


export async function toggleUnifiedContentFeatured(formData: FormData): Promise<AdminActionResult> {
  return withTopicCommand(formData, { action: getString(formData, "desired_featured") === "true" ? "feature" : "unfeature", ids: [Number(getString(formData, "id"))], categoryId: null, expectedCount: null }, () => toggleUnifiedContentFeaturedImpl(formData));
}

export async function softDeleteUnifiedContent(formData: FormData): Promise<AdminActionResult> {
  return withTopicCommand(formData, { action: "delete", ids: [Number(getString(formData, "id"))], categoryId: null, expectedCount: null }, () => softDeleteUnifiedContentImpl(formData));
}

export async function restoreUnifiedContent(formData: FormData): Promise<AdminActionResult> {
  return withTopicCommand(formData, { action: "restore", ids: [Number(getString(formData, "id"))], categoryId: null, expectedCount: null }, () => restoreUnifiedContentImpl(formData));
}

export async function permanentlyDeleteUnifiedContent(formData: FormData): Promise<AdminActionResult> {
  return withTopicCommand(formData, { action: "permanent_delete", ids: [Number(getString(formData, "id"))], categoryId: null, expectedCount: null }, () => permanentlyDeleteUnifiedContentImpl(formData));
}

export async function emptyUnifiedContentTrash(formData: FormData): Promise<AdminActionResult> {
  return withTopicCommand(formData, { action: "empty_trash", ids: null, categoryId: null, expectedCount: Number(getString(formData, "expected_count")) }, () => emptyUnifiedContentTrashImpl(formData));
}

export async function bulkUpdateUnifiedContent(formData: FormData): Promise<AdminActionResult> {
  return withTopicCommand(formData, { action: getString(formData, "bulk_action"), ids: getIds(formData).sort((a, b) => a - b), categoryId: getString(formData, "bulk_action") === "move_category" ? Number(getString(formData, "category_id")) : null, expectedCount: null }, () => bulkUpdateUnifiedContentImpl(formData));
}

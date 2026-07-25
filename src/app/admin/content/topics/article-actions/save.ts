"use server";

import type {
  AdminFormActionState,
  AdminFormMode,
} from "../../../../../lib/admin/form-runtime";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import { synchronizeMediaReferencesAfterDomainMutation } from "../../../../../lib/admin/media-catalog/synchronization";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  buildTopicWritePayload,
  getBoolean,
  getNormalizedStatus,
  getPayload,
  preserveImage,
  preserveText,
  uploadTopicImage,
  validateId,
  validateSlug,
} from "./helpers";
import {
  ensureUniqueSlug,
  getCategory,
  getCategoryValidationError,
  getSeries,
  getTopicById,
} from "./validation";
import { revalidateTopicPaths } from "./revalidate";
import type { TopicPayload } from "./helpers";
import type { TopicRow, TopicStatus } from "./types";

type FieldErrors = Record<string, string[]>;

function buildFormFailure(
  mode: AdminFormMode,
  revision: number,
  message: string,
  fieldErrors?: FieldErrors,
): AdminFormActionState {
  const focusTarget = fieldErrors ? Object.keys(fieldErrors)[0] : undefined;
  return {
    status: "error",
    mode,
    revision,
    title: "تعذر حفظ الموضوع",
    message,
    ...(fieldErrors ? { fieldErrors } : {}),
    ...(focusTarget ? { focusTarget } : {}),
  };
}

function addFieldError(
  fieldErrors: FieldErrors,
  field: string,
  message: string,
) {
  fieldErrors[field] = [...(fieldErrors[field] ?? []), message];
}

function hasPartialFaq(formData: FormData) {
  const questions = formData.getAll("faq_question").map(String);
  const answers = formData.getAll("faq_answer").map(String);
  const count = Math.max(questions.length, answers.length);
  return Array.from({ length: count }, (_, index) => ({
    question: questions[index]?.trim() ?? "",
    answer: answers[index]?.trim() ?? "",
  })).some((item) => Boolean(item.question) !== Boolean(item.answer));
}

function validateTopicFields(
  payload: TopicPayload,
  publishing: boolean,
  partialFaq: boolean,
) {
  const fieldErrors: FieldErrors = {};

  if (!payload.title) addFieldError(fieldErrors, "title", "العنوان مطلوب.");
  if (!payload.slug) {
    addFieldError(fieldErrors, "slug", "الرابط مطلوب.");
  } else if (!validateSlug(payload.slug)) {
    addFieldError(
      fieldErrors,
      "slug",
      "استخدم حروفًا إنجليزية صغيرة وأرقامًا وشرطات فقط.",
    );
  }
  if (!payload.categorySlug) {
    addFieldError(fieldErrors, "category_slug", "التصنيف مطلوب.");
  }
  if (partialFaq) {
    addFieldError(
      fieldErrors,
      "faq_question",
      "أكمل السؤال والإجابة لكل عنصر FAQ أو احذف الصف الناقص.",
    );
  }

  if (!publishing) return fieldErrors;

  if (!payload.content.trim()) {
    addFieldError(fieldErrors, "content", "محتوى الموضوع مطلوب قبل النشر.");
  }
  if (payload.excerpt.trim().length < 20) {
    addFieldError(
      fieldErrors,
      "excerpt",
      "الوصف المختصر مطلوب ولا يقل عن 20 حرفًا.",
    );
  }
  if (!payload.image.trim()) {
    addFieldError(fieldErrors, "image", "الصورة الرئيسية مطلوبة.");
  } else if (!payload.imageAlt.trim()) {
    addFieldError(
      fieldErrors,
      "image_alt",
      "وصف الصورة Alt Text مطلوب قبل النشر.",
    );
  }
  if (!payload.focusKeyword.trim()) {
    addFieldError(
      fieldErrors,
      "focus_keyword",
      "Focus Keyword مطلوب قبل النشر.",
    );
  }
  if (!payload.seoTitle.trim()) {
    addFieldError(fieldErrors, "seo_title", "SEO Title مطلوب قبل النشر.");
  } else if (payload.seoTitle.length < 45 || payload.seoTitle.length > 70) {
    addFieldError(
      fieldErrors,
      "seo_title",
      "يجب أن يكون SEO Title بين 45 و70 حرفًا.",
    );
  }
  if (!payload.seoDescription.trim()) {
    addFieldError(
      fieldErrors,
      "seo_description",
      "SEO Description مطلوب قبل النشر.",
    );
  } else if (
    payload.seoDescription.length < 120 ||
    payload.seoDescription.length > 170
  ) {
    addFieldError(
      fieldErrors,
      "seo_description",
      "يجب أن يكون SEO Description بين 120 و170 حرفًا.",
    );
  }

  return fieldErrors;
}

function resolveRequestedStatus(options: {
  mode: AdminFormMode;
  currentTopic: TopicRow | null;
  publishRequested: boolean;
}): TopicStatus {
  const { mode, currentTopic, publishRequested } = options;
  if (mode === "create") return publishRequested ? "published" : "draft";

  const currentStatus = getNormalizedStatus(
    String(currentTopic?.status ?? "draft"),
    "draft",
  );
  if (currentStatus === "archived") return "archived";
  if (publishRequested) return "published";
  if (
    currentStatus === "published" ||
    currentStatus === "unpublished" ||
    Boolean(currentTopic?.published_by)
  ) {
    return "unpublished";
  }
  return "draft";
}

function successMessage(mode: AdminFormMode, status: TopicStatus) {
  if (mode === "create") {
    return status === "published"
      ? "تم إنشاء الموضوع ونشره بنجاح."
      : "تم إنشاء الموضوع كمسودة بنجاح.";
  }
  if (status === "published") return "تم حفظ الموضوع ونشره بنجاح.";
  if (status === "unpublished") {
    return "تم حفظ الموضوع وإخفاؤه مع الاحتفاظ بتاريخ أول نشر.";
  }
  if (status === "archived") {
    return "تم حفظ بيانات الموضوع دون تغيير حالة الأرشفة.";
  }
  return "تم حفظ تعديلات الموضوع بنجاح.";
}

function auditOperation(
  mode: AdminFormMode,
  currentStatus: TopicStatus | null,
  nextStatus: TopicStatus,
) {
  if (mode === "create") return nextStatus === "published" ? "publish" : "create";
  if (nextStatus === "published" && currentStatus !== "published") {
    return "publish";
  }
  if (currentStatus === "published" && nextStatus === "unpublished") {
    return "unpublish";
  }
  return "update";
}

export async function saveTopicForm(
  previousState: AdminFormActionState,
  formData: FormData,
): Promise<AdminFormActionState> {
  const actor = await requireAdminSession();
  const rawId = formData.get("id");
  const id = typeof rawId === "string" ? rawId.trim() : "";
  const mode: AdminFormMode = id ? "edit" : "create";
  const revision = previousState.revision + 1;
  const formFailure = (message: string, fieldErrors?: FieldErrors) =>
    buildFormFailure(mode, revision, message, fieldErrors);

  if (mode === "edit" && !validateId(id)) {
    return formFailure("معرّف الموضوع غير صالح.");
  }

  const currentTopic = mode === "edit" ? await getTopicById(id) : null;
  if (mode === "edit" && !currentTopic) {
    return formFailure("الموضوع غير موجود أو تعذر تحميله.");
  }

  const payload = getPayload(formData);
  const partialFaq = hasPartialFaq(formData);
  const publishRequested = getBoolean(formData, "is_published");
  const nextStatus = resolveRequestedStatus({
    mode,
    currentTopic,
    publishRequested,
  });

  const baseErrors = validateTopicFields(payload, false, partialFaq);
  if (Object.keys(baseErrors).length) {
    return formFailure("راجع الحقول الموضحة ثم حاول مرة أخرى.", baseErrors);
  }

  const isUniqueSlug = await ensureUniqueSlug(payload.slug, id || undefined);
  if (!isUniqueSlug) {
    return formFailure("هذا الـ Slug مستخدم بالفعل في موضوع آخر.", {
      slug: ["اختر Slug مختلفًا."],
    });
  }

  const category = await getCategory(
    payload.categorySlug,
    currentTopic?.category_slug,
  );
  if (!category) {
    const categoryError = await getCategoryValidationError(
      payload.categorySlug,
      currentTopic?.category_slug,
    );
    const message =
      categoryError ?? "التصنيف المختار غير موجود أو غير مفعل.";
    return formFailure(message, { category_slug: [message] });
  }

  const series = await getSeries(payload.seriesId, currentTopic?.series_id);
  if (payload.seriesId && !series) {
    return formFailure("السلسلة المختارة غير موجودة.", {
      series_id: ["اختر سلسلة متاحة أو اترك الحقل فارغًا."],
    });
  }

  if (currentTopic) {
    payload.image = preserveImage(
      payload.image,
      String(currentTopic.image ?? ""),
      payload.imageFieldPresent,
    );
    payload.imageAlt = preserveText(
      payload.imageAlt,
      String(currentTopic.image_alt ?? ""),
    );
    if (currentTopic.date_label) {
      payload.dateLabel = currentTopic.date_label;
    }
  }

  const pendingImageFile = formData.get("image_file");
  const hasPendingImageUpload =
    pendingImageFile instanceof File && pendingImageFile.size > 0;
  const publishErrors = validateTopicFields(
    hasPendingImageUpload ? { ...payload, image: "pending-upload" } : payload,
    nextStatus === "published",
    partialFaq,
  );
  if (Object.keys(publishErrors).length) {
    return formFailure(
      "تعذر النشر. أكمل الحقول المطلوبة ثم احفظ مرة أخرى.",
      publishErrors,
    );
  }

  try {
    payload.image = await uploadTopicImage(formData, payload.slug);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "تعذر رفع الصورة.";
    return formFailure(message, { image: [message] });
  }

  if (currentTopic) {
    payload.image = preserveImage(
      payload.image,
      String(currentTopic.image ?? ""),
      payload.imageFieldPresent,
    );
    payload.imageAlt = preserveText(
      payload.imageAlt,
      String(currentTopic.image_alt ?? ""),
    );
    if (currentTopic.date_label) {
      payload.dateLabel = currentTopic.date_label;
    }
  }

  const now = new Date().toISOString();
  const currentStatus = currentTopic
    ? getNormalizedStatus(String(currentTopic.status ?? "draft"), "draft")
    : null;
  const writePayload = buildTopicWritePayload(
    payload,
    category,
    series,
    nextStatus,
    now,
    currentTopic,
  );

  let entityId: number;
  let savedSlug: string;

  if (mode === "create") {
    const { data, error } = await getSupabaseAdmin()
      .from("topics")
      .insert({
        ...writePayload,
        created_at: now,
        created_by: actor.id,
        updated_by: actor.id,
        published_by: nextStatus === "published" ? actor.id : null,
      })
      .select("id, slug")
      .single<{ id: number; slug: string }>();
    if (error || !data) {
      return formFailure(
        error?.message ?? "تعذر إنشاء الموضوع. راجع قاعدة البيانات.",
      );
    }
    entityId = data.id;
    savedSlug = data.slug;
  } else {
    const { data, error } = await getSupabaseAdmin()
      .from("topics")
      .update({
        ...writePayload,
        updated_by: actor.id,
        ...(nextStatus === "published" && currentStatus !== "published"
          ? { published_by: actor.id }
          : {}),
      })
      .eq("id", id)
      .select("id, slug")
      .maybeSingle<{ id: number; slug: string }>();
    if (error || !data) {
      return formFailure(error?.message ?? "تعذر تحديث الموضوع.");
    }
    entityId = data.id;
    savedSlug = data.slug;
  }

  await synchronizeMediaReferencesAfterDomainMutation("topics", entityId);

  revalidateTopicPaths({
    id: entityId,
    oldSlug: currentTopic?.slug,
    newSlug: savedSlug,
  });

  await recordCmsAdminAudit(
    {
      action: buildCmsAuditAction(
        "topic",
        auditOperation(mode, currentStatus, nextStatus),
      ),
      entityType: "topic",
      entityId,
      entityLabel: payload.title,
      metadata: { slug: savedSlug, status: nextStatus },
    },
    actor,
  );

  return {
    status: "success",
    revision,
    title: "تم الحفظ بنجاح",
    message: successMessage(mode, nextStatus),
    code:
      mode === "create"
        ? nextStatus === "published"
          ? "published"
          : "created"
        : nextStatus,
    entityId,
    mode,
    ...(mode === "create"
      ? { editHref: `/admin/content/topics/${entityId}` }
      : {}),
    savedRevision: `${entityId}:${now}`,
  };
}

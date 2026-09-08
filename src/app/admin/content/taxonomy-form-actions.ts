"use server";

import { revalidatePath } from "next/cache";

import type {
  AdminFormActionState,
  AdminFormMode,
} from "../../../lib/admin/form-runtime";
import { requireAdminSession } from "../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../lib/admin/audit-log";
import {
  getDeterministicAdminTone,
} from "../../../lib/admin/content/admin-tone-palette";
import {
  categoryTaxonomyFormInput,
  categoryTaxonomyFormSchema,
  flattenTaxonomyValidationErrors,
  parseTaxonomyExpectedRevision,
  seriesTaxonomyFormInput,
  seriesTaxonomyFormSchema,
  taxonomyFormDataValue,
} from "../../../lib/admin/content/taxonomy-form-validation";
import {
  createTopicSeriesAtomically,
  updateTopicCategoryAtomically,
  updateTopicSeriesAtomically,
} from "../../../lib/admin/content/taxonomy-mutations";
import { revalidateTopicsCache } from "../../../lib/cache/revalidate-public-cache-tags";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import { TOPIC_SERIES_CATEGORY_MISMATCH_MESSAGE } from "../../../lib/admin/content/category-hierarchy";

type DatabaseErrorLike = {
  code?: string;
  message?: string;
};

type TaxonomyMutationFailureCode =
  | "invalid_input"
  | "unauthorized_actor"
  | "not_found"
  | "revision_conflict"
  | "parent_unavailable"
  | "hierarchy_cycle"
  | "category_unavailable";

async function getSeriesCategoryChangeError(
  seriesId: number,
  currentCategoryId: number | null,
  nextCategoryId: number,
) {
  if (currentCategoryId === nextCategoryId) return null;

  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select("id,category_id")
    .eq("series_id", seriesId);
  if (error) throw error;

  const conflict = (data ?? []).find(
    (topic) => topic.category_id !== nextCategoryId,
  );
  return conflict
    ? `${TOPIC_SERIES_CATEGORY_MISMATCH_MESSAGE} انقل أو أزل ارتباط الموضوع رقم ${conflict.id} أولًا.`
    : null;
}

function buildFormFailure(
  mode: AdminFormMode,
  revision: number,
  message: string,
  fieldErrors?: Record<string, string[]>,
  code?: string,
): AdminFormActionState {
  const focusTarget = fieldErrors
    ? Object.entries(fieldErrors).find(([, messages]) => messages.length > 0)?.[0]
    : undefined;
  return {
    status: "error",
    mode,
    revision,
    title: "تعذر حفظ البيانات",
    message,
    ...(code ? { code } : {}),
    ...(focusTarget ? { focusTarget } : {}),
    ...(fieldErrors ? { fieldErrors } : {}),
  };
}

function buildFormSuccess(
  mode: AdminFormMode,
  revision: number,
  message: string,
  code: "created" | "updated",
  entityId: number,
  editHref: string,
  savedRevision: string,
): AdminFormActionState {
  return {
    status: "success",
    revision,
    title: "تم الحفظ بنجاح",
    message,
    code,
    entityId,
    mode,
    ...(code === "created" ? { editHref } : {}),
    savedRevision,
  };
}

function buildTaxonomyMutationFailure(
  mode: AdminFormMode,
  revision: number,
  code: TaxonomyMutationFailureCode,
): AdminFormActionState {
  switch (code) {
    case "revision_conflict":
      return buildFormFailure(
        mode,
        revision,
        "تم تعديل السجل من جلسة أخرى. راجع تغييراتك ثم أعد تحميل الصفحة قبل المحاولة مجددًا.",
        undefined,
        code,
      );
    case "not_found":
      return buildFormFailure(
        mode,
        revision,
        "السجل لم يعد موجودًا. أعد تحميل الصفحة قبل المتابعة.",
        undefined,
        code,
      );
    case "parent_unavailable":
      return buildFormFailure(
        mode,
        revision,
        "التصنيف الأب المحدد لم يعد متاحًا.",
        { parent_id: ["اختر تصنيفًا أب متاحًا."] },
        code,
      );
    case "hierarchy_cycle":
      return buildFormFailure(
        mode,
        revision,
        "لا يمكن نقل التصنيف داخل نفسه أو داخل أحد فروعه.",
        { parent_id: ["اختر موضعًا لا ينشئ دورة هرمية."] },
        code,
      );
    case "category_unavailable":
      return buildFormFailure(
        mode,
        revision,
        "التصنيف المحدد غير موجود أو غير متاح للنشر.",
        { category_id: ["اختر تصنيفًا منشورًا ومتاحًا."] },
        code,
      );
    case "unauthorized_actor":
      return buildFormFailure(
        mode,
        revision,
        "تعذر إثبات صلاحية الجلسة الإدارية. أعد تسجيل الدخول ثم حاول مرة أخرى.",
        undefined,
        code,
      );
    case "invalid_input":
      return buildFormFailure(
        mode,
        revision,
        "بيانات الحفظ غير صالحة. راجع الحقول ثم حاول مرة أخرى.",
        undefined,
        code,
      );
  }
}

function buildExpectedRevisionFailure(
  mode: AdminFormMode,
  revision: number,
  reason: "missing" | "invalid",
): AdminFormActionState {
  const missing = reason === "missing";
  return buildFormFailure(
    mode,
    revision,
    missing
      ? "تعذر إثبات نسخة السجل المفتوحة. أعد تحميل الصفحة قبل الحفظ."
      : "نسخة السجل المفتوحة غير صالحة. أعد تحميل الصفحة قبل الحفظ.",
    undefined,
    missing ? "revision_missing" : "revision_invalid",
  );
}

function getDatabaseError(error: unknown): DatabaseErrorLike {
  return error && typeof error === "object"
    ? (error as DatabaseErrorLike)
    : {};
}

function buildDatabaseFormFailure(
  mode: AdminFormMode,
  revision: number,
  error: unknown,
  fallback: string,
) {
  const databaseError = getDatabaseError(error);
  if (databaseError.code === "23505") {
    return buildFormFailure(mode, revision, "هذا الـ Slug مستخدم بالفعل.", {
      slug: ["اختر Slug مختلفًا."],
    });
  }
  if (databaseError.code === "23503") {
    return buildFormFailure(mode, revision, "العلاقة المحددة لم تعد موجودة. حدّث الصفحة وحاول مرة أخرى.");
  }
  if (databaseError.code === "22023" || databaseError.code === "P0001") {
    return buildFormFailure(mode, revision, databaseError.message || fallback);
  }
  return buildFormFailure(mode, revision, fallback);
}

function revalidateTaxonomyPaths(editPath: string) {
  revalidateTopicsCache();
  revalidatePath("/admin/content/categories");
  revalidatePath("/admin/content/categories/new");
  revalidatePath("/admin/content/series");
  revalidatePath("/admin/content/series/new");
  revalidatePath("/admin/content/topics");
  revalidatePath("/admin/content/topics/new");
  revalidatePath("/topics");
  revalidatePath(editPath);
}

async function slugExists(
  table: "topic_categories" | "topic_series",
  slug: string,
) {
  const { data, error } = await getSupabaseAdmin()
    .from(table)
    .select("id")
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function validateCategoryParent(parentId: number | null, currentId?: number) {
  if (!parentId) return null;
  if (currentId && parentId === currentId) {
    return "لا يمكن جعل التصنيف أبًا لنفسه.";
  }

  const { data, error } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("id, parent_id")
    .is("deleted_at", null);
  if (error) throw error;

  const rows = data ?? [];
  if (!rows.some((row) => row.id === parentId)) {
    return "التصنيف الأب غير موجود.";
  }
  if (!currentId) return null;

  const children = new Map<number, number[]>();
  for (const row of rows) {
    if (!row.parent_id) continue;
    children.set(row.parent_id, [...(children.get(row.parent_id) ?? []), row.id]);
  }
  const blocked = new Set<number>([currentId]);
  const stack = [...(children.get(currentId) ?? [])];
  while (stack.length) {
    const id = stack.pop();
    if (!id || blocked.has(id)) continue;
    blocked.add(id);
    stack.push(...(children.get(id) ?? []));
  }
  return blocked.has(parentId)
    ? "لا يمكن نقل التصنيف داخل أحد فروعه."
    : null;
}

async function validateSeriesCategory(
  categoryId: number,
  currentCategoryId?: number | null,
) {
  const { data, error } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("id, is_active, status")
    .eq("id", categoryId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return "التصنيف المحدد غير موجود.";
  if (
    data.id !== currentCategoryId &&
    (data.is_active !== true || data.status !== "published")
  ) {
    return "لا يمكن ربط السلسلة بتصنيف غير منشور.";
  }
  return null;
}

export async function createCategoryForm(
  _previousState: AdminFormActionState,
  formData: FormData,
): Promise<AdminFormActionState> {
  const mode: AdminFormMode = "create";
  const revision = _previousState.revision + 1;
  const formFailure = (message: string, fieldErrors?: Record<string, string[]>) =>
    buildFormFailure(mode, revision, message, fieldErrors);
  const formSuccess = (message: string, code: "created" | "updated", entityId: number, editHref: string, savedRevision: string) =>
    buildFormSuccess(mode, revision, message, code, entityId, editHref, savedRevision);
  const databaseFormFailure = (error: unknown, fallback: string) =>
    buildDatabaseFormFailure(mode, revision, error, fallback);
  const actor = await requireAdminSession();
  const parsed = categoryTaxonomyFormSchema.safeParse(
    categoryTaxonomyFormInput(formData),
  );
  if (!parsed.success) {
    return formFailure(
      "راجع الحقول الموضحة ثم حاول مرة أخرى.",
      flattenTaxonomyValidationErrors(parsed.error),
    );
  }

  try {
    const parentError = await validateCategoryParent(parsed.data.parent_id);
    if (parentError) return formFailure(parentError, { parent_id: [parentError] });
    if (await slugExists("topic_categories", parsed.data.slug)) {
      return formFailure("هذا الـ Slug مستخدم في تصنيف آخر.", {
        slug: ["اختر Slug مختلفًا."],
      });
    }

    const now = new Date().toISOString();
    const colorToken =
      parsed.data.color_token ?? getDeterministicAdminTone(parsed.data.slug);
    const { data, error } = await getSupabaseAdmin()
      .from("topic_categories")
      .insert({
        name: parsed.data.name,
        slug: parsed.data.slug,
        parent_id: parsed.data.parent_id,
        is_active: parsed.data.is_published,
        status: parsed.data.is_published ? "published" : "unpublished",
        color_token: colorToken,
        sort_order: 0,
        show_in_menu: true,
        is_featured: false,
        created_at: now,
        updated_at: now,
      })
      .select("id, published_at")
      .single();
    if (error) throw error;

    await recordCmsAdminAudit(
      {
        action: buildCmsAuditAction("topic_category", "create"),
        entityType: "topic_category",
        entityId: data.id,
        entityLabel: parsed.data.name,
        metadata: {
          slug: parsed.data.slug,
          parent_id: parsed.data.parent_id,
          color_token: colorToken,
          published_at: data.published_at,
        },
      },
      actor,
    );
    revalidateTaxonomyPaths(`/admin/content/categories/${data.id}`);
    return formSuccess(
      "تم إنشاء التصنيف بنجاح.",
      "created",
      data.id,
      `/admin/content/categories/${data.id}`,
      now,
    );
  } catch (error) {
    return databaseFormFailure(error, "تعذر إنشاء التصنيف. حاول مرة أخرى.");
  }
}

export async function updateCategoryForm(
  _previousState: AdminFormActionState,
  formData: FormData,
): Promise<AdminFormActionState> {
  const mode: AdminFormMode = "edit";
  const revision = _previousState.revision + 1;
  const formFailure = (message: string, fieldErrors?: Record<string, string[]>) =>
    buildFormFailure(mode, revision, message, fieldErrors);
  const formSuccess = (message: string, code: "created" | "updated", entityId: number, editHref: string, savedRevision: string) =>
    buildFormSuccess(mode, revision, message, code, entityId, editHref, savedRevision);
  const databaseFormFailure = (error: unknown, fallback: string) =>
    buildDatabaseFormFailure(mode, revision, error, fallback);
  const actor = await requireAdminSession();
  const id = Number(taxonomyFormDataValue(formData, "id"));
  if (!Number.isInteger(id) || id <= 0) {
    return formFailure("معرّف التصنيف غير صالح.");
  }
  const expectedRevision = parseTaxonomyExpectedRevision(formData);
  if (!expectedRevision.ok) {
    return buildExpectedRevisionFailure(
      mode,
      revision,
      expectedRevision.reason,
    );
  }

  const { data: current, error: currentError } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("id, slug, status")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (currentError || !current) {
    return formFailure("التصنيف غير موجود أو تعذر تحميله.");
  }

  // Slugs are immutable after the first save. Ignore any tampered form value.
  const rawInput = categoryTaxonomyFormInput(formData);
  const parsed = categoryTaxonomyFormSchema.safeParse({
    ...rawInput,
    slug: current.slug,
  });
  if (!parsed.success) {
    return formFailure(
      "راجع الحقول الموضحة ثم حاول مرة أخرى.",
      flattenTaxonomyValidationErrors(parsed.error),
    );
  }

  try {
    const parentError = await validateCategoryParent(parsed.data.parent_id, id);
    if (parentError) return formFailure(parentError, { parent_id: [parentError] });
    const colorToken =
      parsed.data.color_token ?? getDeterministicAdminTone(current.slug);
    const mutation = await updateTopicCategoryAtomically({
      id,
      name: parsed.data.name,
      parentId: parsed.data.parent_id,
      isActive: parsed.data.is_published,
      colorToken,
      actorId: actor.id,
      expectedUpdatedAt: expectedRevision.value,
    });
    if (!mutation.ok) {
      return buildTaxonomyMutationFailure(mode, revision, mutation.code);
    }
    const nextStatus = parsed.data.is_published
      ? "published"
      : "unpublished";
    const auditVerb =
      current.status !== "published" && nextStatus === "published"
        ? "publish"
        : current.status === "published" && nextStatus === "unpublished"
          ? "unpublish"
          : "update";

    await recordCmsAdminAudit(
      {
        action: buildCmsAuditAction("topic_category", auditVerb),
        entityType: "topic_category",
        entityId: id,
        entityLabel: parsed.data.name,
        metadata: {
          slug: current.slug,
          parent_id: parsed.data.parent_id,
          color_token: colorToken,
          status: nextStatus,
          published_at: mutation.category.published_at,
        },
      },
      actor,
    );
    revalidateTaxonomyPaths(`/admin/content/categories/${id}`);
    return formSuccess(
      "تم تحديث التصنيف بنجاح.",
      "updated",
      id,
      `/admin/content/categories/${id}`,
      mutation.category.updated_at,
    );
  } catch (error) {
    return databaseFormFailure(error, "تعذر تحديث التصنيف. حاول مرة أخرى.");
  }
}

export async function createSeriesForm(
  _previousState: AdminFormActionState,
  formData: FormData,
): Promise<AdminFormActionState> {
  const mode: AdminFormMode = "create";
  const revision = _previousState.revision + 1;
  const formFailure = (message: string, fieldErrors?: Record<string, string[]>) =>
    buildFormFailure(mode, revision, message, fieldErrors);
  const formSuccess = (message: string, code: "created" | "updated", entityId: number, editHref: string, savedRevision: string) =>
    buildFormSuccess(mode, revision, message, code, entityId, editHref, savedRevision);
  const databaseFormFailure = (error: unknown, fallback: string) =>
    buildDatabaseFormFailure(mode, revision, error, fallback);
  const actor = await requireAdminSession();
  const parsed = seriesTaxonomyFormSchema.safeParse(
    seriesTaxonomyFormInput(formData),
  );
  if (!parsed.success) {
    return formFailure(
      "راجع الحقول الموضحة ثم حاول مرة أخرى.",
      flattenTaxonomyValidationErrors(parsed.error),
    );
  }

  try {
    const status = parsed.data.is_published ? "published" : "unpublished";
    const mutation = await createTopicSeriesAtomically({
      name: parsed.data.name,
      slug: parsed.data.slug,
      categoryId: parsed.data.category_id,
      status,
      actorId: actor.id,
    });
    if (!mutation.ok) {
      return buildTaxonomyMutationFailure(mode, revision, mutation.code);
    }

    // This remains the canonical audit owner; it records only after the RPC's
    // governing result is ok:true and internally contains audit write failures.
    await recordCmsAdminAudit(
      {
        action: buildCmsAuditAction("topic_series", "create"),
        entityType: "topic_series",
        entityId: mutation.series.id,
        entityLabel: parsed.data.name,
        metadata: { slug: parsed.data.slug, status, category_id: parsed.data.category_id },
      },
      actor,
    );
    revalidateTaxonomyPaths(`/admin/content/series/${mutation.series.id}`);
    return formSuccess(
      "تم إنشاء السلسلة بنجاح.",
      "created",
      mutation.series.id,
      `/admin/content/series/${mutation.series.id}`,
      mutation.series.updated_at,
    );
  } catch (error) {
    return databaseFormFailure(error, "تعذر إنشاء السلسلة. حاول مرة أخرى.");
  }
}

export async function updateSeriesForm(
  _previousState: AdminFormActionState,
  formData: FormData,
): Promise<AdminFormActionState> {
  const mode: AdminFormMode = "edit";
  const revision = _previousState.revision + 1;
  const formFailure = (message: string, fieldErrors?: Record<string, string[]>) =>
    buildFormFailure(mode, revision, message, fieldErrors);
  const formSuccess = (message: string, code: "created" | "updated", entityId: number, editHref: string, savedRevision: string) =>
    buildFormSuccess(mode, revision, message, code, entityId, editHref, savedRevision);
  const databaseFormFailure = (error: unknown, fallback: string) =>
    buildDatabaseFormFailure(mode, revision, error, fallback);
  const actor = await requireAdminSession();
  const id = Number(taxonomyFormDataValue(formData, "id"));
  if (!Number.isInteger(id) || id <= 0) {
    return formFailure("معرّف السلسلة غير صالح.");
  }
  const expectedRevision = parseTaxonomyExpectedRevision(formData);
  if (!expectedRevision.ok) {
    return buildExpectedRevisionFailure(
      mode,
      revision,
      expectedRevision.reason,
    );
  }

  const { data: current, error: currentError } = await getSupabaseAdmin()
    .from("topic_series")
    .select("id, slug, status, category_id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (currentError || !current) {
    return formFailure("السلسلة غير موجودة أو تعذر تحميلها.");
  }

  // Slugs are immutable after the first save. Ignore any tampered form value.
  const rawInput = seriesTaxonomyFormInput(formData);
  const parsed = seriesTaxonomyFormSchema.safeParse({
    ...rawInput,
    slug: current.slug,
  });
  if (!parsed.success) {
    return formFailure(
      "راجع الحقول الموضحة ثم حاول مرة أخرى.",
      flattenTaxonomyValidationErrors(parsed.error),
    );
  }

  try {
    const categoryError = await validateSeriesCategory(
      parsed.data.category_id,
      current.category_id,
    );
    if (categoryError) {
      return formFailure(categoryError, { category_id: [categoryError] });
    }
    const seriesCategoryError = await getSeriesCategoryChangeError(
      id,
      current.category_id,
      parsed.data.category_id,
    );
    if (seriesCategoryError) {
      return formFailure(seriesCategoryError, {
        category_id: [seriesCategoryError],
      });
    }
    const status = parsed.data.is_published ? "published" : "unpublished";
    const mutation = await updateTopicSeriesAtomically({
      id,
      name: parsed.data.name,
      categoryId: parsed.data.category_id,
      status,
      actorId: actor.id,
      expectedUpdatedAt: expectedRevision.value,
    });
    if (!mutation.ok) {
      return buildTaxonomyMutationFailure(mode, revision, mutation.code);
    }

    await recordCmsAdminAudit(
      {
        action: buildCmsAuditAction("topic_series", "update"),
        entityType: "topic_series",
        entityId: id,
        entityLabel: parsed.data.name,
        metadata: {
          slug: current.slug,
          status,
          category_id: parsed.data.category_id,
        },
      },
      actor,
    );
    revalidateTaxonomyPaths(`/admin/content/series/${id}`);
    return formSuccess(
      "تم تحديث السلسلة بنجاح.",
      "updated",
      id,
      `/admin/content/series/${id}`,
      mutation.series.updated_at,
    );
  } catch (error) {
    return databaseFormFailure(error, "تعذر تحديث السلسلة. حاول مرة أخرى.");
  }
}

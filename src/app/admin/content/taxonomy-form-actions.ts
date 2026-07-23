"use server";

import { revalidatePath } from "next/cache";

import type { AdminFormActionState } from "../../../lib/admin/form-runtime";
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
  seriesTaxonomyFormInput,
  seriesTaxonomyFormSchema,
  taxonomyFormDataValue,
} from "../../../lib/admin/content/taxonomy-form-validation";
import {
  updateTopicCategoryAtomically,
  updateTopicSeriesAtomically,
} from "../../../lib/admin/content/taxonomy-mutations";
import { revalidateTopicsCache } from "../../../lib/cache/revalidate-public-cache-tags";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";

type DatabaseErrorLike = {
  code?: string;
  message?: string;
};

function formFailure(
  message: string,
  fieldErrors?: Record<string, string[]>,
): AdminFormActionState {
  return {
    status: "error",
    title: "تعذر حفظ البيانات",
    message,
    ...(fieldErrors ? { fieldErrors } : {}),
  };
}

function formSuccess(
  message: string,
  code: "created" | "updated",
  entityId: number,
): AdminFormActionState {
  return {
    status: "success",
    title: "تم الحفظ بنجاح",
    message,
    code,
    entityId,
  };
}

function getDatabaseError(error: unknown): DatabaseErrorLike {
  return error && typeof error === "object"
    ? (error as DatabaseErrorLike)
    : {};
}

function databaseFormFailure(error: unknown, fallback: string) {
  const databaseError = getDatabaseError(error);
  if (databaseError.code === "23505") {
    return formFailure("هذا الـ Slug مستخدم بالفعل.", {
      slug: ["اختر Slug مختلفًا."],
    });
  }
  if (databaseError.code === "23503") {
    return formFailure("العلاقة المحددة لم تعد موجودة. حدّث الصفحة وحاول مرة أخرى.");
  }
  if (databaseError.code === "22023" || databaseError.code === "P0001") {
    return formFailure(databaseError.message || fallback);
  }
  return formFailure(fallback);
}

function revalidateTaxonomyPaths() {
  revalidateTopicsCache();
  revalidatePath("/admin/content/categories");
  revalidatePath("/admin/content/categories/new");
  revalidatePath("/admin/content/series");
  revalidatePath("/admin/content/series/new");
  revalidatePath("/admin/content/topics");
  revalidatePath("/admin/content/topics/new");
  revalidatePath("/topics");
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
    .maybeSingle<{ id: number }>();
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
    .select("id, parent_id");
  if (error) throw error;

  const rows = (data ?? []) as Array<{ id: number; parent_id: number | null }>;
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
    .select("id, is_active")
    .eq("id", categoryId)
    .maybeSingle<{ id: number; is_active: boolean | null }>();
  if (error) throw error;
  if (!data) return "التصنيف المحدد غير موجود.";
  if (data.is_active === false && data.id !== currentCategoryId) {
    return "لا يمكن ربط السلسلة بتصنيف غير منشور.";
  }
  return null;
}

export async function createCategoryForm(
  _previousState: AdminFormActionState,
  formData: FormData,
): Promise<AdminFormActionState> {
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
        status: parsed.data.is_published ? "published" : "draft",
        color_token: colorToken,
        sort_order: 0,
        show_in_menu: true,
        is_featured: false,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single<{ id: number }>();
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
        },
      },
      actor,
    );
    revalidateTaxonomyPaths();
    return formSuccess("تم إنشاء التصنيف بنجاح.", "created", data.id);
  } catch (error) {
    return databaseFormFailure(error, "تعذر إنشاء التصنيف. حاول مرة أخرى.");
  }
}

export async function updateCategoryForm(
  _previousState: AdminFormActionState,
  formData: FormData,
): Promise<AdminFormActionState> {
  const actor = await requireAdminSession();
  const id = Number(taxonomyFormDataValue(formData, "id"));
  if (!Number.isInteger(id) || id <= 0) {
    return formFailure("معرّف التصنيف غير صالح.");
  }

  const { data: current, error: currentError } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("id, slug")
    .eq("id", id)
    .maybeSingle<{ id: number; slug: string }>();
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
    await updateTopicCategoryAtomically({
      id,
      name: parsed.data.name,
      parentId: parsed.data.parent_id,
      isActive: parsed.data.is_published,
      colorToken,
      actorId: actor.id,
    });

    await recordCmsAdminAudit(
      {
        action: buildCmsAuditAction("topic_category", "update"),
        entityType: "topic_category",
        entityId: id,
        entityLabel: parsed.data.name,
        metadata: {
          slug: current.slug,
          parent_id: parsed.data.parent_id,
          color_token: colorToken,
        },
      },
      actor,
    );
    revalidateTaxonomyPaths();
    return formSuccess("تم تحديث التصنيف بنجاح.", "updated", id);
  } catch (error) {
    return databaseFormFailure(error, "تعذر تحديث التصنيف. حاول مرة أخرى.");
  }
}

export async function createSeriesForm(
  _previousState: AdminFormActionState,
  formData: FormData,
): Promise<AdminFormActionState> {
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
    const categoryError = await validateSeriesCategory(parsed.data.category_id);
    if (categoryError) {
      return formFailure(categoryError, { category_id: [categoryError] });
    }
    if (await slugExists("topic_series", parsed.data.slug)) {
      return formFailure("هذا الـ Slug مستخدم في سلسلة أخرى.", {
        slug: ["اختر Slug مختلفًا."],
      });
    }

    const now = new Date().toISOString();
    const status = parsed.data.is_published ? "published" : "unpublished";
    const { data, error } = await getSupabaseAdmin()
      .from("topic_series")
      .insert({
        name: parsed.data.name,
        slug: parsed.data.slug,
        category_id: parsed.data.category_id,
        status,
        sort_order: 0,
        deleted_at: null,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single<{ id: number }>();
    if (error) throw error;

    await recordCmsAdminAudit(
      {
        action: buildCmsAuditAction("topic_series", "create"),
        entityType: "topic_series",
        entityId: data.id,
        entityLabel: parsed.data.name,
        metadata: { slug: parsed.data.slug, status, category_id: parsed.data.category_id },
      },
      actor,
    );
    revalidateTaxonomyPaths();
    return formSuccess("تم إنشاء السلسلة بنجاح.", "created", data.id);
  } catch (error) {
    return databaseFormFailure(error, "تعذر إنشاء السلسلة. حاول مرة أخرى.");
  }
}

export async function updateSeriesForm(
  _previousState: AdminFormActionState,
  formData: FormData,
): Promise<AdminFormActionState> {
  const actor = await requireAdminSession();
  const id = Number(taxonomyFormDataValue(formData, "id"));
  if (!Number.isInteger(id) || id <= 0) {
    return formFailure("معرّف السلسلة غير صالح.");
  }

  const { data: current, error: currentError } = await getSupabaseAdmin()
    .from("topic_series")
    .select("id, slug, status, category_id")
    .eq("id", id)
    .maybeSingle<{
      id: number;
      slug: string;
      status: string | null;
      category_id: number | null;
    }>();
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
    const status = parsed.data.is_published
      ? "published"
      : current.status === "archived" || current.status === "draft"
        ? current.status
        : "unpublished";
    await updateTopicSeriesAtomically({
      id,
      name: parsed.data.name,
      categoryId: parsed.data.category_id,
      status,
      actorId: actor.id,
    });

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
    revalidateTaxonomyPaths();
    return formSuccess("تم تحديث السلسلة بنجاح.", "updated", id);
  } catch (error) {
    return databaseFormFailure(error, "تعذر تحديث السلسلة. حاول مرة أخرى.");
  }
}

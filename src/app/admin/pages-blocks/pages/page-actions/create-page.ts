"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import type { AdminFormActionState } from "../../../../../lib/admin/form-runtime";
import {
  DUPLICATE_PAGE_PATH_MESSAGE,
  DUPLICATE_PAGE_SLUG_MESSAGE,
  validateNewPagePath,
} from "../../../../../lib/pages/validate-page-path";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";

const CREATE_PAGE_FAILURE_MESSAGE = "تعذر إنشاء الصفحة. حاول مرة أخرى.";

export type CreatePageFormActionState = AdminFormActionState;

function createPageFormFailure(
  revision: number,
  message: string,
  field?: "title" | "path",
): CreatePageFormActionState {
  return {
    status: "error",
    mode: "create",
    revision,
    title: "تعذر إنشاء الصفحة",
    message,
    ...(field
      ? { fieldErrors: { [field]: [message] }, focusTarget: field }
      : {}),
  };
}

function createPageFormSuccess(
  revision: number,
  id: number,
  postCommitWarnings: readonly string[],
): CreatePageFormActionState {
  const warning = postCommitWarnings.length > 0;
  return {
    status: warning ? "warning" : "success",
    mode: "create",
    revision,
    title: warning ? "تم إنشاء الصفحة مع تنبيه" : "تم إنشاء الصفحة",
    message: warning
      ? `تم إنشاء الصفحة كغير منشورة، لكن ${postCommitWarnings.join(" و")}. يمكنك متابعة تعديل الصفحة الآن.`
      : "تم إنشاء الصفحة كغير منشورة بنجاح.",
    code: warning ? "created_with_infrastructure_warning" : "created",
    entityId: id,
    editHref: `/admin/pages-blocks/pages/${id}`,
    savedRevision: `${id}:${revision}`,
  };
}

function resolveInsertFailure(error: { code?: string; message?: string } | null): string {
  if (!error) {
    return CREATE_PAGE_FAILURE_MESSAGE;
  }

  if (error.code === "23505") {
    const details = `${error.message ?? ""}`.toLowerCase();
    if (details.includes("path")) {
      return DUPLICATE_PAGE_PATH_MESSAGE;
    }
    if (details.includes("slug")) {
      return DUPLICATE_PAGE_SLUG_MESSAGE;
    }
    return CREATE_PAGE_FAILURE_MESSAGE;
  }

  return CREATE_PAGE_FAILURE_MESSAGE;
}

async function assertPageIdentityAvailable(path: string, slug: string) {
  const { data: existingPath, error: pathLookupError } = await getSupabaseAdmin()
    .from("pages")
    .select("id")
    .eq("path", path)
    .maybeSingle();

  if (pathLookupError) {
    throw new Error(CREATE_PAGE_FAILURE_MESSAGE);
  }

  if (existingPath) {
    throw new Error(DUPLICATE_PAGE_PATH_MESSAGE);
  }

  const { data: existingSlug, error: slugLookupError } = await getSupabaseAdmin()
    .from("pages")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (slugLookupError) {
    throw new Error(CREATE_PAGE_FAILURE_MESSAGE);
  }

  if (existingSlug) {
    throw new Error(DUPLICATE_PAGE_SLUG_MESSAGE);
  }
}

export async function createPage(
  previousState: CreatePageFormActionState,
  formData: FormData,
): Promise<CreatePageFormActionState> {
  const revision = previousState.revision + 1;
  await requireAdminSession();

  const title = String(formData.get("title") ?? "").trim();
  const pathInput = String(formData.get("path") ?? "").trim();

  if (!title) {
    return createPageFormFailure(revision, "اسم الصفحة مطلوب.", "title");
  }

  const validated = validateNewPagePath(pathInput);
  if (!validated.ok) {
    return createPageFormFailure(revision, validated.error, "path");
  }

  try {
    await assertPageIdentityAvailable(validated.path, validated.slug);
  } catch (error) {
    const message = error instanceof Error ? error.message : CREATE_PAGE_FAILURE_MESSAGE;
    return createPageFormFailure(
      revision,
      message,
      message === CREATE_PAGE_FAILURE_MESSAGE ? undefined : "path",
    );
  }

  const { data: createdPage, error: insertError } = await getSupabaseAdmin()
    .from("pages")
    .insert({
      title,
      slug: validated.slug,
      path: validated.path,
      page_type: "static",
      status: "unpublished",
    })
    .select("id")
    .single();

  if (insertError || !createdPage) {
    const message = resolveInsertFailure(insertError);
    return createPageFormFailure(
      revision,
      message,
      insertError?.code === "23505" ? "path" : undefined,
    );
  }

  const postCommitWarnings: string[] = [];
  try {
    await recordCmsAdminAudit({
      action: buildCmsAuditAction("page", "create"),
      entityType: "page",
      entityId: createdPage.id,
      entityLabel: title,
      metadata: {
        title,
        slug: validated.slug,
        path: validated.path,
        status: "unpublished",
      },
    });
  } catch (error) {
    console.error("Page quick-create audit failed after commit", error);
    postCommitWarnings.push("تعذر تسجيل حدث التدقيق");
  }

  try {
    revalidatePath("/admin/pages-blocks/pages", "layout");
  } catch (error) {
    console.error("Page quick-create revalidation failed after commit", error);
    postCommitWarnings.push("تعذر تحديث الكاش فورًا");
  }

  return createPageFormSuccess(
    revision,
    createdPage.id,
    postCommitWarnings,
  );
}

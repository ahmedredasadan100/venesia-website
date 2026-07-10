"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import {
  DUPLICATE_PAGE_PATH_MESSAGE,
  DUPLICATE_PAGE_SLUG_MESSAGE,
  validateNewPagePath,
} from "../../../../../lib/pages/validate-page-path";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { pagesListPath } from "./helpers";

const CREATE_PAGE_FAILURE_MESSAGE = "تعذر إنشاء الصفحة. حاول مرة أخرى.";

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

export async function checkPagePathAvailable(pathInput: string) {
  await requireAdminSession();

  const validated = validateNewPagePath(pathInput);
  if (!validated.ok) {
    return { available: false, message: validated.error } as const;
  }

  try {
    await assertPageIdentityAvailable(validated.path, validated.slug);
  } catch (error) {
    const message = error instanceof Error ? error.message : CREATE_PAGE_FAILURE_MESSAGE;
    return { available: false, message } as const;
  }

  return {
    available: true,
    normalizedPath: validated.path,
    slugPreview: validated.slug,
  } as const;
}

export async function createPage(formData: FormData) {
  await requireAdminSession();

  const title = String(formData.get("title") ?? "").trim();
  const pathInput = String(formData.get("path") ?? "").trim();

  if (!title) {
    redirect(pagesListPath({ error: "اسم الصفحة مطلوب." }));
  }

  const validated = validateNewPagePath(pathInput);
  if (!validated.ok) {
    redirect(pagesListPath({ error: validated.error }));
  }

  try {
    await assertPageIdentityAvailable(validated.path, validated.slug);
  } catch (error) {
    const message = error instanceof Error ? error.message : CREATE_PAGE_FAILURE_MESSAGE;
    redirect(pagesListPath({ error: message }));
  }

  const { data: createdPage, error: insertError } = await getSupabaseAdmin()
    .from("pages")
    .insert({
      title,
      slug: validated.slug,
      path: validated.path,
      page_type: "static",
      status: "draft",
    })
    .select("id")
    .single<{ id: number }>();

  if (insertError || !createdPage) {
    redirect(pagesListPath({ error: resolveInsertFailure(insertError) }));
  }

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("page", "create"),
    entityType: "page",
    entityId: createdPage.id,
    entityLabel: title,
    metadata: {
      title,
      slug: validated.slug,
      path: validated.path,
      status: "draft",
    },
  });

  revalidatePath("/admin/pages-blocks/pages", "layout");
  redirect(`/admin/pages-blocks/pages/${createdPage.id}`);
}

"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import type { AdminFormActionState } from "../../../../../lib/admin/form-runtime";
import { validateSlugFormat } from "../../../../../lib/admin/slug";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  assertValidMenuSlug,
  auditMenuAction,
  backToMenus,
  createSlug,
  getBoolean,
  getNumber,
  getString,
  navigationMutationMessage,
  revalidateNavigation,
} from "./helpers";

export type CreateMenuFormActionState = AdminFormActionState;

function createMenuFormFailure(
  revision: number,
  message: string,
  field?: "name" | "slug" | "location",
): CreateMenuFormActionState {
  return {
    status: "error",
    mode: "create",
    revision,
    title: "تعذر إنشاء القائمة",
    message,
    ...(field
      ? { fieldErrors: { [field]: [message] }, focusTarget: field }
      : {}),
  };
}

function createMenuFormSuccess(
  revision: number,
  id: number,
  postCommitWarnings: readonly string[],
): CreateMenuFormActionState {
  const warning = postCommitWarnings.length > 0;
  return {
    status: warning ? "warning" : "success",
    mode: "create",
    revision,
    title: warning ? "تم إنشاء القائمة مع تنبيه" : "تم إنشاء القائمة",
    message: warning
      ? `تم إنشاء القائمة، لكن ${postCommitWarnings.join(" و")}. يمكنك متابعة إضافة عناصرها الآن.`
      : "تم إنشاء القائمة. ابدأ بإضافة عناصرها.",
    code: warning ? "created_with_infrastructure_warning" : "created",
    entityId: id,
    editHref: `/admin/pages-blocks/menus/${id}`,
    savedRevision: `${id}:${revision}`,
  };
}

export async function createMenu(
  previousState: CreateMenuFormActionState,
  formData: FormData,
): Promise<CreateMenuFormActionState> {
  const revision = previousState.revision + 1;
  await requireAdminSession();
  const name = getString(formData, "name");
  const slug = createSlug(getString(formData, "slug") || name);
  const location = getString(formData, "location") || "main";

  if (!name) {
    return createMenuFormFailure(revision, "اكتب اسم القائمة.", "name");
  }
  const slugError = validateSlugFormat(slug);
  if (slugError) {
    return createMenuFormFailure(revision, slugError, "slug");
  }

  const { data: existingMenu, error: lookupError } = await getSupabaseAdmin()
    .from("menus")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (lookupError) {
    return createMenuFormFailure(
      revision,
      "تعذر التحقق من الرابط المختصر. حاول مرة أخرى.",
    );
  }
  if (existingMenu?.id) {
    return createMenuFormFailure(
      revision,
      "الـ slug مستخدم بالفعل. اختار slug مختلف لأنه لا يمكن تكراره.",
      "slug",
    );
  }

  const { data, error } = await getSupabaseAdmin()
    .from("menus")
    .insert({ name, slug, location, is_active: getBoolean(formData, "is_active") })
    .select("id")
    .single();

  if (error || !data) {
    const duplicate = error?.code === "23505";
    return createMenuFormFailure(
      revision,
      duplicate
        ? "الـ slug مستخدم بالفعل. اختار slug مختلف لأنه لا يمكن تكراره."
        : error?.message || "تعذر إنشاء القائمة. حاول مرة أخرى.",
      duplicate ? "slug" : undefined,
    );
  }
  const postCommitWarnings: string[] = [];
  try {
    await auditMenuAction("menu", "create", {
      entityId: data.id,
      entityLabel: name,
      metadata: { slug, location },
    });
  } catch (auditError) {
    console.error("Menu quick-create audit failed after commit", auditError);
    postCommitWarnings.push("تعذر تسجيل حدث التدقيق");
  }
  try {
    await revalidateNavigation();
  } catch (revalidationError) {
    console.error(
      "Menu quick-create revalidation failed after commit",
      revalidationError,
    );
    postCommitWarnings.push("تعذر تحديث الكاش فورًا");
  }
  return createMenuFormSuccess(revision, data.id, postCommitWarnings);
}

export async function updateMenu(formData: FormData) {
  await requireAdminSession();
  const id = getNumber(formData, "id");
  const name = getString(formData, "name");
  const slug = createSlug(getString(formData, "slug") || name);
  const location = getString(formData, "location") || "main";

  if (!id || !name) backToMenus("بيانات القائمة غير مكتملة.");
  assertValidMenuSlug(slug);

  const { data: existingMenu } = await getSupabaseAdmin().from("menus").select("id").eq("slug", slug).neq("id", id).maybeSingle();
  if (existingMenu?.id) backToMenus("الـ slug مستخدم بالفعل في قائمة أخرى. اختار slug مختلف.");

  const { error } = await getSupabaseAdmin()
    .from("menus")
    .update({ name, slug, location, is_active: getBoolean(formData, "is_active"), updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) backToMenus(error.message);
  await auditMenuAction("menu", "update", { entityId: id, entityLabel: name, metadata: { slug, location } });
  const mediaSynchronization = await revalidateNavigation();
  backToMenus(navigationMutationMessage(mediaSynchronization, "تم تحديث القائمة."));
}

"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  assertValidMenuSlug,
  auditMenuAction,
  backToMenu,
  backToMenus,
  createSlug,
  getBoolean,
  getNumber,
  getString,
  revalidateNavigation,
} from "./helpers";

export async function createMenu(formData: FormData) {
  await requireAdminSession();
  const name = getString(formData, "name");
  const slug = createSlug(getString(formData, "slug") || name);
  const location = getString(formData, "location") || "main";

  if (!name) backToMenus("اكتب اسم القائمة.");
  assertValidMenuSlug(slug);

  const { data: existingMenu } = await getSupabaseAdmin().from("menus").select("id").eq("slug", slug).maybeSingle();
  if (existingMenu?.id) backToMenus("الـ slug مستخدم بالفعل. اختار slug مختلف لأنه لا يمكن تكراره.");

  const { data, error } = await getSupabaseAdmin()
    .from("menus")
    .insert({ name, slug, location, is_active: getBoolean(formData, "is_active") })
    .select("id")
    .single();

  if (error) backToMenus(error.message);
  await auditMenuAction("menu", "create", { entityId: data.id, entityLabel: name, metadata: { slug, location } });
  revalidateNavigation();
  backToMenu(data.id, "تم إنشاء القائمة. ابدأ بإضافة عناصرها.");
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
  revalidateNavigation();
  backToMenus("تم تحديث القائمة.");
}

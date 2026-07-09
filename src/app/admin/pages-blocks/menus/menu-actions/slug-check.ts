"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { validateSlugFormat } from "../../../../../lib/admin/slug";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { createSlug } from "./helpers";

export async function checkMenuSlugAvailable(slug: string) {
  await requireAdminSession();
  const normalized = createSlug(slug);
  const formatError = validateSlugFormat(normalized);
  if (formatError) {
    return { available: false as const, message: formatError };
  }

  const { data: existingMenu } = await getSupabaseAdmin().from("menus").select("id").eq("slug", normalized).maybeSingle();
  if (existingMenu?.id) {
    return { available: false as const, message: "الـ slug مستخدم بالفعل. اختار slug مختلف لأنه لا يمكن تكراره." };
  }

  return { available: true as const };
}

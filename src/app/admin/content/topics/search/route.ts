import { NextResponse } from "next/server";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { cleanContentTitleSearch } from "../../../../../lib/admin/content/load-unified-content";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireAdminSession();
  const params = new URL(request.url).searchParams;
  const q = cleanContentTitleSearch(params.get("q"));
  const trashView = params.get("view") === "trash";
  if (q.length < 2) return NextResponse.json({ results: [] });

  let query = getSupabaseAdmin()
    .from("admin_content_topics")
    .select("id,title,category_name");

  query = trashView
    ? query.not("deleted_at", "is", null)
    : query.is("deleted_at", null);

  for (const word of q.split(" ").filter(Boolean)) {
    query = query.ilike("title", `%${word}%`);
  }

  const { data, error } = await query.order("updated_at", { ascending: false }).limit(8);
  if (error) {
    return NextResponse.json({ results: [], error: "تعذر تنفيذ البحث." }, { status: 500 });
  }
  return NextResponse.json({ results: data ?? [] });
}

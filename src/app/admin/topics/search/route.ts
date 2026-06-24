import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

function cleanSearch(value: string) {
  return value.replace(/[,%]/g, " ").replace(/\s+/g, " ").trim();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = cleanSearch(searchParams.get("q") ?? "");

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const { data } = await getSupabaseAdmin()
    .from("topics")
    .select("id, title, slug, category")
    .is("deleted_at", null)
    .or(`title.ilike.${q}%,slug.ilike.${q}%,category.ilike.${q}%`)
    .order("id", { ascending: false })
    .limit(8);

  return NextResponse.json({ results: data ?? [] });
}
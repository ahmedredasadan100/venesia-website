import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../../lib/admin/auth/require-admin-api";
import { getSupabaseAdmin } from "../../../../../../lib/supabase-admin";
import { logError } from "../../../../../../lib/logging";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAdminApi();
  if (authError) return authError;

  const { id } = await params;
  const menuId = Number(id);

  if (!Number.isFinite(menuId)) {
    return NextResponse.json({ error: "Invalid menu id" }, { status: 400 });
  }

  const [{ data: menu, error: menuError }, { data: items, error: itemsError }] = await Promise.all([
    getSupabaseAdmin().from("menus").select("id, name, slug, location, is_active, created_at, updated_at").eq("id", menuId).maybeSingle(),
    getSupabaseAdmin().from("menu_items").select("*").eq("menu_id", menuId).order("sort_order", { ascending: true }),
  ]);

  if (menuError || !menu) {
    logError("Menu export: menu not found", menuError, { menuId });
    return NextResponse.json({ error: menuError?.message ?? "Menu not found" }, { status: 404 });
  }

  if (itemsError) {
    logError("Menu export: items fetch failed", itemsError, { menuId });
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  const body = JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      menu,
      items: items ?? [],
    },
    null,
    2,
  );

  return new NextResponse(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${menu.slug || `menu-${menuId}`}.json"`,
    },
  });
}

import { notFound } from "next/navigation";

import AdminPageHeader from "../../../../../components/admin/AdminPageHeader";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";

import MenuBuilderClient from "../MenuBuilderClient";
import type { Menu, MenuItem } from "../menu-builder-shared";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ message?: string; notice?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const menuId = Number(id);
  if (!Number.isFinite(menuId)) notFound();

  const [menuResult, itemsResult] = await Promise.all([
    getSupabaseAdmin().from("menus").select("id, name, slug, location, is_active").eq("id", menuId).maybeSingle(),
    getSupabaseAdmin().from("menu_items").select("*").eq("menu_id", menuId).order("sort_order", { ascending: true }),
  ]);

  if (!menuResult.data) notFound();

  const menu = menuResult.data as Menu;
  const items = (itemsResult.data ?? []) as MenuItem[];
  const databaseReady = Boolean(menu.is_active && items.some((item) => item.is_visible));

  return (
    <main className="space-y-8">
      <AdminPageHeader
        eyebrow="MENU BUILDER"
        title={`محرر ${menu.name}`}
        description="إدارة عناصر القائمة عبر تبويبات منظمة وجدول إداري موحّد مع بقية لوحة التحكم."
      />

      <MenuBuilderClient
        menu={menu}
        items={items}
        databaseReady={databaseReady}
        message={query?.message}
        messageWarning={query?.notice === "saved_with_media_sync_warning"}
      />
    </main>
  );
}

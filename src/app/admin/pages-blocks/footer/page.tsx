import FooterBuilderClient from "./FooterBuilderClient";
import { loadFooterSettingsForAdmin } from "../../../../lib/footer/load-footer-settings";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

import type { FooterMenuOption } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ saved?: string }> | { saved?: string };
};

export default async function FooterSettingsPage({ searchParams }: PageProps) {
  const resolvedSearch = searchParams ? await searchParams : {};
  const [settings, footerMenuResult, menusResult] = await Promise.all([
    loadFooterSettingsForAdmin(),
    getSupabaseAdmin()
      .from("menus")
      .select("id")
      .eq("location", "footer")
      .eq("is_active", true)
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle(),
    getSupabaseAdmin()
      .from("menus")
      .select("id, name, location")
      .eq("is_active", true)
      .order("id", { ascending: true }),
  ]);

  const footerMenuId = footerMenuResult.data?.id ?? null;
  let quickLinkItems: Array<{
    id: number;
    label: string;
    href: string;
    sortOrder: number;
    visible: boolean;
  }> = [];

  if (footerMenuId) {
    const { data: menuItems } = await getSupabaseAdmin()
      .from("menu_items")
      .select("id, label, href, sort_order, is_visible")
      .eq("menu_id", footerMenuId)
      .is("parent_id", null)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });

    quickLinkItems = (menuItems ?? []).map((item) => ({
      id: item.id,
      label: item.label ?? "",
      href: item.href ?? "",
      sortOrder: item.sort_order ?? 0,
      visible: item.is_visible !== false,
    }));
  }

  const menuOptions: FooterMenuOption[] = (menusResult.data ?? []).map((menu) => ({
    id: menu.id,
    name: menu.name ?? `قائمة #${menu.id}`,
    location: menu.location ?? "custom",
  }));

  return (
    <FooterBuilderClient
      settings={settings}
      footerMenuId={footerMenuId}
      quickLinkItems={quickLinkItems}
      menuOptions={menuOptions}
      saved={Boolean(resolvedSearch.saved)}
    />
  );
}

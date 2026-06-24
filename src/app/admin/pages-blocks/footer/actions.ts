"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isSocialPlatform } from "../../../../lib/footer/defaults";
import { revalidateFooterPublicPaths } from "../../../../lib/footer/revalidate-footer";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(formData: FormData, key: string) {
  const raw = getString(formData, key);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function getBooleanValue(raw: string) {
  return raw === "true" || raw === "on";
}

function parseContactItems(formData: FormData) {
  const labels = formData.getAll("contact_label").map((value) => String(value).trim());
  const values = formData.getAll("contact_value").map((value) => String(value).trim());
  const hrefs = formData.getAll("contact_href").map((value) => String(value).trim());
  const icons = formData.getAll("contact_icon").map((value) => String(value).trim());
  const visibles = formData.getAll("contact_visible").map((value) => String(value).trim());

  return labels
    .map((label, index) => {
      const value = values[index] ?? "";
      if (!label || !value) return null;
      const href = hrefs[index] ?? "";
      const icon = icons[index] ?? "";
      const visible = getBooleanValue(visibles[index] ?? "true");
      return {
        icon: icon || undefined,
        label,
        value,
        href: href || undefined,
        visible: visible ? undefined : false,
      };
    })
    .filter(Boolean);
}

function parseSocialLinks(formData: FormData) {
  const platforms = formData.getAll("social_platform").map((value) => String(value).trim());
  const labels = formData.getAll("social_label").map((value) => String(value).trim());
  const hrefs = formData.getAll("social_href").map((value) => String(value).trim());
  const visibles = formData.getAll("social_visible").map((value) => String(value).trim());

  return platforms
    .map((platformRaw, index) => {
      const platform = isSocialPlatform(platformRaw) ? platformRaw : "facebook";
      const label = labels[index] ?? "";
      const href = hrefs[index] ?? "";
      if (!label || !href) return null;
      const visible = getBooleanValue(visibles[index] ?? "true");
      return { platform, label, href, visible: visible ? undefined : false };
    })
    .filter(Boolean);
}

async function upsertSetting(key: string, value: unknown) {
  const { error } = await getSupabaseAdmin()
    .from("site_settings")
    .upsert(
      {
        key,
        value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );

  if (error) throw new Error(error.message);
}

async function syncFooterQuickLinks(formData: FormData, menuId: number) {
  const ids = formData.getAll("quicklink_id").map((value) => String(value).trim());
  const labels = formData.getAll("quicklink_label").map((value) => String(value).trim());
  const hrefs = formData.getAll("quicklink_href").map((value) => String(value).trim());
  const sorts = formData.getAll("quicklink_sort").map((value) => String(value).trim());
  const visibles = formData.getAll("quicklink_visible").map((value) => String(value).trim());

  const submittedIds = new Set<number>();

  for (let index = 0; index < labels.length; index += 1) {
    const label = labels[index] ?? "";
    const href = hrefs[index] ?? "";
    if (!label || !href) continue;

    const sortOrder = Number(sorts[index] ?? index);
    const isVisible = getBooleanValue(visibles[index] ?? "true");
    const idRaw = ids[index] ?? "";
    const id = idRaw ? Number(idRaw) : null;

    if (id && Number.isFinite(id)) {
      submittedIds.add(id);
      const { error } = await getSupabaseAdmin()
        .from("menu_items")
        .update({
          label,
          item_type: "custom",
          href,
          linked_type: null,
          linked_id: null,
          anchor: null,
          is_visible: isVisible,
          sort_order: Number.isFinite(sortOrder) ? sortOrder : index,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("menu_id", menuId);

      if (error) throw new Error(error.message);
      continue;
    }

    const { data, error } = await getSupabaseAdmin()
      .from("menu_items")
      .insert({
        menu_id: menuId,
        parent_id: null,
        label,
        item_type: "custom",
        href,
        linked_type: null,
        linked_id: null,
        anchor: null,
        target: "_self",
        css_class: null,
        style_preset: "default",
        is_visible: isVisible,
        sort_order: Number.isFinite(sortOrder) ? sortOrder : index,
      })
      .select("id")
      .single<{ id: number }>();

    if (error || !data) throw new Error(error?.message || "تعذر إضافة رابط سريع.");
    submittedIds.add(data.id);
  }

  const { data: existingItems, error: loadError } = await getSupabaseAdmin()
    .from("menu_items")
    .select("id")
    .eq("menu_id", menuId)
    .is("parent_id", null);

  if (loadError) throw new Error(loadError.message);

  const deleteIds = (existingItems ?? [])
    .map((item) => item.id)
    .filter((itemId) => !submittedIds.has(itemId));

  if (deleteIds.length) {
    const { error: deleteError } = await getSupabaseAdmin().from("menu_items").delete().in("id", deleteIds);
    if (deleteError) throw new Error(deleteError.message);
  }
}

export async function updateFooterSettings(formData: FormData) {
  const brandTitle = getString(formData, "brand_title");
  const brandTagline = getString(formData, "brand_tagline");
  const contactHeading = getString(formData, "brand_contact_heading") || "تواصل معنا";
  const mediaHeading = getString(formData, "brand_media_heading") || "المركز الإعلامي";
  const legalCopyright = getString(formData, "legal_copyright");
  const legalTagline = getString(formData, "legal_tagline");
  const footerMenuId = getNumber(formData, "footer_menu_id");

  if (!brandTitle) throw new Error("عنوان البراند مطلوب.");

  const contactItems = parseContactItems(formData);
  const socialLinks = parseSocialLinks(formData);

  if (!contactItems.length) throw new Error("أضف عنصر تواصل واحدًا على الأقل.");
  if (!socialLinks.length) throw new Error("أضف رابط سوشيال واحدًا على الأقل.");

  await upsertSetting("footer.brand", {
    title: brandTitle,
    tagline: brandTagline,
    contactHeading,
    mediaHeading,
  });

  await upsertSetting("footer.contact_items", contactItems);
  await upsertSetting("footer.social_links", socialLinks);
  await upsertSetting("footer.legal", {
    copyright: legalCopyright || "Venesia Developments. All rights reserved.",
    tagline: legalTagline || "Trust Built On Ground",
  });

  if (footerMenuId) {
    await syncFooterQuickLinks(formData, footerMenuId);
  }

  revalidateFooterPublicPaths();
  revalidatePath("/admin/pages-blocks/footer");
  redirect("/admin/pages-blocks/footer?saved=1");
}

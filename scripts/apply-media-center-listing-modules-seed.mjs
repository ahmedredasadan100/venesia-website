/**
 * Applies media_center_listing_modules seed — default Hero/Breadcrumb/Content for listing pages.
 * Usage: node scripts/apply-media-center-listing-modules-seed.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(ROOT, ".env.local");

for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  if (!process.env[key]) process.env[key] = value;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const LISTING_PAGES = [
  {
    pageSlug: "media-center-news",
    heroSlug: "hero-media-center-news",
    heroName: "Hero — Media Center News",
    breadcrumbSlug: "breadcrumb-media-center-news",
    breadcrumbName: "Breadcrumb — Media Center News",
    contentSlug: "media-center-news-listing-shell",
    contentName: "Media Center — News Listing Shell",
    heroConfig: {
      title: "الأخبار",
      images: ["/images/venesia-5.png"],
      eyebrow: "News",
      showCta: false,
      subtitle: "آخر أخبار وتحديثات فينيسيا.",
      highlight: "",
      description: "آخر أخبار وتحديثات فينيسيا.",
      showBreadcrumb: true,
      imagePositionClassName: "object-[42%_36%]",
    },
  },
  {
    pageSlug: "media-center-videos",
    heroSlug: "hero-media-center-videos",
    heroName: "Hero — Media Center Videos",
    breadcrumbSlug: "breadcrumb-media-center-videos",
    breadcrumbName: "Breadcrumb — Media Center Videos",
    contentSlug: "media-center-videos-listing-shell",
    contentName: "Media Center — Videos Listing Shell",
    heroConfig: {
      title: "الفيديوهات",
      images: ["/images/venesia-5.png"],
      eyebrow: "Videos",
      showCta: false,
      subtitle: "لقطات وجولات مرئية توثق ما يحدث داخل مشروعات فينيسيا.",
      highlight: "",
      description: "لقطات وجولات مرئية توثق ما يحدث داخل مشروعات فينيسيا.",
      showBreadcrumb: true,
      imagePositionClassName: "object-[42%_36%]",
    },
  },
  {
    pageSlug: "media-center-gallery",
    heroSlug: "hero-media-center-gallery",
    heroName: "Hero — Media Center Gallery",
    breadcrumbSlug: "breadcrumb-media-center-gallery",
    breadcrumbName: "Breadcrumb — Media Center Gallery",
    contentSlug: "media-center-gallery-listing-shell",
    contentName: "Media Center — Gallery Listing Shell",
    heroConfig: {
      title: "معرض الصور",
      images: ["/images/venesia-5.png"],
      eyebrow: "Gallery",
      showCta: false,
      subtitle: "صور مختارة توثق مراحل التنفيذ والتفاصيل المعمارية داخل مشروعات فينيسيا.",
      highlight: "",
      description: "صور مختارة توثق مراحل التنفيذ والتفاصيل المعمارية داخل مشروعات فينيسيا.",
      showBreadcrumb: true,
      imagePositionClassName: "object-[42%_36%]",
    },
  },
  {
    pageSlug: "media-center-press",
    heroSlug: "hero-media-center-press",
    heroName: "Hero — Media Center Press",
    breadcrumbSlug: "breadcrumb-media-center-press",
    breadcrumbName: "Breadcrumb — Media Center Press",
    contentSlug: "media-center-press-listing-shell",
    contentName: "Media Center — Press Listing Shell",
    heroConfig: {
      title: "البيانات الصحفية",
      images: ["/images/venesia-5.png"],
      eyebrow: "Press",
      showCta: false,
      subtitle: "بيانات وتغطيات رسمية تعكس أخبار فينيسيا بلغة واضحة وموثقة.",
      highlight: "",
      description: "بيانات وتغطيات رسمية تعكس أخبار فينيسيا بلغة واضحة وموثقة.",
      showBreadcrumb: true,
      imagePositionClassName: "object-[42%_36%]",
    },
  },
  {
    pageSlug: "media-center-site-updates",
    heroSlug: "hero-media-center-site-updates",
    heroName: "Hero — Media Center Site Updates",
    breadcrumbSlug: "breadcrumb-media-center-site-updates",
    breadcrumbName: "Breadcrumb — Media Center Site Updates",
    contentSlug: "media-center-site-updates-listing-shell",
    contentName: "Media Center — Site Updates Listing Shell",
    heroConfig: {
      title: "تحديثات المواقع",
      images: ["/images/venesia-5.png"],
      eyebrow: "Site Updates",
      showCta: false,
      subtitle: "متابعة ميدانية لمراحل التنفيذ داخل مشروعات فينيسيا.",
      highlight: "",
      description: "متابعة ميدانية لمراحل التنفيذ داخل مشروعات فينيسيا.",
      showBreadcrumb: true,
      imagePositionClassName: "object-[42%_36%]",
    },
  },
];

const CONTENT_SHELL_CONFIG = {
  eyebrow: "",
  title: "Listing shell",
  subtitle: "Publish or replace to show CMS content above the listing.",
  body: "",
  alignment: "start",
};

async function upsertHeroTemplate(entry, sortOrder) {
  const { data, error } = await supabase
    .from("hero_templates")
    .upsert(
      {
        name: entry.heroName,
        slug: entry.heroSlug,
        description: `Hero for ${entry.pageSlug}`,
        section_key: "hero",
        variant: "internal-page",
        style_preset: "cinematic-gold",
        source_type: "manual",
        limit_count: 1,
        is_visible: true,
        sort_order: sortOrder,
        config: entry.heroConfig,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" },
    )
    .select("id,slug")
    .single();

  if (error || !data) throw new Error(`hero template ${entry.heroSlug}: ${error?.message ?? "missing"}`);
  return data.id;
}

async function upsertBreadcrumbTemplate(entry, sortOrder) {
  const { data, error } = await supabase
    .from("breadcrumb_block_templates")
    .upsert(
      {
        name: entry.breadcrumbName,
        slug: entry.breadcrumbSlug,
        description: `Breadcrumb for ${entry.pageSlug}`,
        variant: "hero-inline",
        status: "published",
        config: { source: "navigation", showHome: true },
        sort_order: sortOrder,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" },
    )
    .select("id,slug")
    .single();

  if (error || !data) throw new Error(`breadcrumb template ${entry.breadcrumbSlug}: ${error?.message ?? "missing"}`);
  return data.id;
}

async function upsertContentTemplate(entry, sortOrder) {
  const { data, error } = await supabase
    .from("content_block_templates")
    .upsert(
      {
        name: entry.contentName,
        slug: entry.contentSlug,
        description: `Optional CMS blocks slot for ${entry.pageSlug}`,
        variant: "default",
        style_preset: "premium-dark",
        status: "published",
        config: CONTENT_SHELL_CONFIG,
        sort_order: sortOrder,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" },
    )
    .select("id,slug")
    .single();

  if (error || !data) throw new Error(`content template ${entry.contentSlug}: ${error?.message ?? "missing"}`);
  return data.id;
}

async function upsertHeroAssignment(pageId, pageSlug, pagePath, heroId) {
  const { data: existing } = await supabase
    .from("hero_assignments")
    .select("id")
    .eq("target_type", "page")
    .eq("target_id", pageId)
    .eq("is_active", true)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("hero_assignments")
      .update({ hero_id: heroId, target_slug: pageSlug, path: pagePath, priority: 100 })
      .eq("id", existing.id);
    if (error) throw new Error(`hero assignment update ${pageSlug}: ${error.message}`);
    return;
  }

  const { error } = await supabase.from("hero_assignments").insert({
    hero_id: heroId,
    target_type: "page",
    target_id: pageId,
    target_slug: pageSlug,
    path: pagePath,
    is_active: true,
    priority: 100,
  });
  if (error) throw new Error(`hero assignment insert ${pageSlug}: ${error.message}`);
}

async function upsertAssignment(table, pageId, templateId, slot, sortOrder, isVisible) {
  const { error } = await supabase.from(table).upsert(
    {
      page_id: pageId,
      template_id: templateId,
      slot,
      sort_order: sortOrder,
      is_visible: isVisible,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "page_id,template_id" },
  );
  if (error) throw new Error(`${table} ${pageId}: ${error.message}`);
}

for (const [index, entry] of LISTING_PAGES.entries()) {
  const sortOrder = 31 + index;

  const { data: page, error: pageError } = await supabase
    .from("pages")
    .select("id,slug,path")
    .eq("slug", entry.pageSlug)
    .maybeSingle();

  if (pageError || !page) {
    console.error(`Page missing: ${entry.pageSlug}. Run apply-media-center-pages-seed.mjs first.`);
    process.exit(1);
  }

  const heroId = await upsertHeroTemplate(entry, sortOrder);
  const breadcrumbId = await upsertBreadcrumbTemplate(entry, sortOrder);
  const contentId = await upsertContentTemplate(entry, sortOrder);

  await upsertHeroAssignment(page.id, page.slug, page.path, heroId);
  await upsertAssignment("page_breadcrumb_block_assignments", page.id, breadcrumbId, "hero", 5, true);
  await upsertAssignment("page_content_block_assignments", page.id, contentId, "main", 10, false);

  console.log(`OK ${entry.pageSlug} → hero + breadcrumb + content shell (page id=${page.id})`);
}

console.log("Media Center listing modules seed applied.");

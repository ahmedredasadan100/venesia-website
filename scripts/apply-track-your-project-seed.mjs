/**
 * Applies Track Your Project CMS seed (page + hero/breadcrumb/content/cta).
 * Usage: node scripts/apply-track-your-project-seed.mjs
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

const PAGE = {
  title: "تابع مشروعك",
  slug: "track-your-project",
  path: "/track-your-project",
  page_type: "static",
  status: "published",
};

const HERO_CONFIG = {
  title: "تابع مشروعك",
  images: ["/images/venesia-1.png"],
  eyebrow: "Project Tracking",
  showCta: false,
  subtitle: "تابع مراحل التنفيذ أولًا بأول عبر تحديثات واضحة تعكس الواقع على الأرض.",
  highlight: "",
  description: "",
  showBreadcrumb: true,
  heroLayout: "compact",
  imagePositionClassName: "object-[42%_36%]",
};

const CONTENT_CONFIG = {
  eyebrow: "Project Tracking",
  title: "تابع مشروعك",
  subtitle: "تابع مراحل التنفيذ أولًا بأول عبر تحديثات واضحة تعكس الواقع على الأرض.",
  body: "بوابة متابعة المشروع تتيح لك الاطلاع على مراحل التنفيذ والتحديثات الميدانية ونسب الإنجاز، بشكل واضح يعكس ما يحدث على أرض الواقع. تواصل مع فريق فينيسيا للحصول على آخر المستجدات حول وحدتك.",
  alignment: "start",
};

const CTA_CONFIG = {
  eyebrow: "Venesia Developments",
  title: "هل تحتاج مساعدة في متابعة مشروعك؟",
  description: "تواصل مع فريق فينيسيا للاستفسار عن مراحل التنفيذ والتحديثات.",
  primaryCta: { label: "تواصل معنا ↗", href: "/contact" },
  backgroundImage: "/images/venesia-1.png",
  backgroundStyle: "dark",
};

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
    if (error) throw new Error(`hero assignment update: ${error.message}`);
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
  if (error) throw new Error(`hero assignment insert: ${error.message}`);
}

async function upsertAssignment(table, pageId, templateId, slot, sortOrder) {
  const { error } = await supabase.from(table).upsert(
    {
      page_id: pageId,
      template_id: templateId,
      slot,
      sort_order: sortOrder,
      is_visible: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "page_id,template_id" },
  );
  if (error) throw new Error(`${table}: ${error.message}`);
}

const { data: page, error: pageError } = await supabase
  .from("pages")
  .upsert(PAGE, { onConflict: "slug" })
  .select("id,slug,path")
  .single();

if (pageError || !page) {
  console.error("Failed to upsert page:", pageError?.message ?? "missing");
  process.exit(1);
}

console.log(`Page upserted: ${page.slug} (id=${page.id})`);

const { data: hero, error: heroError } = await supabase
  .from("hero_templates")
  .upsert(
    {
      name: "Hero — Track Your Project",
      slug: "hero-track-your-project",
      description: "Hero لصفحة تابع مشروعك",
      section_key: "hero",
      variant: "internal-page",
      style_preset: "cinematic-gold",
      source_type: "manual",
      limit_count: 1,
      is_visible: true,
      sort_order: 55,
      config: HERO_CONFIG,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "slug" },
  )
  .select("id")
  .single();

if (heroError || !hero) {
  console.error("Failed to upsert hero:", heroError?.message ?? "missing");
  process.exit(1);
}

const { data: breadcrumb, error: breadcrumbError } = await supabase
  .from("breadcrumb_block_templates")
  .upsert(
    {
      name: "Breadcrumb — Track Your Project",
      slug: "breadcrumb-track-your-project",
      description: "مسار التنقل لصفحة تابع مشروعك",
      variant: "hero-inline",
      status: "published",
      config: { source: "navigation", showHome: true },
      sort_order: 55,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "slug" },
  )
  .select("id")
  .single();

if (breadcrumbError || !breadcrumb) {
  console.error("Failed to upsert breadcrumb:", breadcrumbError?.message ?? "missing");
  process.exit(1);
}

const { data: content, error: contentError } = await supabase
  .from("content_block_templates")
  .upsert(
    {
      name: "Track — Intro",
      slug: "track-intro",
      description: "مقدمة صفحة تابع مشروعك",
      variant: "default",
      style_preset: "premium-dark",
      status: "published",
      config: CONTENT_CONFIG,
      sort_order: 55,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "slug" },
  )
  .select("id")
  .single();

if (contentError || !content) {
  console.error("Failed to upsert content:", contentError?.message ?? "missing");
  process.exit(1);
}

const { data: cta, error: ctaError } = await supabase
  .from("cta_block_templates")
  .upsert(
    {
      name: "Track — Contact CTA",
      slug: "track-contact-cta",
      description: "دعوة للتواصل بخصوص متابعة المشروع",
      variant: "band",
      style_preset: "premium-dark",
      status: "published",
      config: CTA_CONFIG,
      sort_order: 55,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "slug" },
  )
  .select("id")
  .single();

if (ctaError || !cta) {
  console.error("Failed to upsert cta:", ctaError?.message ?? "missing");
  process.exit(1);
}

await upsertHeroAssignment(page.id, page.slug, page.path, hero.id);
await upsertAssignment("page_breadcrumb_block_assignments", page.id, breadcrumb.id, "hero", 5);
await upsertAssignment("page_content_block_assignments", page.id, content.id, "main", 10);
await upsertAssignment("page_cta_block_assignments", page.id, cta.id, "before-footer", 20);

console.log("Track Your Project CMS seed applied.");

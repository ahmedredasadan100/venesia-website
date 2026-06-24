/**
 * Practical E2E test: Category → Series → Feed Widget → /topics sidebar
 * Run: node scripts/e2e-topics-feed-test.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8");
const get = (k) => (env.match(new RegExp("^" + k + "=(.+)$", "m")) || [])[1]?.trim();

const sb = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"));

const PREFIX = "e2e-test-feed";
const catSlug = `${PREFIX}-cat`;
const seriesSlug = `${PREFIX}-series`;
const feedSlug = `${PREFIX}-widget`;
const now = new Date().toISOString();

const results = { pass: [], fail: [] };
function ok(label, detail) {
  results.pass.push({ label, detail });
  console.log(`✓ ${label}${detail ? `: ${detail}` : ""}`);
}
function fail(label, detail) {
  results.fail.push({ label, detail });
  console.error(`✗ ${label}${detail ? `: ${detail}` : ""}`);
}

// 1. Category
let { data: category, error: catErr } = await sb
  .from("topic_categories")
  .select("id,name,slug,is_active")
  .eq("slug", catSlug)
  .maybeSingle();

if (catErr) fail("Load category", catErr.message);
else if (!category) {
  const { data, error } = await sb
    .from("topic_categories")
    .insert({
      name: "اختبار Feed Widget",
      slug: catSlug,
      sort_order: 999,
      is_active: true,
      parent_id: null,
      status: "published",
      show_in_menu: true,
      is_featured: false,
      created_at: now,
      updated_at: now,
    })
    .select("id,name,slug,is_active")
    .single();
  if (error) fail("Create category", error.message);
  else {
    category = data;
    ok("Create category", `${category.name} (${category.slug})`);
  }
} else ok("Category exists", `${category.name} (${category.slug})`);

// 2. Series
let { data: series, error: seriesErr } = await sb
  .from("topic_series")
  .select("id,name,slug,category_id,status")
  .eq("slug", seriesSlug)
  .maybeSingle();

if (seriesErr) fail("Load series", seriesErr.message);
else if (!series) {
  const { data, error } = await sb
    .from("topic_series")
    .insert({
      name: "سلسلة اختبار Feed",
      slug: seriesSlug,
      status: "published",
      sort_order: 999,
      category_id: category.id,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    })
    .select("id,name,slug,category_id,status")
    .single();
  if (error) fail("Create series", error.message);
  else {
    series = data;
    ok("Create series", `${series.name} → category_id=${series.category_id}`);
  }
} else {
  if (series.category_id !== category.id) {
    const { error } = await sb
      .from("topic_series")
      .update({ category_id: category.id, updated_at: now })
      .eq("id", series.id);
    if (error) fail("Update series category_id", error.message);
    else ok("Series linked to category", `category_id=${category.id}`);
  } else ok("Series exists", `${series.name} → category_id=${series.category_id}`);
}

// 3. Topics (for feed results)
const topicSlugs = [`${PREFIX}-topic-1`, `${PREFIX}-topic-2`];
const topicTitles = ["موضوع اختبار Feed 1", "موضوع اختبار Feed 2"];

for (let i = 0; i < topicSlugs.length; i++) {
  const slug = topicSlugs[i];
  const { data: existing } = await sb.from("topics").select("id,slug,title").eq("slug", slug).maybeSingle();
  if (existing) {
    ok("Topic exists", existing.title);
    continue;
  }
  const { error } = await sb.from("topics").insert({
    title: topicTitles[i],
    slug,
    excerpt: "م excerpt اختبار للـ Feed Widget",
    content: "<p>محتوى اختبار</p>",
    image: "/images/venesia-5.png",
    image_alt: topicTitles[i],
    category: category.name,
    category_slug: catSlug,
    category_id: category.id,
    series_id: series.id,
    series: series.name,
    series_slug: seriesSlug,
    date_label: "2025-06-20",
    status: "published",
    is_featured: false,
    is_popular: false,
    published_at: new Date(Date.now() - i * 86400000).toISOString(),
    created_at: now,
    updated_at: now,
  });
  if (error) fail("Create topic", `${slug}: ${error.message}`);
  else ok("Create topic", topicTitles[i]);
}

// 4. Feed Widget
const feedConfig = {
  presentation: {
    title: "اختبار Feed — أحدث",
    eyebrow: null,
    linkText: null,
    showImage: true,
    showDate: true,
    showExcerpt: false,
    emptyBehavior: "hide",
  },
  query: {
    limit: 5,
    categorySlug: catSlug,
    seriesSlug: seriesSlug,
  },
};

let { data: feed, error: feedErr } = await sb
  .from("feed_module_templates")
  .select("id,name,slug,status,feed_type,config")
  .eq("slug", feedSlug)
  .maybeSingle();

if (feedErr) fail("Load feed widget", feedErr.message);
else if (!feed) {
  const { data, error } = await sb
    .from("feed_module_templates")
    .insert({
      name: "E2E Test Feed Widget",
      slug: feedSlug,
      description: "اختبار عملي: category + series filters",
      status: "published",
      feed_type: "latest",
      config: feedConfig,
      sort_order: 45,
    })
    .select("id,name,slug,status,feed_type,config")
    .single();
  if (error) fail("Create feed widget", error.message);
  else {
    feed = data;
    ok("Create feed widget", `${feed.name} (${feed.feed_type})`);
  }
} else {
  const { error } = await sb
    .from("feed_module_templates")
    .update({ config: feedConfig, status: "published", updated_at: now })
    .eq("id", feed.id);
  if (error) fail("Update feed widget", error.message);
  else ok("Feed widget exists/updated", feed.name);
}

// 5. Assign to /topics sidebar
const { data: topicsPage } = await sb.from("pages").select("id").eq("slug", "topics").single();
if (!topicsPage) fail("Topics page", "not found");
else {
  const { data: assignment, error: assignErr } = await sb
    .from("page_feed_module_assignments")
    .upsert(
      {
        page_id: topicsPage.id,
        template_id: feed.id,
        slot: "sidebar",
        sort_order: 45,
        is_visible: true,
        updated_at: now,
      },
      { onConflict: "page_id,template_id" },
    )
    .select("id,sort_order,is_visible")
    .single();

  if (assignErr) fail("Assign feed to sidebar", assignErr.message);
  else ok("Assign feed to /topics sidebar", `assignment #${assignment.id}, sort=${assignment.sort_order}`);
}

// 6. Verify filter options (series via category_id only)
const { data: filterSeries } = await sb
  .from("topic_series")
  .select("id,slug,category_id")
  .eq("status", "published")
  .eq("category_id", category.id);

const seriesInFilter = (filterSeries ?? []).some((s) => s.slug === seriesSlug);
if (seriesInFilter) ok("Series filter via category_id", seriesSlug);
else fail("Series filter via category_id", "series not found for category");

// 7. Verify feed query results
const { data: feedTopics, error: queryErr } = await sb
  .from("topics")
  .select("slug,title,category_slug,series_slug")
  .eq("status", "published")
  .is("deleted_at", null)
  .eq("category_slug", catSlug)
  .eq("series_slug", seriesSlug)
  .order("published_at", { ascending: false })
  .limit(5);

if (queryErr) fail("Feed query", queryErr.message);
else if ((feedTopics ?? []).length >= 2) {
  ok("Feed query returns topics", `${feedTopics.length} items: ${feedTopics.map((t) => t.title).join(", ")}`);
} else fail("Feed query", `expected ≥2 topics, got ${feedTopics?.length ?? 0}`);

// 8. Verify sidebar assignment order
const { data: sidebarFeeds } = await sb
  .from("page_feed_module_assignments")
  .select("sort_order,is_visible,feed_module_templates(name,slug,status)")
  .eq("page_id", topicsPage.id)
  .eq("is_visible", true)
  .order("sort_order");

const feedInSidebar = (sidebarFeeds ?? []).find((a) => a.feed_module_templates?.slug === feedSlug);
if (feedInSidebar) ok("Feed visible in sidebar assignments", `sort=${feedInSidebar.sort_order}`);
else fail("Feed in sidebar", "assignment not found");

const defaultFeeds = ["topics-feed-categories", "topics-feed-latest", "topics-feed-popular", "topics-feed-series"];
const missingDefaults = defaultFeeds.filter(
  (slug) => !(sidebarFeeds ?? []).some((a) => a.feed_module_templates?.slug === slug),
);
if (missingDefaults.length === 0) ok("Default sidebar feeds intact", "4 seeded feeds present");
else fail("Default sidebar feeds", `missing: ${missingDefaults.join(", ")}`);

console.log("\n--- Summary ---");
console.log(`PASS: ${results.pass.length}  FAIL: ${results.fail.length}`);
if (results.fail.length) process.exit(1);

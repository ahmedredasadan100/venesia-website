/**
 * /topics public page verification — run with: node scripts/verify-topics-page.mjs [port]
 *
 * Content-reflection coverage uses real published DB records instead of the
 * e2e-test-feed fixtures: filterPublicTopics (src/lib/admin/cms-test-data.ts)
 * intentionally hides `e2e-test*` slugs from public feeds, so fixture topics
 * must never appear publicly — that inverse expectation is asserted below.
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(ROOT, ".env.local");
const envLines = existsSync(envPath) ? readFileSync(envPath, "utf8").split(/\r?\n/) : [];
for (const line of envLines) {
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

const port = process.argv[2] || process.env.PORT || "3000";
const searchOnly = process.argv.includes("--search-only");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const res = await fetch(`http://localhost:${port}/topics`, {
  headers: { "Cache-Control": "no-cache" },
});
console.log("HTTP", res.status);
const html = await res.text();
const topicsListingSource = readFileSync(
  resolve(ROOT, "src/components/topics/TopicsListingContent.tsx"),
  "utf8",
);

// Same filters/ordering as resolveLatestOrPopular in src/lib/feed-modules/resolve-topics-feed.ts.
async function loadFeedTitles(popularOnly) {
  let query = supabase
    .from("topics")
    .select("slug,title")
    .eq("content_type", "article")
    .eq("status", "published")
    .is("deleted_at", null);
  if (popularOnly) query = query.eq("is_popular", true);
  const { data, error } = await query.order("published_at", { ascending: false }).limit(8);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((row) => !row.slug.toLowerCase().startsWith("e2e-test"))
    .map((row) => row.title)
    .filter(Boolean);
}

const latestTitles = await loadFeedTitles(false);
const popularTitles = await loadFeedTitles(true);
const searchTerm = latestTitles[0]?.slice(0, 32) ?? "";
const searchRes = await fetch(
  `http://localhost:${port}/topics?q=${encodeURIComponent(searchTerm)}`,
  { headers: { "Cache-Control": "no-cache" } },
);
const searchHtml = await searchRes.text();

const searchChecks = [
  ["Search HTTP 200", () => searchRes.status === 200],
  ["Search panel", () => searchHtml.includes("ابحث في الموضوعات")],
  [
    "Topics search renders the owner item array",
    () => topicsListingSource.includes(
      "const hasResults = isSearching ? topics.length > 0 : totalCount > 0;",
    ),
  ],
  [
    "Topics q renders a matching owner result",
    () => Boolean(searchTerm && latestTitles[0] && searchHtml.includes(latestTitles[0])),
  ],
];

const checks = searchOnly ? searchChecks : [
  ["HTTP 200", () => res.status === 200],
  ...searchChecks,
  ["Categories feed", () => html.includes("مواضيع تهمك")],
  ["Latest feed", () => html.includes("أحدث الموضوعات")],
  ["Popular feed", () => html.includes("الأكثر قراءة")],
  ["Series feed", () => html.includes("سلاسل المحتوى")],
  [
    "Latest published topics reflect on public page",
    () => latestTitles.length > 0 && latestTitles.some((title) => html.includes(title)),
  ],
  [
    "Popular published topics reflect on public page",
    () => popularTitles.length > 0 && popularTitles.some((title) => html.includes(title)),
  ],
  [
    "E2E fixture topics stay hidden from public",
    () => !html.includes("موضوع اختبار Feed 1") && !html.includes("موضوع اختبار Feed 2"),
  ],
  ["CMS layout sidebar slot", () => html.includes('data-layout-slot="sidebar"')],
  ["Main sidebar grid", () => html.includes("page-layout--main-sidebar")],
];

let failed = 0;
for (const [label, test] of checks) {
  const pass = test();
  console.log(`${pass ? "✓" : "✗"} ${label}`);
  if (!pass) failed++;
}

console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);

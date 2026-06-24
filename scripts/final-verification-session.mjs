/**
 * Final verification session — public + admin HTTP checks.
 * Usage: node scripts/final-verification-session.mjs [port]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = process.argv[2] || process.env.PORT || "3000";
const baseUrl = `http://127.0.0.1:${port}`;

for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const critical = [];
const medium = [];
const low = [];

function addCritical(name, detail) {
  critical.push({ name, detail });
  console.error(`CRITICAL ${name}: ${detail}`);
}

function addMedium(name, detail) {
  medium.push({ name, detail });
  console.warn(`MEDIUM ${name}: ${detail}`);
}

function addLow(name, detail) {
  low.push({ name, detail });
  console.log(`LOW ${name}: ${detail}`);
}

function pass(name, detail) {
  console.log(`PASS ${name}${detail ? `: ${detail}` : ""}`);
}

function bodyHtml(html) {
  const m = html.match(/<body[\s\S]*<\/body>/i);
  const body = m ? m[0] : html;
  return body.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, " ");
}

async function fetchPath(path) {
  const res = await fetch(`${baseUrl}${path}`, { cache: "no-store", redirect: "follow" });
  const html = await res.text();
  return { path, status: res.status, html, body: bodyHtml(html) };
}

async function checkPublicPage(name, result) {
  if (result.status !== 200) {
    addCritical(`${name} HTTP`, String(result.status));
    return;
  }
  pass(`${name} loads`, result.path);

  const text = stripTags(result.body);

  if (result.body.includes("المحتوى قيد الإعداد")) {
    addCritical(`${name} placeholder`, "shows المحتوى قيد الإعداد");
  }

  if (/\b&lt;p&gt;|\b&lt;strong&gt;|\b&lt;ul&gt;/.test(result.body) || /\&lt;p\&gt;/.test(result.body)) {
    addCritical(`${name} escaped HTML`, "HTML tags visible as text");
  }

  if (/<p>\s*<strong>/.test(text) && !result.body.includes('class="rich-text-content"')) {
    // raw tags in visible text outside rich-text wrapper — heuristic
    const rawTagCount = (result.body.match(/>([^<]*<p>[^<]+<\/p>[^<]*)</g) ?? []).length;
    if (rawTagCount > 0) addMedium(`${name} raw HTML`, "possible unrendered HTML in body");
  }

  if (result.body.includes("201000000000") || result.body.includes("201012345678")) {
    addCritical(`${name} WhatsApp`, "wrong WhatsApp number in HTML");
  }

  if (!result.body.includes("wa.me/201033766876") && (result.path === "/" || result.path.includes("contact"))) {
    addMedium(`${name} WhatsApp link`, "expected wa.me/201033766876 not found on contact-heavy page");
  }

  const placeholderPatterns = [
    /Lorem ipsum/i,
    /placeholder text/i,
    /Listing shell/i,
    /MEDIA_ADMIN_/,
    /ABOUT_STABILITY/,
  ];
  for (const pattern of placeholderPatterns) {
    if (pattern.test(result.body)) addMedium(`${name} placeholder pattern`, pattern.toString());
  }

  const imgSrcs = [...result.body.matchAll(/<img[^>]+src="([^"]+)"/gi)].map((m) => m[1]);
  for (const src of imgSrcs.slice(0, 12)) {
    if (src.startsWith("data:")) continue;
    const imgPath = src.startsWith("http") ? src : `${baseUrl}${src.startsWith("/") ? "" : "/"}${src}`;
    try {
      const imgRes = await fetch(imgPath, { method: "HEAD", cache: "no-store" });
      if (!imgRes.ok) addMedium(`${name} image`, `${src} → ${imgRes.status}`);
    } catch {
      addMedium(`${name} image`, `${src} fetch failed`);
    }
  }

  if (!result.body.includes("<footer") && !result.body.includes("SiteFooter") && !result.body.toLowerCase().includes("footer")) {
    addMedium(`${name} footer`, "footer element not detected in HTML");
  }

  if (!result.body.includes("تابع مشروعك") && name === "Track Your Project") {
    addMedium(name, "expected title missing");
  }
}

const PUBLIC_PAGES = [
  { name: "Home", path: "/" },
  { name: "About", path: "/about" },
  { name: "Projects Hub", path: "/projects" },
  { name: "Topics Hub", path: "/topics" },
  { name: "Media Center Hub", path: "/media-center" },
  { name: "Media News Listing", path: "/media-center/news" },
  { name: "Media Videos Listing", path: "/media-center/videos" },
  { name: "Media Gallery Listing", path: "/media-center/gallery" },
  { name: "Media Press Listing", path: "/media-center/press" },
  { name: "Media Site Updates Listing", path: "/media-center/site-updates" },
  { name: "Contact", path: "/contact" },
  { name: "Track Your Project", path: "/track-your-project" },
];

console.log("=== PUBLIC PAGES ===");
for (const page of PUBLIC_PAGES) {
  const result = await fetchPath(page.path);
  await checkPublicPage(page.name, result);
}

console.log("\n=== DYNAMIC DETAIL PAGES ===");
const { data: project } = await supabase
  .from("projects")
  .select("slug")
  .eq("publication_status", "published")
  .limit(1)
  .maybeSingle();
if (project?.slug) {
  const r = await fetchPath(`/projects/${project.slug}`);
  await checkPublicPage("Project Details", r);
  if (r.body.includes("rich-text-content")) pass("Project rich-text wrapper", project.slug);
} else {
  addCritical("Project Details", "no published project in DB");
}

const { data: topic } = await supabase
  .from("topics")
  .select("slug")
  .eq("status", "published")
  .is("deleted_at", null)
  .limit(1)
  .maybeSingle();
if (topic?.slug) {
  const r = await fetchPath(`/topics/${topic.slug}`);
  await checkPublicPage("Topic Details", r);
} else {
  addMedium("Topic Details", "no published topic — skipped");
}

for (const type of ["news", "videos", "gallery", "press", "site-updates"]) {
  const { data: item } = await supabase
    .from("media_items")
    .select("slug")
    .eq("type", type === "site-updates" ? "site-update" : type === "videos" ? "video" : type === "gallery" ? "gallery" : type === "press" ? "press" : "news")
    .eq("status", "published")
    .limit(1)
    .maybeSingle();

  const dbType = type === "site-updates" ? "site-update" : type === "videos" ? "video" : type;
  const { data: item2 } = await supabase
    .from("media_items")
    .select("slug,type")
    .eq("status", "published")
    .ilike("type", dbType === "site-update" ? "site-update" : dbType)
    .limit(1)
    .maybeSingle();

  const slug = item?.slug ?? item2?.slug;
  if (slug) {
    const r = await fetchPath(`/media-center/${type}/${slug}`);
    await checkPublicPage(`Media Detail (${type})`, r);
  } else {
    addLow(`Media Detail (${type})`, "no published item — skipped");
  }
}

console.log("\n=== INTERNAL LINKS (Home nav sample) ===");
const home = await fetchPath("/");
const hrefs = [...home.body.matchAll(/href="(\/[^"#?]+)"/gi)].map((m) => m[1]);
const unique = [...new Set(hrefs)].filter((h) => h.startsWith("/") && !h.startsWith("/admin"));
for (const href of unique.slice(0, 15)) {
  const r = await fetchPath(href);
  if (r.status === 404) addCritical("Internal link 404", href);
  else if (r.status >= 400) addMedium("Internal link error", `${href} → ${r.status}`);
  else pass("Internal link", href);
}

console.log("\n=== ADMIN PAGES (load check) ===");
const ADMIN_PAGES = [
  "/admin/pages-blocks/blocks/hero",
  "/admin/pages-blocks/pages",
  "/admin/projects",
  "/admin/topics",
  "/admin/media-center",
  "/admin/pages-blocks/footer",
  "/admin/pages-blocks/menus",
];

for (const path of ADMIN_PAGES) {
  const r = await fetchPath(path);
  if (r.status !== 200) addCritical(`Admin ${path}`, String(r.status));
  else if (r.body.includes("Application error") || r.body.includes("Unhandled Runtime Error")) {
    addCritical(`Admin ${path}`, "runtime error in HTML");
  } else pass(`Admin loads`, path);
}

const { data: homePage } = await supabase.from("pages").select("id").eq("slug", "home").maybeSingle();
if (homePage?.id) {
  const r = await fetchPath(`/admin/pages-blocks/pages/${homePage.id}`);
  if (r.status === 200) pass("Admin page modules", `/admin/pages-blocks/pages/${homePage.id}`);
  else addMedium("Admin page modules", String(r.status));
}

console.log("\n=== SUMMARY ===");
console.log(JSON.stringify({ critical: critical.length, medium: medium.length, low: low.length }, null, 2));
if (critical.length) {
  console.log("\nCritical issues:");
  for (const i of critical) console.log(`  - ${i.name}: ${i.detail}`);
}
if (medium.length) {
  console.log("\nMedium issues:");
  for (const i of medium) console.log(`  - ${i.name}: ${i.detail}`);
}

process.exit(critical.length ? 1 : 0);

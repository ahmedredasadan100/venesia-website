/**
 * Media Center architecture — CMS pages, shared public contract, and topics truth.
 * Usage: node scripts/media-center-architecture-test.mjs
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

const results = [];

function pass(name, detail) {
  results.push({ name, ok: true, detail });
  console.log(`PASS ${name}${detail ? `: ${detail}` : ""}`);
}

function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.error(`FAIL ${name}: ${detail}`);
}

function read(relPath) {
  return readFileSync(resolve(ROOT, relPath), "utf8");
}

const CMS_SLUGS = [
  "media-center",
  "media-center-news",
  "media-center-videos",
  "media-center-gallery",
  "media-center-press",
  "media-center-site-updates",
];

const PUBLIC_PATHS = [
  "/media-center",
  "/media-center/news",
  "/media-center/videos",
  "/media-center/gallery",
  "/media-center/press",
  "/media-center/site-updates",
];

try {
  const configSource = read("src/lib/media-center-page-config.ts");
  for (const slug of CMS_SLUGS) {
    if (configSource.includes(`"${slug}"`)) pass(`CMS config slug ${slug}`);
    else fail(`CMS config slug ${slug}`, "missing from media-center-page-config");
  }

  for (const path of PUBLIC_PATHS) {
    if (configSource.includes(`"${path}"`)) pass(`CMS config path ${path}`);
    else fail(`CMS config path ${path}`, "missing publicPath");
  }
} catch (error) {
  fail("CMS page config", error instanceof Error ? error.message : String(error));
}

try {
  const hub = read("src/app/(site)/media-center/page.tsx");
  if (hub.includes("getHeroSectionState") && hub.includes("MediaCenterGrid")) {
    pass("Hub uses CMS hero + MediaCenterGrid core");
  } else {
    fail("Hub core wiring", "expected getHeroSectionState + MediaCenterGrid");
  }
  if (hub.includes("PageSlotLayout") && hub.includes("mainAfter={<MediaCenterGrid />}")) {
    pass("Hub PageSlotLayout with frozen grid");
  } else {
    fail("Hub PageSlotLayout", "mainAfter MediaCenterGrid missing");
  }
} catch (error) {
  fail("Hub page", error instanceof Error ? error.message : String(error));
}

const listingRoutes = [
  { file: "src/app/(site)/media-center/news/page.tsx", slug: "media-center-news", core: "MediaListingPage" },
  { file: "src/app/(site)/media-center/videos/page.tsx", slug: "media-center-videos", core: "MediaListingPage" },
  { file: "src/app/(site)/media-center/gallery/page.tsx", slug: "media-center-gallery", core: "MediaListingPage" },
  { file: "src/app/(site)/media-center/press/page.tsx", slug: "media-center-press", core: "MediaListingPage" },
  {
    file: "src/app/(site)/media-center/site-updates/page.tsx",
    slug: "media-center-site-updates",
    core: "MediaListingPage",
  },
];

for (const route of listingRoutes) {
  try {
    const source = read(route.file);
    if (source.includes("MediaListingPage")) pass(`${route.slug} shared public media consumer`);
    else fail(`${route.slug} data source`, "expected shared MediaListingPage consumer");
  } catch (error) {
    fail(route.slug, error instanceof Error ? error.message : String(error));
  }
}

try {
  const provider = read("src/lib/media-center/unified-provider.ts");
  if (provider.includes('.from("topics")') && !provider.includes("media_items")) {
    pass("Public Media reads Unified Content topics only");
  } else {
    fail("Public Media data source", "expected topics-only provider");
  }
} catch (error) {
  fail("Public Media provider", error instanceof Error ? error.message : String(error));
}

try {
  const shell = read("src/components/media-center/MediaCenterShellLayout.tsx");
  if (shell.includes("getHeroSectionState") && shell.includes("allowStaticHeroFallback")) {
    pass("Shell hero visibility rule");
  } else {
    fail("Shell hero visibility rule", "getHeroSectionState/allowStaticHeroFallback missing");
  }
  if (shell.includes("loadPageCompositionBySlug") && shell.includes("getSlotBlocks")) {
    pass("Shell loads CMS blocks for listing pages");
  } else {
    fail("Shell loads CMS blocks", "loadPageCompositionBySlug/getSlotBlocks missing");
  }
  if (shell.includes("MediaCenterCmsBlocksProvider")) {
    pass("Shell provides CMS blocks context to MediaPageShell");
  } else {
    fail("Shell provides CMS blocks", "MediaCenterCmsBlocksProvider missing");
  }
} catch (error) {
  fail("MediaCenterShellLayout", error instanceof Error ? error.message : String(error));
}

try {
  const mediaPageShell = read("src/components/media-center/MediaPageShell.tsx");
  if (mediaPageShell.includes("prefixBlocks") && mediaPageShell.includes("suffixBlocks")) {
    pass("MediaPageShell accepts prefix/suffix blocks");
  } else {
    fail("MediaPageShell block props", "prefixBlocks/suffixBlocks missing");
  }
  if (!mediaPageShell.includes("MediaSidebar")) {
    fail("MediaSidebar unchanged", "unexpected MediaSidebar removal");
  } else {
    pass("MediaSidebar unchanged in MediaPageShell");
  }
} catch (error) {
  fail("MediaPageShell", error instanceof Error ? error.message : String(error));
}

try {
  const revalidate = read("src/lib/page-blocks/admin-revalidate.ts");
  if (revalidate.includes("MEDIA_CENTER_PUBLIC_PATHS")) pass("admin-revalidate media paths");
  else fail("admin-revalidate media paths", "MEDIA_CENTER_PUBLIC_PATHS not imported");
} catch (error) {
  fail("admin-revalidate", error instanceof Error ? error.message : String(error));
}

try {
  read("sql/migrations/20250625000000_media_center_cms_pages_seed.sql");
  pass("SQL migration for CMS pages exists");
} catch {
  fail("SQL migration", "20250625000000_media_center_cms_pages_seed.sql missing");
}

try {
  const { data: pages, error } = await supabase.from("pages").select("slug,path,status").in("slug", CMS_SLUGS);
  if (error) throw error;

  for (const slug of CMS_SLUGS) {
    const row = pages?.find((page) => page.slug === slug);
    if (row?.status === "published" && row.path) pass(`DB page ${slug}`, row.path);
    else fail(`DB page ${slug}`, row ? `status=${row.status}` : "not found — run apply-media-center-pages-seed.mjs");
  }
} catch (error) {
  fail("DB CMS pages", error instanceof Error ? error.message : String(error));
}

const failed = results.filter((item) => !item.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);

if (failed.length) {
  process.exit(1);
}

console.log("Media Center architecture checks OK.");

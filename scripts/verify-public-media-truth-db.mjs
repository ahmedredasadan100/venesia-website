import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(ROOT, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equals = trimmed.indexOf("=");
    if (equals < 1) continue;
    const key = trimmed.slice(0, equals).trim();
    let value = trimmed.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("FAIL Public Media Truth DB: missing Supabase environment.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const [health, topics, topicCategories, hub, sidebar, categoryAudit, migrationAudit, seoAudit, legacyTable, legacyCategories] = await Promise.all([
  db.rpc("global_seo_infrastructure_health"),
  db
    .from("topics")
    .select("id,slug,content_type,status,deleted_at,media_project,media_payload,seo_title")
    .in("content_type", ["news", "press", "site_update", "video", "gallery"]),
  db.from("topic_categories").select("id,slug,parent_id"),
  db.from("media_hub_module_templates").select("id,config"),
  db.from("media_sidebar_module_templates").select("id,widget_key,config"),
  db
    .from("admin_audit_logs")
    .select("entity_id,entity_label,metadata")
    .eq("action", "public_media.legacy_category_migrated")
    .eq("metadata->>migration", "20260804180000_public_media_truth_closure"),
  db
    .from("admin_audit_logs")
    .select("entity_id,entity_label,metadata")
    .eq("action", "public_media.legacy_item_migrated")
    .eq("metadata->>migration", "20260804180000_public_media_truth_closure"),
  db
    .from("admin_audit_logs")
    .select("entity_id,entity_label,metadata")
    .eq("action", "public_media.seo_title_normalized")
    .eq("metadata->>migration", "20260804180000_public_media_truth_closure"),
  db.from("media_items").select("id").limit(1),
  db.from("media_categories").select("id").limit(1),
]);

const failures = [];
if (health.error) failures.push(`health RPC: ${health.error.message}`);
if (topics.error) failures.push(`topics contract: ${topics.error.message}`);
if (topicCategories.error) failures.push(`topic category contract: ${topicCategories.error.message}`);
if (hub.error) failures.push(`hub config: ${hub.error.message}`);
if (sidebar.error) failures.push(`sidebar config: ${sidebar.error.message}`);
if (categoryAudit.error) failures.push(`category audit evidence: ${categoryAudit.error.message}`);
if (migrationAudit.error) failures.push(`migration audit evidence: ${migrationAudit.error.message}`);
if (seoAudit.error) failures.push(`SEO audit evidence: ${seoAudit.error.message}`);

const proof = health.data ?? {};
for (const key of ["public_media_single_source", "public_media_module_contract", "public_media_link_contract"]) {
  if (proof[key] !== true) failures.push(`${key} is not true`);
}
const published = (topics.data ?? []).filter((row) => row.status === "published" && !row.deleted_at);
if (published.length !== proof.public_media_published_count) {
  failures.push(`published count mismatch: rows=${published.length}, diagnostic=${proof.public_media_published_count}`);
}
if ((hub.data ?? []).some((row) => row.config?.source !== "topics" || row.config?.type === "site-update")) {
  failures.push("Media Hub retains a non-topics source or legacy type value");
}
if ((sidebar.data ?? []).some((row) => row.widget_key !== "sections" && row.config?.source !== "topics")) {
  failures.push("Media Sidebar retains a non-topics source");
}
if (!legacyTable.error || !["PGRST205", "42P01"].includes(legacyTable.error.code)) {
  failures.push(`media_items absence was not proven: ${legacyTable.error?.code ?? "query succeeded"}`);
}
if (!legacyCategories.error || !["PGRST205", "42P01"].includes(legacyCategories.error.code)) {
  failures.push(`media_categories absence was not proven: ${legacyCategories.error?.code ?? "query succeeded"}`);
}

const expectedUnavailableVideos = [
  "ask-before-you-fall-video",
  "d174-site-tour-video",
  "hekayet-beit-intro",
  "new-cairo-mall-countdown",
];
const unavailableVideos = published
  .filter((row) => row.content_type === "video" && !row.media_payload?.video_url?.trim())
  .map((row) => row.slug)
  .sort();
if (JSON.stringify(unavailableVideos) !== JSON.stringify(expectedUnavailableVideos)) {
  failures.push(`unavailable video evidence mismatch: ${unavailableVideos.join(", ")}`);
}

const topicById = new Map((topics.data ?? []).map((row) => [String(row.id), row]));
const categoryById = new Map((topicCategories.data ?? []).map((row) => [String(row.id), row]));
const mediaRoot = (topicCategories.data ?? []).find((row) => row.slug === "media-center");
const categoryRows = categoryAudit.data ?? [];
if (categoryRows.length !== 13) failures.push(`category audit evidence count is ${categoryRows.length}, expected 13`);
for (const row of categoryRows) {
  const category = categoryById.get(String(row.entity_id));
  if (
    !category ||
    category.parent_id !== mediaRoot?.id ||
    row.metadata?.source !== "media_categories" ||
    row.metadata?.destination !== "topic_categories"
  ) {
    failures.push(`invalid category audit evidence for ${row.entity_label ?? row.entity_id}`);
  }
}
if (proof.public_media_migrated_category_count !== 13) {
  failures.push(`diagnostic migrated category count is ${String(proof.public_media_migrated_category_count)}`);
}
const migrationRows = migrationAudit.data ?? [];
if (migrationRows.length !== 28) failures.push(`migration audit evidence count is ${migrationRows.length}, expected 28`);
for (const row of migrationRows) {
  if (!topicById.has(String(row.entity_id)) || row.metadata?.source !== "media_items" || row.metadata?.destination !== "topics") {
    failures.push(`invalid migration audit evidence for ${row.entity_label ?? row.entity_id}`);
  }
}
if (proof.public_media_migrated_count !== 28) {
  failures.push(`diagnostic migrated count is ${String(proof.public_media_migrated_count)}`);
}
const brandSuffix = " | فينيسيا للتطوير العقاري";
const auditRows = seoAudit.data ?? [];
if (auditRows.length !== 14) failures.push(`SEO audit evidence count is ${auditRows.length}, expected 14`);
for (const row of auditRows) {
  const original = row.metadata?.original_seo_title;
  const normalized = row.metadata?.normalized_seo_title;
  const originalLength = row.metadata?.original_length;
  const normalizedLength = row.metadata?.normalized_length;
  const topic = topicById.get(String(row.entity_id));
  if (
    typeof original !== "string" ||
    typeof normalized !== "string" ||
    !original.endsWith(brandSuffix) ||
    normalized !== original.slice(0, -brandSuffix.length) ||
    original.length !== originalLength ||
    normalized.length !== normalizedLength ||
    normalized.length > 60 ||
    topic?.seo_title !== normalized
  ) {
    failures.push(`invalid SEO audit evidence for ${row.entity_label ?? row.entity_id}`);
  }
}
if (proof.public_media_seo_normalization_count !== 14) {
  failures.push(`diagnostic SEO evidence count is ${String(proof.public_media_seo_normalization_count)}`);
}

if (failures.length) {
  console.error("FAIL Public Media Truth DB:");
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}

console.log("PASS Public Media Truth DB:");
console.log(` - ${topics.data?.length ?? 0} Unified Media rows; ${published.length} published.`);
console.log(" - legacy media tables are absent; Hub/Sidebar/link diagnostics prove topics-only adoption.");
console.log(" - 13 legacy-category audit records prove complete category migration under media-center.");
console.log(" - 28 legacy-to-topics audit records preserve migration identity and source provenance.");
console.log(" - 14 SEO before/after audit records are exact and all normalized titles are <= 60 characters.");
console.log(` - ${unavailableVideos.length} published legacy videos remain visible with explicitly empty playback URLs: ${unavailableVideos.join(", ")}.`);

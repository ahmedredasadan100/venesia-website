import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeYouTubeUrl,
  resolveYouTubeEmbedUrl,
} from "../src/lib/admin/media-topic-payload.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");

assert.equal(normalizeYouTubeUrl(""), null, "Blank video data must stay blank");
assert.equal(normalizeYouTubeUrl("https://example.com/not-video"), null, "Non-YouTube URLs must fail closed");
assert.equal(
  normalizeYouTubeUrl("https://youtu.be/dQw4w9WgXcQ"),
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
);
assert.equal(
  resolveYouTubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
  "https://www.youtube.com/embed/dQw4w9WgXcQ",
);
assert.equal(resolveYouTubeEmbedUrl("not a URL"), null, "Invalid playback links must not create an iframe URL");

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolute = join(directory, entry);
    return statSync(absolute).isDirectory() ? walk(absolute) : [absolute];
  });
}

for (const removedOwner of [
  "src/lib/media-center/legacy-provider.ts",
  "src/lib/media-center/source.ts",
  "src/lib/media-center/content-type-map.ts",
]) {
  assert.equal(existsSync(resolve(ROOT, removedOwner)), false, `${removedOwner} must stay removed`);
}

const sourceFiles = walk(resolve(ROOT, "src")).filter((file) =>
  [".ts", ".tsx", ".json"].includes(extname(file)),
);
const legacySourceReferences = sourceFiles.filter((file) => readFileSync(file, "utf8").includes("media_items"));
assert.deepEqual(
  legacySourceReferences.map((file) => relative(ROOT, file).replaceAll("\\", "/")),
  [],
  "runtime source must not retain the media_items owner",
);

const envExample = read(".env.example");
assert.ok(!envExample.includes("PUBLIC_MEDIA_CONTENT_SOURCE"));
assert.ok(!envExample.includes("PUBLIC_MEDIA_LEGACY_FALLBACK"));

const types = read("src/lib/media-center/types.ts");
const provider = read("src/lib/media-center/unified-provider.ts");
const publicOwner = read("src/lib/media-center.ts");
assert.ok(types.includes('Exclude<ContentType, "article">'), "Public Media must reuse the Unified Content type contract");
assert.ok(types.includes("resolvePublicContentPath(item.type, item.slug)"), "Public Media links must use the shared content path owner");
assert.ok(provider.includes('.from("topics")') && !provider.includes("media_items"));
assert.ok(!publicOwner.includes("legacy") && !publicOwner.includes("PUBLIC_MEDIA_"));

const detailLinkPattern = /\/media-center\/(?:news|videos|gallery|press|site-updates)\/\$\{/;
const mediaComponents = walk(resolve(ROOT, "src/components/media-center"))
  .filter((file) => [".ts", ".tsx"].includes(extname(file)));
for (const component of mediaComponents) {
  const componentSource = readFileSync(component, "utf8");
  assert.ok(
    !detailLinkPattern.test(componentSource),
    `${relative(ROOT, component)} contains a parallel media detail link resolver`,
  );
  if (componentSource.includes('"use client"') || componentSource.includes("'use client'")) {
    assert.ok(
      !/from\s+["']\.\.\/\.\.\/lib\/media-center["']/.test(componentSource),
      `${relative(ROOT, component)} imports the server loader barrel across the client boundary`,
    );
  }
}

const metadata = read("src/lib/media-center/generate-media-detail-metadata.ts");
const sitemap = read("src/lib/seo/generate-sitemap-entries.ts");
const revalidation = read("src/lib/media-center/revalidate-public-paths.ts");
const mediaPayloadOwner = read("src/lib/admin/media-topic-payload.ts");
const publicMediaArticle = read("src/components/media-center/MediaDetailArticle.tsx");
const publicMediaAdapter = read("src/lib/media-center/adapt-topic-row.ts");
assert.ok(metadata.includes("getMediaItemBySlug"), "Metadata must consume the public media owner");
assert.ok(sitemap.includes("getMediaItems") && sitemap.includes("getMediaHref(item)"));
assert.ok(revalidation.includes("revalidateMediaCenterCache") && revalidation.includes("MEDIA_CENTER_PUBLIC_PATHS"));
assert.ok(mediaPayloadOwner.includes("export function resolveYouTubeEmbedUrl"), "Video link resolution must stay in the existing payload owner");
assert.ok(publicMediaAdapter.includes("normalizeYouTubeUrl(videoPayload?.video_url"), "Public Media must reject invalid video URLs at its adapter boundary");
assert.ok(publicMediaArticle.includes("resolveYouTubeEmbedUrl(item.videoUrl"));
assert.ok(publicMediaArticle.includes("data-public-media-video-unavailable"), "Missing video links need an explicit public fail-safe state");
assert.ok(!publicMediaArticle.includes("item.videoUrl || item.image"), "The video player must not receive an image URL as a playback fallback");

const links = read("src/lib/admin/links/providers/resources.ts");
const linkTypes = read("src/lib/admin/links/types.ts");
assert.ok(links.includes("resolvePublicContentPath(row.content_type, row.slug)"));
assert.ok(!links.includes("mediaLinkProvider") && !linkTypes.includes('"media_items"'));

const diagnostics = read("src/lib/seo/run-global-seo-health.ts");
for (const check of [
  "public_media_single_source",
  "public_media_module_contract",
  "public_media_link_contract",
  "public_media_category_migration_audit_evidence",
  "public_media_migration_audit_evidence",
  "public_media_seo_normalization_evidence",
  "public_media_editorial_contract",
  "public_media_playable_video_data",
]) {
  assert.ok(diagnostics.includes(check), `Diagnostics is missing ${check}`);
}

const migration = read("sql/migrations/20260804180000_public_media_truth_closure.sql");
for (const proof of [
  "Public Media Truth backfill refused",
  "Public Media Truth row parity failed",
  "insert into public.topics",
  "public_media_migration_map",
  "drop table public.media_items",
  "drop table public.media_categories",
  "public_media_single_source",
  "public_media_seo_normalization_evidence",
  "public_media.seo_title_normalized",
  "public_media.legacy_item_migrated",
  "public_media.legacy_category_migrated",
  "Public Media Truth category parity failed",
  "original_seo_title",
  "normalized_seo_title",
  "expected 14 over-limit titles",
]) {
  assert.ok(migration.includes(proof), `Migration is missing ${proof}`);
}

const manifest = JSON.parse(read("src/lib/admin/media-catalog/write-adoption-manifest.json"));
assert.ok(manifest.providerRegistry.some((provider: { domainKey: string }) => provider.domainKey === "topics"));
assert.ok(!manifest.providerRegistry.some((provider: { domainKey: string }) => provider.domainKey === "legacy_media_items"));

console.log("PASS Public Media Truth: one topics source, one content/link contract, shared metadata/sitemap/cache consumers, diagnostics, and guarded legacy removal.");

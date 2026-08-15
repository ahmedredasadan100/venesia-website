import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildPaginationItems } from "../src/components/pagination-model.ts";
import {
  isMediaListingShellPlaceholder,
  resolveMediaListingMainBlocks,
} from "../src/components/media-center/media-listing-shell-model.ts";
import {
  buildMediaHubModuleConfig,
  parseMediaHubModuleConfig,
} from "../src/lib/media-hub-modules/parse-config.ts";
import type { ContentBlockConfig } from "../src/lib/page-blocks/configs.ts";
import type { ResolvedPageBlock } from "../src/lib/page-blocks/types.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string) {
  return readFileSync(resolve(ROOT, path), "utf8");
}

function paginationLabels(currentPage: number, totalPages: number) {
  return buildPaginationItems(currentPage, totalPages).map((item) =>
    item.type === "page" ? item.page : `${item.position}-ellipsis`,
  );
}

assert.deepEqual(paginationLabels(1, 5), [1, 2, 3, 4, 5]);
assert.deepEqual(paginationLabels(1, 20), [1, 2, 3, 4, 5, "end-ellipsis", 20]);
assert.deepEqual(paginationLabels(10, 20), [
  1,
  "start-ellipsis",
  9,
  10,
  11,
  "end-ellipsis",
  20,
]);
assert.deepEqual(paginationLabels(20, 20), [1, "start-ellipsis", 16, 17, 18, 19, 20]);

for (let currentPage = 1; currentPage <= 100; currentPage += 1) {
  const items = buildPaginationItems(currentPage, 100);
  const pages = items.flatMap((item) => (item.type === "page" ? [item.page] : []));
  assert.ok(items.length <= 7, "scalable pagination must stay bounded");
  assert.ok(pages.includes(currentPage), "scalable pagination must retain the active page");
  assert.equal(new Set(pages).size, pages.length, "page links must not be duplicated");
}

const legacyVideoConfig = parseMediaHubModuleConfig(
  { source: "topics", type: "video", limit: 6 },
  "videos",
);
assert.equal(legacyVideoConfig.limit, 6);
assert.ok(legacyVideoConfig.presentation.title);
assert.ok(legacyVideoConfig.presentation.ctaText);

const presentation = {
  eyebrow: "Video Stories",
  title: "مشاهد من فينيسيا",
  description: "وصف قابل للإدارة من الموديول.",
  ctaText: "شاهد كل الفيديوهات",
};
const managedVideoConfig = buildMediaHubModuleConfig(
  "videos",
  "topics",
  { limit: 6 },
  presentation,
);
assert.deepEqual(managedVideoConfig.presentation, presentation);
assert.deepEqual(
  parseMediaHubModuleConfig(managedVideoConfig, "videos").presentation,
  presentation,
);

function contentBlock(
  assignmentId: number,
  slug: string,
  config: ContentBlockConfig,
): Extract<ResolvedPageBlock, { blockType: "content" }> {
  return {
    assignmentId,
    blockType: "content",
    templateId: assignmentId,
    slot: "main",
    sortOrder: assignmentId,
    isVisible: true,
    template: {
      id: assignmentId,
      name: slug,
      slug,
      description: null,
      variant: "default",
      style_preset: "premium-dark",
      status: "published",
      sort_order: assignmentId,
      config,
    },
  };
}

const placeholderBlock = contentBlock(1, "media-center-news-listing-shell", {
  eyebrow: "",
  title: "Listing shell",
  subtitle: "Publish or replace to show CMS content above the listing.",
  body: "",
  alignment: "start",
});
const configuredBlock = contentBlock(2, "media-center-news-header", {
  eyebrow: "Latest Update",
  title: "أخبار فينيسيا",
  subtitle: "متابعة مستمرة من داخل الـCMS.",
});

assert.equal(isMediaListingShellPlaceholder(placeholderBlock), true);
assert.deepEqual(
  resolveMediaListingMainBlocks("media-center-news", [placeholderBlock]),
  [],
);
assert.deepEqual(
  resolveMediaListingMainBlocks("media-center-news", [placeholderBlock, configuredBlock]),
  [configuredBlock],
);
assert.deepEqual(resolveMediaListingMainBlocks("media-center-news", []), []);

const partiallyManagedListingShell = contentBlock(
  3,
  "media-center-videos-listing-shell",
  {
    eyebrow: "Video Stories",
    title: "Listing shell",
    subtitle: "Publish or replace to show CMS content above the listing.",
    body: "Managed listing introduction.",
    alignment: "start",
  },
);
const [normalizedListingShell] = resolveMediaListingMainBlocks(
  "media-center-videos",
  [partiallyManagedListingShell],
);
assert.equal(normalizedListingShell?.blockType, "content");
if (normalizedListingShell?.blockType === "content") {
  assert.equal(normalizedListingShell.template.config.eyebrow, "Video Stories");
  assert.equal(normalizedListingShell.template.config.body, "Managed listing introduction.");
  assert.equal(normalizedListingShell.template.config.title, "");
  assert.equal(normalizedListingShell.template.config.subtitle, "");
}

const hubComponents = [
  "MediaCenterHubFeatured.tsx",
  "MediaCenterHubTimeline.tsx",
  "MediaCenterHubVideos.tsx",
  "MediaCenterHubGallery.tsx",
  "MediaCenterHubPress.tsx",
];
for (const component of hubComponents) {
  const source = read(`src/components/media-center/${component}`);
  assert.ok(
    source.includes("MediaCenterHubSectionHeader") && source.includes("presentation={presentation}"),
    `${component} must adopt the shared CMS presentation owner`,
  );
}

const videosSource = read("src/components/media-center/MediaCenterHubVideos.tsx");
assert.ok(videosSource.includes("smallVideos.map"));
assert.ok(!videosSource.includes("smallVideos.slice"));

const listingConfigSource = read("src/lib/media-center/listing-page-config.ts");
assert.ok(!/^\s+(title|eyebrow|description):/m.test(listingConfigSource));

const shellConfigSource = read("src/lib/media-center-page-config.ts");
assert.ok(!/^\s+(title|eyebrow|subtitle):/m.test(shellConfigSource));

const listingContentSource = read("src/components/media-center/MediaListingContent.tsx");
assert.ok(!listingContentSource.includes("title: string"));
assert.ok(!listingContentSource.includes("eyebrow: string"));
assert.ok(!listingContentSource.includes("description: string"));

const shellSource = read("src/components/media-center/MediaCenterShellLayout.tsx");
assert.ok(shellSource.includes("resolveMediaListingMainBlocks"));
assert.ok(shellSource.includes("MediaListingShellPlaceholder"));
assert.ok(shellSource.includes("!composition.hasCompositionError"));
assert.ok(shellSource.includes("mainBlocks.length === 0"));
assert.ok(!shellSource.includes("listingMainBlocks.length === 0"));

const paginationSource = read("src/components/Pagination.tsx");
assert.ok(paginationSource.startsWith('"use client"'));
assert.ok(paginationSource.includes("useLayoutEffect"));
assert.ok(paginationSource.includes("retainedViewportTopRef"));
assert.ok(paginationSource.includes("window.scrollBy(0, delta)"));
assert.equal(
  paginationSource.match(/onNavigate=\{retainViewportPosition\}/g)?.length,
  3,
);

const editorSource = read("src/components/admin/page-blocks/MediaHubModuleEditClient.tsx");
for (const fieldName of ["eyebrow", "title", "presentation_description", "cta_text"]) {
  assert.ok(editorSource.includes(`name="${fieldName}"`), `missing CMS field ${fieldName}`);
}

const actionSource = read("src/app/admin/pages-blocks/blocks/media-hub/actions.ts");
assert.ok(actionSource.includes("buildMediaHubModuleConfig"));
assert.ok(actionSource.includes('formData.get("presentation_description")'));
assert.ok(actionSource.includes('formData.get("cta_text")'));

console.log("Media Center product review verification passed.");

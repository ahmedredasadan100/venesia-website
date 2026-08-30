import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFile(resolve(root, path), "utf8");

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

const [
  publicContract,
  configOwner,
  editor,
  editorPage,
  action,
  resolver,
  renderer,
  mediaFacade,
  displayOwner,
] = await Promise.all([
  read("src/lib/content/public-content-read/contract.ts"),
  read("src/lib/media-sidebar-modules/parse-config.ts"),
  read("src/components/admin/page-blocks/MediaSidebarModuleEditClient.tsx"),
  read("src/app/admin/pages-blocks/blocks/media-sidebar/[id]/page.tsx"),
  read("src/app/admin/pages-blocks/blocks/media-sidebar/actions.ts"),
  read("src/lib/media-sidebar-modules/resolve-widget-items.ts"),
  read("src/components/media-center/MediaSidebar.tsx"),
  read("src/lib/media-center.ts"),
  read("src/lib/page-blocks/configs.ts"),
]);

check(
  "legacy latest rows preserve the former Media News source and display defaults",
  configOwner.includes('if (rawSource === "topics") return fallback') &&
    configOwner.includes('const DEFAULT_PRESENTATION: MediaSidebarPresentation = "list"') &&
    configOwner.includes(
      'source: { kind: "media-center", contentType: "news" }',
    ) &&
    configOwner.includes("const LATEST_DISPLAY_DEFAULTS") &&
    configOwner.includes("category: false") &&
    configOwner.includes("series: false") &&
    configOwner.includes("excerpt: false"),
);

check(
  "legacy popular rows preserve the former all-Media source and metadata defaults",
  configOwner.includes(
    'source: { kind: "media-center", contentType: "all" }',
  ) &&
    configOwner.includes("const POPULAR_DISPLAY_DEFAULTS") &&
    configOwner.includes("category: true") &&
    configOwner.includes("series: true"),
);

check(
  "Public Content Read exposes the reusable category or Media source contract",
  publicContract.includes("export type PublicContentSource<") &&
    publicContract.includes("publicContentSourceContentTypes") &&
    configOwner.includes("PublicContentSource<MediaSidebarMediaContentType>"),
);

check(
  "CMS exposes functional source, dependent filter, latest/popular selection, presentation, and no technical data-source field",
  editor.includes('name="source_kind"') &&
    editor.includes('name="category_slug"') &&
    editor.includes('name="content_type"') &&
    editor.includes('name="widget_key"') &&
    editor.includes('name="presentation"') &&
    editor.includes('label="شكل العرض"') &&
    editor.includes('label="طريقة الاختيار"') &&
    !editor.includes('name="data_source"') &&
    editorPage.includes("loadTopicFilterOptionsForAdmin"),
);

check(
  "CMS adopts the one shared six-field display editor",
  editor.includes("<ContentDisplaySettings") &&
    editor.includes("includeIntroCard={false}") &&
    !editor.includes("TopicFormSwitch") &&
    !editor.includes("AdminFormSwitch"),
);

check(
  "config build validates source and limit and serializes the shared display contract",
  configOwner.includes('formData.get("source_kind")') &&
    configOwner.includes('formData.get("category_slug")') &&
  configOwner.includes('formData.get("content_type")') &&
    configOwner.includes('formData.get("limit")') &&
    configOwner.includes('formData.get("presentation")') &&
    configOwner.includes("buildContentDisplayOptionsFromFormData(formData, false)"),
);

check(
  "one Media Sidebar presentation contract preserves list and owns both motion variants",
  configOwner.includes('"list"') &&
    configOwner.includes('"single-carousel"') &&
    configOwner.includes('"group-carousel"') &&
    renderer.includes('data-media-sidebar-presentation="list"') &&
    renderer.includes('data-media-sidebar-presentation="single-carousel"') &&
    renderer.includes('data-media-sidebar-presentation="group-carousel"'),
);

check(
  "motion presentations reuse the existing shared autoplay and dot owners",
  renderer.includes('from "../../hooks/use-auto-carousel"') &&
    renderer.includes('from "../feed-modules/FeedCarouselDots"') &&
    renderer.includes("useAutoCarousel<HTMLDivElement>") &&
    renderer.includes("<FeedCarouselDots") &&
    renderer.includes("feedCarouselFade") &&
    !configOwner.includes("autoplayMs"),
);

check(
  "save and readback adopt the same Media Sidebar config owner",
  action.includes("buildMediaSidebarModuleConfig(widgetKey, formData)") &&
    action.includes("isPersistedMediaSidebarModuleConfigEqual") &&
    action.includes('.select("id,config")'),
);

check(
  "runtime delegates every content read to Public Content Read without parallel latest/popular queries",
  resolver.includes("loadPublicContentCollection") &&
    resolver.includes("publicContentSourceContentTypes(config.source)") &&
    resolver.includes('popularOnly: widget.widgetKey === "popular"') &&
    !resolver.includes("getMediaSidebarLatest") &&
    !resolver.includes("getMediaSidebarPopular") &&
    !mediaFacade.includes("getMediaSidebarLatest") &&
    !mediaFacade.includes("getMediaSidebarPopular"),
);

check(
  "hidden assignments stop before Public Content Read",
  resolver.includes('if (!widget.isVisible || !isContentConfig(config))') &&
    resolver.indexOf('if (!widget.isVisible || !isContentConfig(config))') <
      resolver.indexOf("loadPublicContentCollection({"),
);

check(
  "one shared item-display resolver intersects CMS choice, item truth, and available values",
  displayOwner.includes("export function resolveContentItemDisplay") &&
    resolver.includes("resolveContentItemDisplay(config.display, item.display") &&
    ["title", "image", "category", "series", "excerpt", "date"].every(
      (field) => renderer.includes(`item.display.${field}`),
    ),
);

check(
  "navigation sections stay domain-specific and outside content selection",
  configOwner.includes('source: "navigation"') &&
    resolver.includes("!isContentConfig(config)") &&
    renderer.includes('case "sections"') &&
    renderer.includes('widget.config.source !== "navigation"'),
);

console.log(
  `Media Sidebar content capability verification passed (${passed} checks).`,
);

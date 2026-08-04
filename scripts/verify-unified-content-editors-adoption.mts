import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CONTENT_EDITOR_ADOPTION_MANIFEST,
  CONTENT_EDITOR_ARCHITECTURE,
} from "../src/lib/admin/content/content-editor-adoption-manifest.ts";
import {
  CONTENT_EDITOR_ADAPTERS,
  CONTENT_TYPES,
} from "../src/lib/admin/content/content-types.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures: string[] = [];
let assertions = 0;

function read(path: string) {
  return readFileSync(resolve(ROOT, path), "utf8");
}

function check(label: string, condition: unknown) {
  assertions += 1;
  if (condition) {
    console.log(`PASS ${label}`);
  } else {
    failures.push(label);
    console.error(`FAIL ${label}`);
  }
}

function containsAll(source: string, values: readonly string[]) {
  return values.every((value) => source.includes(value));
}

const shell = read("src/components/admin/content/editors/ContentEditorShell.tsx");
const basic = read("src/components/admin/content/editors/ContentBasicDataPanel.tsx");
const category = read("src/components/admin/content/editors/ContentCategorySelect.tsx");
const publishing = read("src/components/admin/content/editors/ContentPublishingOptions.tsx");
const articleCreate = read("src/components/admin/content/editors/ArticleCreateEditor.tsx");
const articleEdit = read("src/components/admin/content/editors/ArticleEditor.tsx");
const mediaEditor = read("src/components/admin/content/editors/media/MediaContentForm.tsx");
const mediaSave = read("src/app/admin/content/topics/media-actions/save.ts");
const articleSave = read("src/app/admin/content/topics/article-actions/save.ts");
const sharedSave = read("src/app/admin/content/topics/editor-actions/save.ts");
const articleHelpers = read("src/app/admin/content/topics/article-actions/helpers.ts");
const mediaHelpers = read("src/app/admin/content/topics/media-actions/helpers.ts");
const routeCreate = read("src/app/admin/content/topics/new/page.tsx");
const routeEdit = read("src/app/admin/content/topics/[id]/page.tsx");
const listActions = read("src/app/admin/content/topics/actions.ts");
const publicPaths = read("src/lib/content/public-content-path.ts");
const mediaContract = read("src/lib/media-center/types.ts");
const topicLoader = read("src/lib/topics/load-public-topics.ts");
const mediaLoader = read("src/lib/media-center/unified-provider.ts");
const entitySeo = read("src/components/admin/seo/AdminEntitySeoPanel.tsx");
const topicSeo = read("src/components/admin/SeoPanel.tsx");
const mediaSeo = read("src/components/admin/content/editors/media/MediaEntitySeoPanel.tsx");
const revalidation = read("src/app/admin/content/topics/editor-actions/revalidate.ts");

check(
  "manifest covers every actual content type exactly once",
  JSON.stringify(CONTENT_EDITOR_ADOPTION_MANIFEST.map((entry) => entry.contentType)) ===
    JSON.stringify(CONTENT_TYPES),
);
check(
  "global closure is bounded to the proven six-type domain",
  CONTENT_EDITOR_ARCHITECTURE.globalClosed === true &&
    CONTENT_EDITOR_ADOPTION_MANIFEST.length === 6,
);
check(
  "all types retain the topics aggregate",
  CONTENT_EDITOR_ADOPTION_MANIFEST.every(
    (entry) => entry.currentContract === "topics_aggregate",
  ),
);
check(
  "only video and gallery own structured media payloads",
  CONTENT_EDITOR_ADOPTION_MANIFEST.find((entry) => entry.contentType === "video")?.bodyContract === "video_payload" &&
    CONTENT_EDITOR_ADOPTION_MANIFEST.find((entry) => entry.contentType === "gallery")?.bodyContract === "gallery_payload" &&
    CONTENT_EDITOR_ADOPTION_MANIFEST.filter((entry) => !["video", "gallery"].includes(entry.contentType)).every((entry) => entry.bodyContract === "markdown"),
);
check(
  "typed adapter registry encodes real differences without a condition-heavy shell",
  CONTENT_EDITOR_ADAPTERS.article.supportsFaq &&
    CONTENT_EDITOR_ADAPTERS.article.supportsDisplaySettings &&
    CONTENT_EDITOR_ADAPTERS.video.body === "video" &&
    CONTENT_EDITOR_ADAPTERS.gallery.body === "gallery" &&
    !shell.includes("contentType ==="),
);

check(
  "one shell owns form runtime tabs dirty navigation and save-close actions",
  containsAll(shell, [
    "<AdminFormRuntime",
    "<AdminModuleTabs",
    "<AdminFormActions",
    "CONTENT_FORM_NAVIGATION",
    "CONTENT_EDITOR_NAVIGATION_EVENT",
  ]),
);
check(
  "one shell supplies the shared Review Section Hero to every content editor",
  containsAll(shell, [
    'tab.id === "publish"',
    "CONTENT_REVIEW_TAB_SECTION",
    "مراجعة المحتوى وحالة النشر",
    "راجع جاهزية المحتوى وإعدادات الظهور، ثم عالج الملاحظات قبل النشر.",
    "tabs={presentedTabs}",
  ]),
);
check(
  "shell owns one hidden content type and optional entity identity",
  shell.includes('name="content_type"') &&
    shell.includes('name="id"') &&
    shell.match(/<AdminFormRuntime\b/g)?.length === 1,
);
check(
  "article create and edit both adopt the shared shell",
  [articleCreate, articleEdit].every(
    (source) => source.match(/<ContentEditorShell\b/g)?.length === 1,
  ),
);
check(
  "all five media types adopt the same shared shell through one typed editor",
  mediaEditor.match(/<ContentEditorShell\b/g)?.length === 1 &&
    routeCreate.includes("<MediaContentForm") &&
    routeEdit.includes("<MediaContentForm"),
);
check(
  "article and media use one Basic Data presentation owner",
  [articleCreate, articleEdit, mediaEditor].every(
    (source) => source.includes("<ContentBasicDataPanel"),
  ),
);
check(
  "article and media use one Review and status presentation owner",
  [articleCreate, articleEdit, mediaEditor].every(
    (source) => source.includes("<ContentPublishingOptions"),
  ),
);

check(
  "common Basic Data contract uses category IDs and shared field geometry",
  containsAll(basic, [
    "ContentCategorySelect",
    "TopicSeriesFields",
    "TopicSlugInput",
    "TopicImageField",
    "contentEditor",
  ]) && category.includes('name="category_id"'),
);
check(
  "legacy article category_slug form contract is removed",
  !basic.includes("category_slug") &&
    !articleCreate.includes('name="category_slug"') &&
    !articleEdit.includes('name="category_slug"') &&
    articleHelpers.includes('getString(formData, "category_id")'),
);
check(
  "one status field contract drives every editor",
  publishing.includes('name="status"') &&
    articleSave.includes('formData.get("status")') &&
    mediaHelpers.includes('getString(formData, "status")') &&
    !articleSave.includes('getBoolean(formData, "is_published")'),
);
check(
  "FAQ stays typed while display popular and visible-date contracts are shared",
  articleCreate.includes("<FaqEditor") &&
    articleEdit.includes("<FaqEditor") &&
    !mediaEditor.includes("<FaqEditor") &&
    CONTENT_TYPES.every((contentType) => CONTENT_EDITOR_ADAPTERS[contentType].supportsDisplaySettings) &&
    CONTENT_TYPES.every((contentType) => CONTENT_EDITOR_ADAPTERS[contentType].supportsPopular) &&
    [articleCreate, articleEdit, mediaEditor].every((source) =>
      source.includes("<ContentDisplaySettings") && source.includes("dateLabel="),
    ),
);
check(
  "video and gallery fields stay outside the shared core",
  mediaEditor.includes("<MediaVideoFields") &&
    mediaEditor.includes("<MediaGalleryFields") &&
    !basic.includes("MediaVideoFields") &&
    !basic.includes("MediaGalleryFields"),
);

check(
  "article and media SEO adapters delegate to the same Entity SEO owner",
  topicSeo.includes("<AdminEntitySeoPanel") &&
    mediaSeo.includes("<AdminEntitySeoPanel") &&
    entitySeo.includes('name={fieldNames.seoTitle}') &&
    topicSeo.includes("CONTENT_EDITOR_NAVIGATION_EVENT") &&
    mediaSeo.includes("CONTENT_EDITOR_NAVIGATION_EVENT"),
);
check(
  "the final nine-field SEO contract remains present in both typed adapters",
  [topicSeo, mediaSeo].every((source) =>
    containsAll(source, [
      "seoTitle",
      "seoDescription",
      "focusKeyword",
      "seoKeywords",
      "canonicalUrl",
      "robotsIndex",
      "robotsFollow",
      "ogImage",
      "ogImageAlt",
    ]),
  ),
);

check(
  "one public save owner dispatches only to typed persistence adapters",
  sharedSave.includes("export async function saveContentForm") &&
    sharedSave.includes("saveArticleContentAdapter") &&
    sharedSave.includes("saveMediaContentAdapter") &&
    [articleCreate, articleEdit, mediaEditor].every((source) =>
      source.includes("action={saveContentForm}"),
    ),
);
check(
  "media create and edit retain one typed action-state persistence adapter",
  mediaSave.includes("saveMediaContentAdapter") &&
    mediaSave.includes("previousState: AdminFormActionState") &&
    mediaSave.includes('mode === "create"') &&
    mediaSave.includes('mode === "edit"'),
);
check(
  "both typed persistence adapters authenticate and return structured correction state",
  [articleSave, mediaSave].every(
    (source) =>
      source.includes("requireAdminSession()") &&
      source.includes("fieldErrors") &&
      source.includes("focusTarget") &&
      source.includes("savedRevision") &&
      source.includes("editHref"),
  ),
);
check(
  "both typed persistence adapters coordinate media references and audit writes",
  [articleSave, mediaSave].every(
    (source) =>
      source.includes("coordinateMediaReferenceEntityMutation") &&
      source.includes("recordCmsAdminAudit"),
  ),
);
check(
  "one revalidation owner covers admin and typed public paths",
  [articleSave, mediaSave].every((source) =>
    source.includes("revalidateUnifiedContentPaths"),
  ) &&
    containsAll(revalidation, [
      "resolvePublicContentBasePath",
      "resolvePublicContentPath",
      "revalidateTopicsCache",
      "revalidateMediaCenterCache",
    ]),
);
check(
  "list publish unpublish duplicate archive and delete stay one aggregate owner",
  containsAll(listActions, [
    "setUnifiedContentStatus",
    "duplicateUnifiedContent",
    "softDeleteUnifiedContent",
    "bulkUpdateUnifiedContent",
    "getPublishFailure",
  ]),
);

check(
  "canonical create and edit routes resolve the typed editor from content_type",
  routeCreate.includes("isContentType(query?.type)") &&
    routeEdit.includes("resolveContentEditor(topic.content_type)") &&
    !routeEdit.includes("resolveContentEditor(topic.category"),
);
check(
  "article public consumers remain article-only",
  topicLoader.includes('PUBLIC_TOPIC_CONTENT_TYPE = "article"') &&
    publicPaths.includes('article: "/topics"'),
);
check(
  "all media public consumers map from the same five topic types",
  mediaContract.includes('Exclude<ContentType, "article">') &&
    mediaContract.includes('site_update: "site-updates"') &&
    mediaLoader.includes('.from("topics")') &&
    !mediaLoader.includes("toTopicsContentType"),
);
check(
  "every manifest public consumer has a real route",
  CONTENT_EDITOR_ADOPTION_MANIFEST.every((entry) => {
    const route = entry.publicConsumer.replace("[slug]", "[slug]/page.tsx");
    const appRoute = entry.contentType === "article"
      ? `src/app/(site)${route}`
      : `src/app/(site)${route}`;
    return existsSync(resolve(ROOT, appRoute));
  }),
);

for (const oldOwner of [
  "src/components/admin/content/editors/article/TopicEditTabs.tsx",
  "src/components/admin/content/editors/article/TopicBasicDataPanel.tsx",
  "src/components/admin/content/editors/article/ArticleTopicCategorySelect.tsx",
  "src/components/admin/content/editors/article/TopicPublishingOptions.tsx",
  "src/app/admin/content/topics/media-actions/create.ts",
  "src/app/admin/content/topics/media-actions/update.ts",
]) {
  check(`retired owner is absent: ${oldOwner}`, !existsSync(resolve(ROOT, oldOwner)));
}

if (failures.length) {
  console.error(`\n${failures.length}/${assertions} content editor adoption checks failed.`);
  process.exit(1);
}

console.log(`\n${assertions}/${assertions} unified content editor adoption checks passed.`);

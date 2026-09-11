import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { resolveMediaListingConfig } from "../src/lib/media-hub-modules/listing-presentation.ts";
import type { MediaHubModuleState } from "../src/lib/media-hub-modules/types.ts";
import { PAGE_MODULE_KINDS } from "../src/lib/page-blocks/types.ts";
import { comparePageAssignmentOrder } from "../src/lib/page-composition/page-assignment-contract.ts";
import {
  REGISTERED_SLOT_MODULE_KINDS,
  SLOT_MODULE_REGISTRY,
} from "../src/lib/page-composition/slot-module-registry.ts";

const ROOT = process.cwd();
const read = (relativePath: string) =>
  readFileSync(resolve(ROOT, relativePath), "utf8").replace(/\r\n?/gu, "\n");

const assignmentCreate = read(
  "src/app/admin/pages-blocks/pages/page-actions/assignment-create.ts",
);
const assignmentHelpers = read(
  "src/app/admin/pages-blocks/pages/page-actions/helpers.ts",
);
const assignmentUpdate = read(
  "src/app/admin/pages-blocks/pages/page-actions/assignment-update.ts",
);
const assignmentReorder = read(
  "src/app/admin/pages-blocks/pages/page-actions/assignment-reorder.ts",
);
const assignmentClient = read(
  "src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx",
);
const compositionRpcOwner = read(
  "sql/migrations/20260805180000_global_truth_atomic_operations_closure.sql",
);
const assignmentModal = read(
  "src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignModal.tsx",
);
const assignmentModalState = read(
  "src/app/admin/pages-blocks/pages/[id]/page-blocks/use-page-blocks-assign-modal.ts",
);
const heroAdminActions = read(
  "src/app/admin/pages-blocks/blocks/hero/actions.ts",
);
const assignmentGrid = read(
  "src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignmentsGrid.tsx",
);
const visualSlotMap = read(
  "src/components/admin/page-blocks/PageVisualSlotMap.tsx",
);
const assignmentReload = read("src/lib/page-blocks/admin-queries.ts");
const templateAssignmentReload = read(
  "src/lib/page-blocks/module-assignments-query.ts",
);
const templateAssignmentSync = read(
  "src/lib/page-blocks/sync-module-page-assignments.ts",
);
const compositionLoader = read("src/lib/page-blocks/load-page-composition.ts");
const compositionTypes = read(
  "src/lib/page-blocks/page-composition-types.ts",
);
const pageBlockLoader = read("src/lib/page-blocks/load-page-blocks.ts");
const pageBlockTypes = read("src/lib/page-blocks/types.ts");
const assignmentOrderContract = read(
  "src/lib/page-composition/page-assignment-contract.ts",
);
const heroLoader = read("src/lib/load-hero-section.ts");
const mediaHubLoader = read(
  "src/lib/media-hub-modules/load-media-hub-modules.ts",
);
const mediaHubPlan = read(
  "src/lib/media-hub-modules/build-media-hub-render-plan.ts",
);
const slotPlan = read(
  "src/components/page-composition/build-slot-render-plan.ts",
);
const slotNodes = read(
  "src/components/page-composition/slot-module-nodes.tsx",
);
const slotLayout = read(
  "src/components/page-composition/PageSlotLayout.tsx",
);
const listingResolver = read(
  "src/lib/media-hub-modules/listing-presentation.ts",
);
const listingRenderer = read(
  "src/components/media-center/MediaListingModule.tsx",
);
const mediaHubRenderer = read(
  "src/components/media-center/renderMediaHubSections.tsx",
);
const listingPage = read(
  "src/components/media-center/MediaListingPage.tsx",
);
const listingShell = read(
  "src/components/media-center/MediaCenterShellLayout.tsx",
);
const mediaDetailPage = read(
  "src/components/media-center/MediaDetailPage.tsx",
);
const topicDetailPage = read(
  "src/app/(site)/topics/[slug]/page.tsx",
);
const topicsPage = read("src/app/(site)/topics/page.tsx");
const homePage = read("src/app/(site)/page.tsx");
const projectsHubCompositionLoader = read(
  "src/lib/projects/load-projects-hub-composition.ts",
);
const directListingSurfaceSources = [
  read("src/app/(site)/[...slug]/page.tsx"),
  read("src/app/(site)/page.tsx"),
  read("src/components/home/HomeMainSlotContent.tsx"),
  read("src/components/about/AboutPageContent.tsx"),
  read("src/components/contact/ContactPageContent.tsx"),
  read("src/components/track/TrackPageContent.tsx"),
  topicsPage,
  `${read("src/app/(site)/media-center/page.tsx")}\n${listingShell}`,
  listingShell,
];
const listingEditorAction = read(
  "src/app/admin/pages-blocks/blocks/media-hub/actions.ts",
);
const listingSeed = read(
  "sql/migrations/20260815092555_media_center_listing_presentation.sql",
);

assert.deepEqual(
  REGISTERED_SLOT_MODULE_KINDS,
  PAGE_MODULE_KINDS,
  "Admin and rendering must share the canonical ordered module inventory",
);
assert.equal(
  SLOT_MODULE_REGISTRY.length,
  PAGE_MODULE_KINDS.length,
  "Every active Page Module kind must have one registry entry",
);
for (const rendererKey of new Set(
  SLOT_MODULE_REGISTRY.map((entry) => entry.rendererKey),
)) {
  assert.match(
    slotLayout,
    new RegExp(`(?:^|\\n)\\s*(?:"${rendererKey}"|${rendererKey}):`, "u"),
    `Registered renderer ${rendererKey} has no runtime implementation`,
  );
}
assert.ok(
  slotLayout.includes("SLOT_RENDERER_REGISTRY[rendererKey]"),
  "Public rendering must dispatch through the runtime renderer registry",
);
assert.ok(
  slotLayout.includes("resolveSlotModuleRegistration(item.moduleKind)"),
  "Public dispatch must resolve module capability from the canonical registry",
);
assert.doesNotMatch(
  slotLayout,
  /item\.kind\s*===\s*["']module["'][^\n]*return\s+["']block["']/u,
  "Page Block families must not bypass the canonical renderer registry",
);
assert.ok(
  slotNodes.includes("moduleKind: block.blockType") &&
    slotPlan.includes("moduleKind: node.moduleKind"),
  "Every Page Block plan item must carry its canonical module kind into dispatch",
);
assert.ok(
  assignmentModal.includes("REGISTERED_SLOT_MODULE_KINDS.map"),
  "Admin assignment options must derive from the canonical registry",
);
assert.doesNotMatch(
  assignmentModal,
  /const\s+ASSIGNABLE_MODULE_KINDS\s*=/u,
  "Admin must not maintain a parallel module allowlist",
);

for (const source of [assignmentCreate, assignmentUpdate]) {
  for (const field of ["slot", "sort_order", "is_visible"]) {
    assert.ok(source.includes(field), `Assignment mutation lost ${field}`);
  }
  assert.ok(
    source.includes('"save_assignment"'),
    "Assignment mutation must use the canonical Composition RPC",
  );
}
assert.ok(
  assignmentCreate.includes("template_id: options.templateId"),
  "Assignment create must persist the selected template identity",
);
assert.ok(
  assignmentUpdate.includes("assignment_id: assignmentId"),
  "Assignment edit must target the selected assignment identity",
);
assert.ok(
  (assignmentReload.match(
    /id,page_id,template_id,slot,sort_order,is_visible,updated_at/gu,
  )?.length ?? 0) >= 8,
  "Admin reload must read complete assignment state for every stored family",
);
assert.ok(
  templateAssignmentReload.includes("for (const row of assignments ?? [])"),
  "Template reload must preserve all returned assignments",
);
assert.doesNotMatch(
  templateAssignmentReload,
  /\.maybeSingle\(|\.single\(/u,
  "Template reload must not collapse multiple assignments",
);
assert.ok(
  templateAssignmentSync.includes('p_operation: "sync_template_pages"') &&
    templateAssignmentSync.includes("page_ids: targetIds"),
  "Template save must use the existing multi-page assignment sync contract",
);
const heroCreateStart = assignmentCreate.indexOf(
  "export async function assignHeroModule",
);
assert.ok(heroCreateStart >= 0, "Hero create action is missing");
const flexibleAssignmentCreate = assignmentCreate.slice(0, heroCreateStart);
const heroAssignmentCreate = assignmentCreate.slice(heroCreateStart);
assert.ok(
  flexibleAssignmentCreate.includes("nextPageCompositionSortOrder(pageId, slot)"),
  "Flexible assignment families must use the shared page-and-Position auto-order owner",
);
assert.ok(
  assignmentHelpers.includes('.from("page_composition_assignments")') &&
    assignmentHelpers.includes('.eq("page_id", pageId)') &&
    assignmentHelpers.includes('.eq("slot", slot)') &&
    assignmentHelpers.includes('.neq("kind", "hero")') &&
    assignmentHelpers.includes('.order("sort_order", { ascending: false })') &&
    assignmentHelpers.includes("(data?.[0]?.sort_order ?? 0) + 10"),
  "Auto-order must derive from the cross-kind Page Composition read model for the selected Position",
);
assert.doesNotMatch(
  assignmentCreate,
  /next(?:Block|Cards|Content|Cta|Feed|Featured|Hero|Media\w*)SortOrder/u,
  "Assignment create must not restore family-local auto-order helpers",
);
const saveAssignmentExcludesHeroFromNormalization =
  compositionRpcOwner.includes(
    "where page_id = p_page_id and kind <> 'hero'",
  );
assert.ok(
  saveAssignmentExcludesHeroFromNormalization,
  "Hero must remain outside flexible Assignment normalization",
);
assert.ok(
  assignmentClient.includes('if (row.module_kind === "hero") return [row]') &&
    assignmentClient.includes('candidate.module_kind !== "hero"'),
  "Admin sibling and optimistic normalization must exclude the fixed Hero owner",
);
assert.ok(
  heroAssignmentCreate.includes("getHeroAssignmentConflicts([pageId])") &&
    templateAssignmentReload.includes(
      "export async function getHeroAssignmentConflicts",
    ) &&
    templateAssignmentReload.includes('.from("hero_assignments")') &&
    templateAssignmentReload.includes('.eq("target_type", "page")') &&
    templateAssignmentReload.includes('.in("target_id", targetPageIds)') &&
    templateAssignmentReload.includes('.neq("hero_id", exceptHeroId)') &&
    heroAdminActions.includes("getHeroAssignmentConflicts(pageIds, id)") &&
    assignmentModalState.includes('assignment.module_kind === "hero"') &&
    assignmentModalState.includes("? []"),
  "Hero assignment create and template sync must enforce the Admin singleton contract",
);
assert.ok(
  heroAssignmentCreate.includes("sort_order: 0") &&
    assignmentUpdate.includes("sort_order: 0") &&
    !heroAssignmentCreate.includes("nextPageCompositionSortOrder") &&
    assignmentModal.includes('assignModuleKind === "hero"') &&
    assignmentModal.includes('type="hidden" name="sort_order" value="0"'),
  "Hero must keep its fixed top order outside flexible auto-order",
);
assert.ok(
  assignmentClient.includes('if (row.module_kind === "hero") return [row]') &&
    assignmentClient.includes('if (row.module_kind === "hero") return;') &&
    assignmentGrid.includes('row.module_kind !== "hero"') &&
    assignmentReorder.includes('assignment.kind === "hero"') &&
    assignmentReorder.includes('code: "hero_order_is_fixed"'),
  "The fixed Hero row must stay outside Admin peer reorder without disabling non-Hero Position peers",
);
assert.ok(
  visualSlotMap.includes('if (slot === "hero")') &&
    visualSlotMap.includes('first.module_kind === "hero"') &&
    visualSlotMap.includes('second.module_kind === "hero"') &&
    visualSlotMap.includes("return firstIsHero ? -1 : 1") &&
    visualSlotMap.includes("comparePageAssignmentOrder("),
  "The Admin visual map must keep the fixed Hero above canonically ordered composable peers",
);
assert.ok(
  assignmentClient.includes("assignments: instant.rows") &&
    assignmentClient.includes('normalizeLayoutSlot(row.slot) === "hero"') &&
    assignmentClient.includes("Math.floor((previous.sort_order + next.sort_order) / 2)") &&
    assignmentClient.includes("heroPeerSortOrder !== null") &&
    assignmentClient.includes("updatePageBlockAssignment(") &&
    assignmentClient.includes('candidate.module_kind === "hero"'),
  "Admin must use live assignment state and persist Hero-Position peer reorder through one exact non-Hero save",
);
assert.ok(
  heroAssignmentCreate.includes(
    'is_visible: parseFormBoolean(formData, "is_visible", true)',
  ),
  "Hero create must persist the Admin-selected Assignment visibility",
);
assert.doesNotMatch(
  assignmentCreate,
  /save_hero_assignment[\s\S]{0,240}is_visible:\s*true/u,
  "Hero create must not force a visible Assignment",
);

assert.ok(
  compositionLoader.includes("queryMediaHubModules(pageSlug)"),
  "Every page composition must load its assigned Media Hub modules",
);
assert.doesNotMatch(
  compositionLoader,
  /isMediaCenterCmsPageSlug|hubModule\.config\.placement\s*===\s*["']listing["']/u,
  "Composition must not route-gate or remove Media Listing assignments",
);
assert.ok(
  compositionLoader.includes("slots[hubModule.slot].push"),
  "Media Listing Position must flow into its persisted slot",
);
assert.ok(
  compositionLoader.includes("!hubModule.isVisible"),
  "Assignment visibility must be honored before public rendering",
);
assert.ok(
  mediaHubLoader.includes('.order("sort_order", { ascending: true })') &&
    mediaHubLoader.includes('.order("id", { ascending: true })'),
  "Media Hub reload must be deterministic by Order then Assignment identity",
);
assert.ok(
  assignmentOrderContract.includes("first.sortOrder - second.sortOrder") &&
    assignmentOrderContract.includes(
      "first.moduleKind.localeCompare(second.moduleKind)",
    ) &&
    assignmentOrderContract.includes("first.assignmentId - second.assignmentId"),
  "The canonical comparator must be sortOrder -> moduleKind -> numeric assignmentId",
);
for (const [source, owner] of [
  [assignmentReload, "Admin reload"],
  [compositionLoader, "Composition loader"],
  [visualSlotMap, "Admin visual map"],
  [slotPlan, "Public slot plan"],
  [slotNodes, "Page Block node plan"],
  [mediaHubPlan, "Media Hub plan"],
] as const) {
  assert.ok(
    source.includes("comparePageAssignmentOrder"),
    `${owner} must consume the canonical cross-kind comparator`,
  );
}
assert.ok(
  slotPlan.includes("comparePageAssignmentOrder(left, right)"),
  "The final public plan must sort through the canonical comparator",
);
assert.doesNotMatch(slotPlan, /key\.localeCompare/u, "Render keys must not own public order");
assert.doesNotMatch(
  slotNodes,
  /indexBySlug|bySlug\.get/u,
  "Slug indexing must not collapse repeated valid assignments",
);

const crossKindOrderFixture = [
  { sortOrder: 10, moduleKind: "feed" as const, assignmentId: 1 },
  { sortOrder: 10, moduleKind: "content" as const, assignmentId: 100 },
  { sortOrder: 10, moduleKind: "content" as const, assignmentId: 2 },
].sort(comparePageAssignmentOrder);
assert.deepEqual(
  crossKindOrderFixture.map(({ moduleKind, assignmentId }) =>
    `${moduleKind}:${assignmentId}`
  ),
  ["content:2", "content:100", "feed:1"],
  "Flexible cross-kind ties must match Admin reload: kind before table-local Assignment id",
);

assert.ok(
  slotPlan.includes("function buildAdjacentContactFormPairs(entries: SlotEntry[])") &&
    slotPlan.includes("comparePageAssignmentOrder(slotEntryOrder(left), slotEntryOrder(right))") &&
    slotPlan.includes("const next = ordered[index + 1]") &&
    slotPlan.includes('current.kind !== "block" || next.kind !== "block"') &&
    slotPlan.includes("buildSlotModuleNodes(blocks, context, contactFormPairs)"),
  "Contact pairing must use adjacency in the complete canonical slot sequence",
);
assert.ok(
  slotNodes.includes("contactFormPairs: readonly ContactFormPair[] = []") &&
    slotNodes.includes('slug === "contact-form-office" ? block : undefined') &&
    slotNodes.includes('slug === "contact-form" ? block : undefined'),
  "Non-adjacent and unmatched Contact assignments must retain independent half rendering",
);
assert.doesNotMatch(
  slotNodes,
  /const\s+(?:offices|forms)\s*=\s*blocks\.filter/u,
  "Contact halves must not pair by family occurrence across intervening Assignments",
);

type ContactAdjacencyFixture = {
  assignmentId: number;
  sortOrder: number;
  moduleKind: "content" | "feed";
  label: string;
  slug?: "contact-form-office" | "contact-form" | "generic";
};
const projectContactAdjacency = (entries: ContactAdjacencyFixture[]) => {
  const ordered = [...entries].sort(comparePageAssignmentOrder);
  const keys: string[] = [];
  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index];
    const next = ordered[index + 1];
    const complementary = Boolean(
      next &&
        ((current.slug === "contact-form-office" && next.slug === "contact-form") ||
          (current.slug === "contact-form" && next.slug === "contact-form-office")),
    );
    if (complementary) {
      keys.push(`pair:${current.label}+${next.label}`);
      index += 1;
    } else {
      keys.push(current.label);
    }
  }
  return keys;
};
assert.deepEqual(
  projectContactAdjacency([
    { assignmentId: 301, sortOrder: 10, moduleKind: "content", label: "office-a", slug: "contact-form-office" },
    { assignmentId: 302, sortOrder: 20, moduleKind: "content", label: "form-a", slug: "contact-form" },
    { assignmentId: 303, sortOrder: 30, moduleKind: "content", label: "office-b", slug: "contact-form-office" },
    { assignmentId: 304, sortOrder: 40, moduleKind: "content", label: "form-b", slug: "contact-form" },
  ]),
  ["pair:office-a+form-a", "pair:office-b+form-b"],
  "Multiple adjacent Contact pairs must remain independently renderable",
);
for (const middle of [
  { assignmentId: 305, sortOrder: 20, moduleKind: "content" as const, label: "block", slug: "generic" as const },
  { assignmentId: 7, sortOrder: 20, moduleKind: "feed" as const, label: "feed" },
]) {
  assert.deepEqual(
    projectContactAdjacency([
      { assignmentId: 306, sortOrder: 10, moduleKind: "content", label: "office", slug: "contact-form-office" },
      middle,
      { assignmentId: 307, sortOrder: 30, moduleKind: "content", label: "form", slug: "contact-form" },
    ]),
    ["office", middle.label, "form"],
    `${middle.label} interleaving must prevent Contact content from moving across saved order`,
  );
}

assert.ok(
  heroLoader.includes('.order("priority", { ascending: false })') &&
    heroLoader.includes(".limit(1)") &&
    heroLoader.includes("return resolveAssignedHeroRow(byId.data)") &&
    heroLoader.includes("return resolveAssignedHeroRow(byPath.data)"),
  "Hero loading must resolve one authoritative singleton Assignment",
);
assert.ok(
  compositionLoader.includes(
    "if (heroState.hero && heroState.assignmentId !== null)",
  ) &&
    compositionLoader.includes('kind: "hero"') &&
    compositionLoader.includes("sortOrder: 0") &&
    slotPlan.includes(
      'const composableEntries = entries.filter((entry) => entry.kind !== "hero")',
    ),
  "The fixed Hero singleton must stay outside the composable mixed-order plan",
);
assert.ok(
  slotLayout.includes(
    'composition.slots.hero.find((entry) => entry.kind === "hero")',
  ) &&
    slotLayout.includes("SLOT_RENDERER_REGISTRY.hero") &&
    slotLayout.includes(
      "compositionFooter: renderPeersInHeroFooter ? peerContent : undefined",
    ) &&
    slotLayout.includes("heroEntry && !usesStandaloneHeroPresentation") &&
    slotLayout.includes("!renderPeersInHeroFooter && peerNodes.length > 0") &&
    slotLayout.includes('data-page-fixed-hero={heroEntry ? "singleton" : undefined}') &&
    slotLayout.includes(
      'data-hero-composition-peers="ordered-below-fixed-hero"',
    ),
  "Hero Position must render its fixed singleton above independently ordered non-Hero peers",
);
assert.ok(
  slotLayout.includes('composition.heroVisibility === "none"') &&
    slotLayout.includes("? fallbackHero"),
  "Static Hero fallback must appear only when no assignment row exists",
);

assert.doesNotMatch(
  listingResolver,
  /\.find\(|fallbackMediaType|getDefaultMediaListingPresentation/u,
  "Media Listing must resolve one supplied Assignment, never the first config or a route fallback",
);
assert.ok(
  listingResolver.includes("assignmentId: module.assignmentId") &&
    listingResolver.includes("presentation: module.config.listing"),
  "Media Listing configuration and identity must remain Assignment-scoped",
);
assert.ok(
  mediaHubRenderer.includes('module.config.placement === "listing"') &&
    mediaHubRenderer.includes("<MediaListingModule") &&
    mediaHubRenderer.includes("if (!listingContext) return null"),
  "Media Listing must render inside the registered Media Hub renderer",
);
assert.ok(
  listingRenderer.includes("resolveMediaListingConfig(module)") &&
    listingRenderer.includes("data-media-listing-assignment") &&
    listingRenderer.includes("pageSize: presentation.itemLimit") &&
    listingRenderer.includes("displayOverrides={presentation.display}"),
  "Media Listing renderer must consume each Assignment's full configuration",
);
assert.doesNotMatch(
  listingPage,
  /resolveMediaListingConfig|getMediaListingPage|MediaListingContent|mainAfter/u,
  "Media Listing page must not keep a parallel rendering path",
);
assert.ok(
  listingPage.includes("resolvePublicContentPageRoute(config.mediaType)") &&
    listingPage.includes("pageIdentity={pageIdentity}") &&
    listingShell.includes("publicPath={pageIdentity.href}"),
  "Media Listing page must supply its owner-resolved public identity to Composition context",
);
assert.ok(
  compositionTypes.includes("export type ListingRenderContext") &&
    slotNodes.includes("listingContext?: ListingRenderContext") &&
    mediaHubRenderer.includes("listingContext?: ListingRenderContext") &&
    slotLayout.includes("listingContext?: ListingRenderContext"),
  "Topics and Media Listing must consume one shared request-context contract",
);
assert.doesNotMatch(
  listingRenderer,
  /publicPath\s*\?\?\s*copy\.basePath/u,
  "Media Listing must fail closed without direct-page request context",
);
for (const source of directListingSurfaceSources) {
  assert.ok(
    source.includes("listingContext="),
    "Every direct Page Composition surface must supply shared Listing request context",
  );
}
assert.doesNotMatch(
  mediaDetailPage,
  /loadPageCompositionBySlug|PageSlotLayout|PageSlotContent|getHeroSlotPeerEntries|listingContext=|searchParams/u,
  "Media detail must stay isolated from the parent Listing composition and its request context",
);
assert.ok(
  mediaDetailPage.includes("<InternalPageLayout") &&
    mediaDetailPage.includes("<MediaDetailArticle") &&
    mediaDetailPage.includes("const pagePath = getMediaHref(item)"),
  "Media detail must render the intrinsic entity shell and resolve its canonical public path through the shared owner",
);
assert.doesNotMatch(
  topicDetailPage,
  /listingContext=/u,
  "Inherited Topic detail Composition must not render the parent Listing surface",
);
assert.ok(
  slotLayout.includes("run.flatMap((entry)") &&
    slotLayout.includes("renderPlanItem(entry, options)"),
  "Every Media Hub Assignment in an ordered run must reach the public renderer",
);
assert.doesNotMatch(
  listingShell,
  /mainAfter=|children:/u,
  "Media Listing shell must not append code-owned content outside Composition",
);
assert.ok(
  listingEditorAction.includes("buildMediaHubModuleConfig") &&
    listingEditorAction.includes("syncMediaHubModulePageAssignments"),
  "Media Listing Edit/Save must retain the existing config and Assignment owners",
);

assert.ok(
  slotNodes.includes("isTopicsListingTemplate(slug, block.template.variant)") &&
    slotNodes.includes("if (context.listingContext)") &&
    slotNodes.includes("<TopicsListingContent") &&
    slotNodes.includes("block={block}") &&
    slotNodes.includes("context={context.listingContext}"),
  "Every Topics Listing Assignment must render from its own block through shared context",
);
assert.ok(
  pageBlockTypes.includes("templateVariant: string") &&
    pageBlockLoader.includes("templateVariant: template.variant") &&
    topicsPage.includes("hasTopicsListingAssignmentRows") &&
    topicsPage.includes("isTopicsListingTemplate(state.templateSlug, state.templateVariant)"),
  "Hidden or unpublished Topics Listing assignments must remain visible to fallback policy",
);
assert.ok(
  topicsPage.includes(
    "hasTopicsListingAssignmentRows || composition.hasCompositionError",
  ),
  "Topics fallback must fail closed when an assignment exists or Composition truth is unavailable",
);
assert.ok(
  topicsPage.includes("listingContext={{ publicPath: PAGE_IDENTITY.href, searchParams: params }}") &&
    slotLayout.includes("listingContext: options.listingContext"),
  "Topics Listing request context must reach every Position, including Hero",
);
assert.doesNotMatch(
  `${topicsPage}\n${slotLayout}\n${slotNodes}`,
  /topicsListingContentByAssignmentId|getTopicsListingBlocks|buildTopicsListingContent|new Map\(/u,
  "Topics Listing must not restore a route-built Assignment map or first-config adapter",
);
assert.doesNotMatch(
  topicsPage,
  /loadPublicTopicsListing/u,
  "The Topics route must not own Assignment data loading",
);
assert.ok(
  compositionLoader.includes("blockState.blocks.some((block)") &&
    compositionLoader.includes("isHomeProjectsTemplate(block.template.slug, block.template.variant)") &&
    compositionLoader.includes("await loadHomepageProjects()") &&
    compositionTypes.includes("homepageProjects: HomepageProjectCard[] | null") &&
    slotLayout.includes("?? composition.homepageProjects") &&
    homePage.includes("composition.homepageProjects ?? []"),
  "Home Projects intrinsic data must be composition-owned and route-neutral",
);
assert.doesNotMatch(
  compositionLoader,
  /pageSlug\s*===\s*["']home["']|pageSlug\s*!==\s*["']home["']/u,
  "Home Projects data must not be gated by the current route slug",
);
assert.doesNotMatch(
  homePage,
  /loadHomepageProjects|getHomepageProjects/u,
  "The Home route must not keep a parallel intrinsic-data loader",
);

const projectsHubQueryStart = projectsHubCompositionLoader.indexOf(
  "async function queryProjectsHubComposition",
);
const projectsHubPublicLoaderStart = projectsHubCompositionLoader.indexOf(
  "export async function loadProjectsHubComposition",
);
assert.ok(
  projectsHubQueryStart >= 0 && projectsHubPublicLoaderStart > projectsHubQueryStart,
  "Projects Hub cache owner boundaries are missing",
);
const projectsHubCachedQuery = projectsHubCompositionLoader.slice(
  projectsHubQueryStart,
  projectsHubPublicLoaderStart,
);
const projectsHubPublicLoader = projectsHubCompositionLoader.slice(
  projectsHubPublicLoaderStart,
);
for (const reason of ["page_query_failed", "assignments_query_failed"] as const) {
  assert.ok(
    projectsHubCachedQuery.includes(`failProjectsHubCompositionRead(\n      "${reason}"`),
    `Projects Hub ${reason} must reject inside unstable_cache`,
  );
  assert.doesNotMatch(
    projectsHubCachedQuery,
    new RegExp(`return\\s+\\{\\s*ok:\\s*false,\\s*reason:\\s*"${reason}"`, "u"),
    `Projects Hub ${reason} must not resolve as a cacheable value`,
  );
}
assert.ok(
  projectsHubPublicLoader.includes("unstable_cache(queryProjectsHubComposition") &&
    projectsHubPublicLoader.includes("revalidate: 300") &&
    projectsHubPublicLoader.includes("error instanceof ProjectsHubCompositionReadError") &&
    projectsHubPublicLoader.includes(
      'return { status: "error", ok: false, reason: error.reason }',
    ),
  "Projects Hub must preserve its public failure contract outside the 300-second Data Cache",
);

assert.ok(
  slotPlan.includes("isFeedModuleRenderable(entry.module)") &&
    slotPlan.includes("isFeaturedModuleRenderable(entry.module)") &&
    slotPlan.includes("isMediaHubModuleRenderable(entry.module") &&
    slotNodes.includes("if (!context.homepageProjects?.length) continue") &&
    slotNodes.includes("if (context.listingContext)") &&
    slotLayout.includes("hasRenderableSlotEntries(sidebarEntries, slotContentOptions)") &&
    slotLayout.includes("buildContextualSlotRenderPlan(entries, options).length > 0"),
  "Theme geometry must be driven by the same contextual renderability filters as rendering",
);
assert.equal(
  listingSeed.match(/"placement":"listing"/gu)?.length,
  5,
  "The existing representative seed must retain five Media Listing configs",
);
assert.ok(
  listingSeed.includes("'default_slot', 'main'") &&
    listingSeed.includes("'sync_template_pages'"),
  "Media Listing seed must adopt the same Assignment contract",
);

function listingAssignment(
  assignmentId: number,
  sortOrder: number,
  type: "news" | "video" | "gallery",
  itemLimit: number,
  isVisible = true,
): MediaHubModuleState {
  const sectionKey = type === "video"
    ? "videos"
    : type === "news"
      ? "featured"
      : "gallery";
  return {
    sectionKey,
    assignmentId,
    slot: assignmentId % 2 === 0 ? "bottom" : "main",
    sortOrder,
    isVisible,
    title: `fixture-${assignmentId}`,
    templateSlug: `fixture-${assignmentId}`,
    config: {
      placement: "listing",
      source: "topics",
      type,
      listing: {
        itemLimit,
        presentation: assignmentId % 2 === 0 ? "grid" : "list",
        itemsPerRow: assignmentId % 2 === 0 ? 2 : 3,
        display: {},
      },
      presentation: {},
    } as unknown as MediaHubModuleState["config"],
  };
}

const laterNews = listingAssignment(10, 20, "news", 6);
const earlierVideo = listingAssignment(2, 10, "video", 12);
const hiddenGallery = listingAssignment(1, 0, "gallery", 4, false);
const representativePlan = [laterNews, hiddenGallery, earlierVideo]
  .filter((module) => module.isVisible)
  .sort((left, right) =>
    comparePageAssignmentOrder(
      {
        sortOrder: left.sortOrder,
        moduleKind: "media-hub",
        assignmentId: left.assignmentId,
      },
      {
        sortOrder: right.sortOrder,
        moduleKind: "media-hub",
        assignmentId: right.assignmentId,
      },
    )
  );
assert.deepEqual(
  representativePlan.map((module) => module.assignmentId),
  [2, 10],
  "Public plan must preserve every visible Assignment in saved order",
);
const resolvedListings = representativePlan.map(resolveMediaListingConfig);
assert.ok(resolvedListings.every(Boolean));
assert.deepEqual(
  resolvedListings.map((listing) => ({
    assignmentId: listing?.assignmentId,
    contentType: listing?.contentType,
    itemLimit: listing?.presentation.itemLimit,
  })),
  [
    { assignmentId: 2, contentType: "video", itemLimit: 12 },
    { assignmentId: 10, contentType: "news", itemLimit: 6 },
  ],
  "Multiplicity and each saved Configuration must survive resolution independently",
);

console.log(
  "PASS Position-driven Composition: flexible registry/order/multiplicity integrity, fixed singleton Hero ownership, Media Listing adoption, Projects Hub cache-failure integrity, and anti-allowlist/parallel/first-config guards.",
);

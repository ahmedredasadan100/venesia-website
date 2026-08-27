import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  LAYOUT_SLOT_LABELS,
  LAYOUT_SLOT_LABELS_AR,
  PAGE_COMPOSITION_POSITIONS,
  PAGE_LAYOUT_SLOTS,
} from "../src/lib/page-blocks/layout-slots.ts";
import {
  MODULE_POSITION_CAPABILITIES,
  getAssignablePositions,
  getPageCompositionPositions,
  getUnsupportedAssignmentPositionMessage,
  isAssignmentPositionAllowed,
} from "../src/lib/page-composition/page-assignment-contract.ts";
import {
  buildVenesiaThemeMainLayoutGroups,
  buildVenesiaThemeMainLayoutRows,
} from "../src/components/page-composition/venisia-theme-main-layout-plan.ts";

const root = resolve(process.cwd());
const read = (path) => readFileSync(resolve(root, path), "utf8").replace(/\r\n?/gu, "\n");
const withoutComments = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/^\s*\/\/.*$/gmu, "");
const constitution = read("AI_ARCHITECTURE_PRINCIPLES.md");
const ownershipMap = read("docs/SYSTEMS_RUNTIMES_CAPABILITIES.md");

assert.ok(
  constitution.includes("## 12.7 Page Composition Space and Module Presentation Ownership"),
  "architecture constitution must own the Page Composition/Module Presentation boundary",
);
assert.ok(
  constitution.includes("## ADR-027 — Page Composition Owns Space; Modules Own Presentation"),
  "accepted Module Presentation ownership ADR missing",
);
assert.ok(
  constitution.includes("The responsive contract MUST be bidirectional: `Wide ↔ Editorial ↔ Stack`"),
  "architecture constitution must require bidirectional Presentation restoration",
);
assert.ok(
  ownershipMap.includes("### Public rendering ownership"),
  "operational ownership map must expose the public rendering boundary",
);

for (const slot of PAGE_LAYOUT_SLOTS) {
  assert.ok(LAYOUT_SLOT_LABELS[slot], `missing English label for ${slot}`);
  assert.ok(LAYOUT_SLOT_LABELS_AR[slot], `missing Arabic label for ${slot}`);
}

const platformPositions = getPageCompositionPositions();
assert.deepEqual(
  platformPositions,
  PAGE_COMPOSITION_POSITIONS,
  "Page Composition must be the only Position inventory owner",
);

for (const [kind, positionCapability] of Object.entries(MODULE_POSITION_CAPABILITIES)) {
  if (positionCapability.mode === "fixed") {
    assert.ok(positionCapability.reasonAr, `${kind} fixed Position needs a Product reason`);
    assert.ok(positionCapability.positions.length > 0, `${kind} has no fixed Position`);
    for (const position of positionCapability.positions) {
      assert.ok(PAGE_LAYOUT_SLOTS.includes(position), `${kind} declares unknown Position ${position}`);
    }
  }

  const assignable = getAssignablePositions(kind);
  assert.equal(new Set(assignable).size, assignable.length, `${kind} repeats a Position`);
  if (positionCapability.mode === "page") {
    assert.deepEqual(
      assignable,
      platformPositions,
      `${kind} must inherit the Theme-agnostic Page Composition Positions`,
    );
  }
  for (const slot of PAGE_LAYOUT_SLOTS) {
    assert.equal(
      isAssignmentPositionAllowed(kind, slot),
      assignable.includes(slot),
      `${kind}/${slot} assignment and validation drifted`,
    );
  }
}

assert.deepEqual(getAssignablePositions("content"), [
  "main",
  "sidebar",
  "bottom",
  "footer",
  "hero",
]);
assert.deepEqual(getAssignablePositions("breadcrumb"), platformPositions);
assert.deepEqual(getAssignablePositions("feed"), platformPositions);
assert.deepEqual(getAssignablePositions("hero"), ["hero"]);
assert.deepEqual(getAssignablePositions("media-sidebar"), platformPositions);
assert.deepEqual(getAssignablePositions("media-hub"), platformPositions);

assert.deepEqual(
  getAssignablePositions("unsupported-module-kind"),
  [],
  "unknown module kinds must fail closed",
);
assert.equal(
  isAssignmentPositionAllowed("unsupported-module-kind", "main"),
  false,
  "unknown module assignment must be rejected centrally",
);
assert.equal(
  isAssignmentPositionAllowed("content", "not-a-position"),
  false,
  "unknown position values must fail closed instead of normalizing to main",
);
assert.match(
  getUnsupportedAssignmentPositionMessage("unsupported-module-kind", "main"),
  /Page Composition Contract/,
);

const positionContract = read("src/lib/page-composition/page-assignment-contract.ts");
assert.doesNotMatch(
  positionContract,
  /pageSlug|routeAllows|freeformSlotsForRoute|getPageLayoutModeForRoute|templateSlug|templateVariant|className=/,
  "Position Contract must not depend on Slug, route, Template, Layout, CSS, or current Theme rendering",
);

const assignmentAdmin = read("src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx");
const assignmentRow = read("src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignmentRow.tsx");
const assignmentActions = read("src/app/admin/pages-blocks/pages/page-actions/assignment-update.ts");
assert.ok(assignmentAdmin.includes("handleDisplayPositionChange"));
assert.ok(assignmentRow.includes("displayPositionOptions"));
assert.ok(assignmentActions.includes("slot,"));
assert.ok(!assignmentAdmin.includes("handlePresentationChange"));
assert.ok(!assignmentRow.includes("presentationOptions"));
assert.ok(!assignmentActions.includes('formData.get("presentation")'));
assert.ok(
  !existsSync(resolve(root, "sql/migrations/20260827120000_page_composition_assignment_decisions.sql")),
  "unproven Assignment Presentation migration must stay absent",
);

const layout = read("src/components/page-composition/PageSlotLayout.tsx");
const plan = read("src/components/page-composition/build-slot-render-plan.ts");
const nodes = read("src/components/page-composition/slot-module-nodes.tsx");
const loader = read("src/lib/page-blocks/load-page-composition.ts");
const registry = read("src/lib/page-composition/slot-module-registry.ts");
const moduleMetadata = read("src/lib/page-composition/module-registry-metadata.ts");
const internalLayout = read("src/components/InternalPageLayout.tsx");
const topics = read("src/app/(site)/topics/page.tsx");
const mediaRoot = read("src/app/(site)/media-center/page.tsx");
const mediaShell = read("src/components/media-center/MediaCenterShellLayout.tsx");
const mediaDetail = read("src/components/media-center/MediaDetailPage.tsx");
const home = read("src/components/home/HomeMainSlotContent.tsx");
const homeRoute = read("src/app/(site)/page.tsx");
const projectsPlan = read("src/lib/projects/build-projects-hub-render-plan.ts");
const projectsRenderer = read("src/components/projects/ProjectsHubModulesRenderer.tsx");

assert.ok(layout.includes("export function PageSlotContent"), "shared slot renderer export missing");
assert.ok(layout.includes('data-page-layout-contract="slot-owned"'), "slot-owned layout marker missing");
assert.ok(layout.includes("data-page-layout-body"), "shared body container missing");
assert.ok(layout.includes("xl:grid-cols-[minmax(0,1fr)_340px]"), "main/sidebar grid contract missing");
assert.ok(layout.includes("@container/slot-module"), "every slot entry must expose the shared container-responsive contract");
assert.ok(layout.includes("data-slot-module-container"), "slot module container evidence marker missing");
assert.ok(!layout.includes("page-layout-slot--main min-w-0 space-y-10"), "main slot must not add a second section-spacing owner");
assert.ok(layout.includes("getSlotEntries(composition, \"hero\")"), "Hero additions must use canonical slot entries");
assert.ok(layout.includes("compositionFooter={slotContent}"), "Hero tail must use shared slot content");
assert.ok(!layout.includes('block.blockType === "breadcrumb"'), "Hero renderer must not special-case Breadcrumb");
assert.ok(!layout.includes("SlotModuleWidthFrame"), "layout must not use module-owned width decisions");
assert.ok(!nodes.includes("widthContract"), "module nodes must not own slot width");
assert.ok(!plan.includes("widthContract"), "render plan must not carry module geometry");
assert.ok(!nodes.includes("displayPosition"), "module nodes must not receive Display Position as a presentation switch");
assert.ok(!plan.includes("displayPosition"), "render plan must not carry Display Position into module presentation");
assert.ok(!layout.includes("data-assignment-presentation"), "Page Composition must not carry derived Presentation as Assignment state");
assert.ok(!layout.includes("composition.layoutMode"), "CMS composition must not carry a Theme layout decision");

const assertSpaceOnlyPageComposition = (source) => {
  assert.doesNotMatch(
    source,
    /slot-editorial-|data-module-presentation|aspect-(?:square|video|\[)|object-(?:cover|contain)/,
    "Page Composition must not own internal module presentation",
  );
};
assertSpaceOnlyPageComposition(layout);
assert.throws(
  () => assertSpaceOnlyPageComposition(`${layout}\n<div className="slot-editorial-flow aspect-square object-cover" />`),
  /Page Composition must not own internal module presentation/,
  "presentation leakage into Page Composition must fail closed",
);

assert.ok(loader.includes("isAssignmentPositionAllowed"), "loader must reject Positions outside the platform/Product contract");
assert.ok(!loader.includes("layoutMode") && !loader.includes("getPageLayoutModeForRoute"), "CMS loader must not derive Theme layout from a Slug");
assert.ok(
  loader.includes('isAssignmentPositionAllowed("media-sidebar", widget.slot)') &&
    loader.includes("slots[widget.slot].push") &&
    loader.includes('isAssignmentPositionAllowed("media-hub", hubModule.slot)') &&
    loader.includes("slots[hubModule.slot].push") &&
    !loader.includes("if (!isMediaCenterPage)"),
  "Media assignments must carry their persisted Position into the canonical slot plan",
);
assert.ok(registry.includes("PAGE_COMPOSITION_POSITIONS as PAGE_COMPOSITION_SLOTS"), "registry must alias the canonical Page Composition Position list");
assert.ok(!registry.includes('["hero", "main", "sidebar", "bottom", "footer"]'), "registry must not copy positions");
assert.ok(!moduleMetadata.includes("preferredSlot"), "Template metadata must not own or recommend Assignment Position");

for (const [label, source] of [
  ["Topics", topics],
  ["Media Center", mediaRoot],
  ["Media listing", mediaShell],
  ["Media detail", mediaDetail],
  ["Home", home],
]) {
  assert.ok(source.includes("PageSlotLayout") || source.includes("PageSlotContent"), `${label} has not adopted the shared renderer`);
}
assert.ok(!topics.includes("findHeroSlotBreadcrumb") && !mediaRoot.includes("findHeroSlotBreadcrumb"));
assert.ok(!mediaShell.includes("getSlotBlocks") && !mediaShell.includes("SlotModulesRenderer"));
assert.ok(internalLayout.includes("heroSlotContent") && !internalLayout.includes("heroBreadcrumb"));
assert.ok(!existsSync(resolve(root, "src/components/page-composition/SlotModulesRenderer.tsx")), "parallel slot renderer still exists");
assert.ok(!existsSync(resolve(root, "src/components/home/build-home-main-render-plan.ts")), "parallel Home render plan still exists");
assert.ok(homeRoute.includes('<PageSlotLayout composition={composition} skipSlots={["hero", "main"]}'), "Venesia Home Theme must render every remaining platform Region");
assert.ok(!projectsPlan.includes("unsupported_slot"), "Projects Theme must preserve Assignment Position instead of rejecting non-main Regions");
assert.ok(projectsPlan.includes("position: assignment.slot"), "Projects render plan must carry the Assignment Position unchanged");
assert.ok(projectsRenderer.includes("modulesByPosition") && projectsRenderer.includes("data-layout-slot={position}"), "Projects Theme must map platform Regions without rewriting the CMS contract");

const mediaPageShell = read("src/components/media-center/MediaPageShell.tsx");
const mediaSidebar = read("src/components/media-center/MediaSidebar.tsx");
const mediaListing = read("src/components/media-center/MediaListingPage.tsx");
const globalStyles = read("src/app/globals.css");
assert.ok(!mediaPageShell.includes("MediaSidebar") && !mediaPageShell.includes("grid-cols-[320px_1fr]"), "MediaPageShell must not own a parallel sidebar layout");
assert.ok(mediaSidebar.includes("export function MediaSidebarWidget") && mediaSidebar.includes("export function MediaSidebarSearch"), "Media sidebar presentation must expose thin slot consumers");
assert.ok(mediaListing.includes("sidebarPrefix={") && mediaListing.includes("<MediaSidebarSearch"), "Media search must compose through the shared sidebar prefix contract");

assert.ok(!layout.includes("slot-editorial-flow"), "Page layout must not decide a module's visual composition");
assert.ok(globalStyles.includes(".slot-editorial-flow"), "shared editorial-flow presentation contract missing");
assert.ok(globalStyles.includes("@container slot-module (36rem <= width < 64rem)"), "editorial-flow medium-container contract missing");
assert.ok(globalStyles.includes("float: inline-start") && globalStyles.includes("float: inline-end"), "editorial media must preserve its logical side while copy wraps");
assert.ok(globalStyles.includes("@container slot-module (width >= 64rem)"), "editorial-flow wide composition contract missing");
assert.ok(globalStyles.includes("grid-template-columns: var(--slot-editorial-columns)"), "wide editorial composition must remain module-configurable");

const wideEditorialStart = globalStyles.indexOf("@container slot-module (width >= 64rem)");
const wideEditorialEnd = globalStyles.indexOf("/*\n  Home Story title", wideEditorialStart);
assert.ok(wideEditorialStart >= 0 && wideEditorialEnd > wideEditorialStart, "wide editorial contract boundary missing");
const wideEditorialStyles = globalStyles.slice(wideEditorialStart, wideEditorialEnd);
const assertBidirectionalWideRestoration = (source) => {
  for (const token of [
    "float: none",
    "inline-size: 100%",
    "min-block-size: var(--slot-editorial-wide-media-min-block-size)",
    "aspect-ratio: var(--slot-editorial-wide-media-aspect)",
    "margin-block-start: var(--slot-editorial-wide-media-margin-block-start)",
    "margin-block-end: 0",
    "margin-inline: 0",
    "gap: var(--slot-editorial-wide-gap)",
    "clear: none",
  ]) {
    assert.ok(source.includes(token), `wide Presentation does not restore ${token}`);
  }
};
assertBidirectionalWideRestoration(wideEditorialStyles);
assert.throws(
  () => assertBidirectionalWideRestoration(wideEditorialStyles.replace("aspect-ratio: var(--slot-editorial-wide-media-aspect)", "")),
  /wide Presentation does not restore aspect-ratio/,
  "missing reverse-state restoration must fail closed",
);

const editorialModuleSources = [
  "src/components/modules/WhoWeAreModuleSection.tsx",
  "src/components/modules/AboutIntroSingleImageModuleSection.tsx",
  "src/components/modules/VisionGoalsModuleSection.tsx",
];
for (const path of editorialModuleSources) {
  const source = read(path);
  assert.ok(source.includes('data-module-presentation={'), `${path} must declare editorial presentation adoption`);
  assert.ok(source.includes("slot-editorial-media"), `${path} must preserve media through the shared editorial contract`);
  assert.ok(source.includes("slot-editorial-copy"), `${path} must preserve copy flow through the shared editorial contract`);
  assert.ok(source.includes("slot-editorial-clear"), `${path} must return structured content to the full line width`);
  assert.ok(
    source.includes("aspect-") || source.includes("slot-editorial-flow--media-compact"),
    `${path} must keep an explicit media aspect owner`,
  );
}

const whoWeAre = read("src/components/modules/WhoWeAreModuleSection.tsx");
assert.ok(globalStyles.includes("--slot-editorial-stack-media-aspect: 1 / 1"), "compact media must declare its Stack/Editorial aspect");
assert.ok(globalStyles.includes("--slot-editorial-wide-media-aspect: auto"), "Wide must restore the compact media's original free aspect");
assert.ok(globalStyles.includes("--slot-editorial-wide-media-min-block-size: 32.5rem"), "Wide compact media minimum geometry missing");
assert.ok(globalStyles.includes("--slot-editorial-wide-media-margin-block-start: 3.75rem"), "Wide compact media position missing");
assert.ok(!whoWeAre.includes("aspect-square") && !whoWeAre.includes("@5xl/slot-module:mt-15"), "module-local state classes must not bypass the reversible shared contract");

const aboutCta = read("src/components/modules/AboutCtaModuleSection.tsx");
assert.ok(aboutCta.includes("@3xl/slot-module:grid-cols-[0.68fr_1fr_1.32fr]"), "About CTA must rebalance its triptych before replacing the composition");
assert.ok(!aboutCta.includes("@5xl/slot-module:grid-cols-[0.68fr_1fr_1.32fr]"), "About CTA must not stack solely because Main shares the page with Sidebar");

const venisiaMainLayout = read("src/components/page-composition/VenesiaThemeMainLayout.tsx");
const venisiaMainLayoutPlan = read("src/components/page-composition/venisia-theme-main-layout-plan.ts");
const venisiaMediaHubLayout = read("src/components/page-composition/VenesiaThemeMediaHubLayout.tsx");
const mediaHubNodePresenter = read("src/components/media-center/renderMediaHubSections.tsx");
const mediaHubDataResolver = read("src/lib/media-hub-modules/resolve-hub-section-data.ts");
const collectionItemLimitOwner = read("src/lib/collection-modules/item-limit.ts");
const slotRenderPlan = read("src/components/page-composition/build-slot-render-plan.ts");
const themeLayoutItems = [
  { key: "first", value: "first" },
  { key: "second", value: "second" },
  { key: "third", value: "third" },
];

assert.deepEqual(
  buildVenesiaThemeMainLayoutRows(themeLayoutItems.slice(0, 1), "two-content-columns").map((row) => [row.variant, row.items.length]),
  [["single-column", 1]],
  "one Main item must occupy the full row even when the Theme requests two content columns",
);
assert.deepEqual(
  buildVenesiaThemeMainLayoutRows(themeLayoutItems.slice(0, 2), "two-content-columns").map((row) => [row.variant, row.items.length]),
  [["two-content-columns", 2]],
  "two Main items must resolve to one two-column Theme row",
);
assert.deepEqual(
  buildVenesiaThemeMainLayoutRows(themeLayoutItems, "two-content-columns").map((row) => [row.variant, row.items.length]),
  [["two-content-columns", 2], ["single-column", 1]],
  "an unpaired Main item must fall back to a full-width row",
);
assert.deepEqual(
  buildVenesiaThemeMainLayoutGroups(
    themeLayoutItems,
    ["single-column", "two-content-columns"],
  ).map((group) => [group.variant, group.items.length]),
  [["single-column", 1], ["two-content-columns", 2]],
  "Theme layout patterns must group opaque ordered Nodes without content semantics",
);
assert.ok(venisiaMainLayout.includes("@3xl/slot-module:grid-cols-[0.95fr_1.05fr]"), "Venesia Main two-column layout must fit beside the unchanged Sidebar");
assert.ok(venisiaMainLayout.includes("@container/slot-module"), "each Theme column must expose its real width to the Module presenter");
assert.ok(venisiaMainLayout.includes("data-theme-main-layout-row"), "Theme Main layout must expose runtime proof markers");
assert.doesNotMatch(withoutComments(venisiaMainLayoutPlan), /PageComposition|Assignment|slot|Supabase|Database/iu, "Theme Main layout plan must not depend on CMS or persistence contracts");
assert.ok(venisiaMediaHubLayout.includes("VenesiaThemeMainLayout"), "Venisia Theme must own Media Hub Main layout adoption");
assert.ok(venisiaMediaHubLayout.includes('"two-content-columns"'), "Venisia Theme must select its two-column variant");
assert.doesNotMatch(
  withoutComments(venisiaMediaHubLayout),
  /MediaHubModuleState|sectionKey|config\.|limit|featured|cardVariant|buildMediaHubRenderPlan|renderMediaHubSection/iu,
  "Theme renderer must receive opaque Nodes without Module Presentation or content decisions",
);
assert.ok(layout.includes("renderMediaHubSections") && layout.includes("renderVenesiaThemeMediaHubNodes"), "Theme boundary must receive already-rendered Module Nodes");
assert.ok(mediaHubNodePresenter.includes("buildMediaHubRenderPlan"), "Module Presentation must own visible ordered Node production");
assert.ok(mediaHubNodePresenter.includes("module.config.presentation"), "Module Presentation configuration must reach every Module presenter");
assert.ok(mediaHubNodePresenter.includes("if (node == null) return []"), "Module Presentation must remove empty content before Theme layout");
assert.ok(collectionItemLimitOwner.includes("parseCollectionItemLimit"), "Collection Modules must share one item-limit owner");
assert.ok(mediaHubDataResolver.includes("const itemLimit = config.itemLimit"), "Module Data Selection must receive the semantic item limit");
assert.ok(mediaHubDataResolver.includes("items.slice(0, itemLimit)"), "Module Data Selection must retain item-count ownership");
assert.doesNotMatch(mediaHubNodePresenter, /VenesiaTheme|two-content-columns|shouldRenderHubGridPair|grid-cols/iu, "Module presenter must return Nodes without Theme layout knowledge");
assert.doesNotMatch(slotRenderPlan, /VenesiaTheme|two-content-columns/iu, "shared ordered render plan must remain Theme-neutral");
assert.ok(!venisiaMediaHubLayout.includes("@5xl/slot-module:grid-cols-[0.95fr_1.05fr]"), "Venisia Theme must not retain the old viewport-sized pair grid");

const portableResponsiveSources = [
  "src/components/sections/ContentSection.tsx",
  "src/components/sections/CtaSection.tsx",
  "src/components/sections/CardsSection.tsx",
  "src/components/modules/AboutIntroSingleImageModuleSection.tsx",
  "src/components/modules/AboutApproachModuleSection.tsx",
  "src/components/modules/AboutPrinciplesModuleSection.tsx",
  "src/components/modules/AboutCtaModuleSection.tsx",
  "src/components/modules/WhoWeAreModuleSection.tsx",
  "src/components/modules/VisionGoalsModuleSection.tsx",
  "src/components/home/HomeContactSection.tsx",
  "src/components/home/HomeProjectsSection.tsx",
  "src/components/home/HomeStorySection.tsx",
  "src/components/home/HomeTrustSection.tsx",
  "src/components/contact/ContactCTASection.tsx",
  "src/components/contact/ContactDepartmentsSection.tsx",
  "src/components/contact/ContactFAQSection.tsx",
  "src/components/contact/ContactFloatingTrustCards.tsx",
  "src/components/contact/ContactFormSection.tsx",
  "src/components/contact/ContactMapSection.tsx",
  "src/components/contact/ContactReasonsSection.tsx",
  "src/components/topics/TopicsIntroSection.tsx",
  "src/components/media-center/MediaPageShell.tsx",
  "src/components/media-center/MediaListingContent.tsx",
  "src/components/media-center/renderMediaHubSections.tsx",
  "src/components/media-center/MediaCenterHubPress.tsx",
  "src/components/media-center/MediaCenterHubTimeline.tsx",
  "src/components/media-center/MediaCenterHubGallery.tsx",
  "src/components/media-center/MediaCenterHubSectionHeader.tsx",
  "src/components/media-center/MediaCenterHubFeatured.tsx",
  "src/components/media-center/RelatedMediaRail.tsx",
  "src/components/media-center/MediaDetailArticle.tsx",
];
const viewportResponsiveLayout = /(^|[\s"'`])(?:sm|md|lg|xl|2xl):(?:grid-cols|flex-row|order-|p[trblxy]?-|m[trblxy]?-|min-h|max-w|w-|text-|leading-|hidden|block|flex|grid|sticky|top-)/m;
for (const path of portableResponsiveSources) {
  const source = read(path);
  assert.doesNotMatch(source, viewportResponsiveLayout, `${path} still responds to viewport instead of its assigned slot container`);
}

console.log("PASS Page Composition Position: Theme/Template/Slug-agnostic platform Regions, Assignment-owned Position, flexible-module inheritance, explicit Product-fixed exceptions, module-derived Presentation, Theme adoption, and fail-closed validation.");

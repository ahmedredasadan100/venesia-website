import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  LAYOUT_SLOT_LABELS,
  LAYOUT_SLOT_LABELS_AR,
  PAGE_LAYOUT_SLOTS,
} from "../src/lib/page-blocks/layout-slots.ts";
import {
  MODULE_SLOT_CONTRACT,
  getAssignableSlotsForRoute,
  getPageLayoutModeForRoute,
  getUnsupportedSlotAssignmentMessage,
  isSlotAllowedForRoute,
} from "../src/lib/page-composition/route-slot-policy.ts";

const root = resolve(process.cwd());
const read = (path) => readFileSync(resolve(root, path), "utf8").replace(/\r\n?/gu, "\n");
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

const routeFamilies = [
  "home",
  "projects",
  "about",
  "contact",
  "topics",
  "media-center",
  "media-center-news",
  "dynamic-page",
];

for (const slot of PAGE_LAYOUT_SLOTS) {
  assert.ok(LAYOUT_SLOT_LABELS[slot], `missing English label for ${slot}`);
  assert.ok(LAYOUT_SLOT_LABELS_AR[slot], `missing Arabic label for ${slot}`);
}

for (const [kind, contract] of Object.entries(MODULE_SLOT_CONTRACT)) {
  assert.ok(contract.allowed.length > 0, `${kind} has no declared position`);
  assert.equal(new Set(contract.allowed).size, contract.allowed.length, `${kind} repeats a position`);
  for (const slot of contract.allowed) {
    assert.ok(PAGE_LAYOUT_SLOTS.includes(slot), `${kind} declares unknown position ${slot}`);
  }
  for (const preferred of contract.preferred) {
    assert.ok(contract.allowed.includes(preferred), `${kind} prefers unsupported position ${preferred}`);
  }

  for (const route of routeFamilies) {
    const assignable = getAssignableSlotsForRoute(route, kind);
    assert.equal(new Set(assignable).size, assignable.length, `${route}/${kind} repeats a position`);
    for (const slot of PAGE_LAYOUT_SLOTS) {
      assert.equal(
        isSlotAllowedForRoute(route, kind, slot),
        assignable.includes(slot),
        `${route}/${kind}/${slot} assignment and validation drifted`,
      );
    }
  }
}

assert.deepEqual(getAssignableSlotsForRoute("home", "content"), ["main"]);
assert.deepEqual(getAssignableSlotsForRoute("projects", "content"), ["main"]);
assert.deepEqual(getAssignableSlotsForRoute("about", "breadcrumb"), [
  "hero",
  "main",
  "sidebar",
  "bottom",
  "footer",
]);
assert.deepEqual(getAssignableSlotsForRoute("topics", "feed"), ["sidebar"]);
assert.deepEqual(getAssignableSlotsForRoute("media-center-news", "content"), [
  "main",
  "bottom",
]);
assert.equal(getPageLayoutModeForRoute("about"), "main-sidebar");
assert.equal(getPageLayoutModeForRoute("topics"), "main-sidebar");
assert.equal(getPageLayoutModeForRoute("media-center-news"), "main-sidebar");

assert.deepEqual(
  getAssignableSlotsForRoute("about", "unsupported-module-kind"),
  [],
  "unknown module kinds must fail closed",
);
assert.equal(
  isSlotAllowedForRoute("about", "unsupported-module-kind", "main"),
  false,
  "unknown module assignment must be rejected centrally",
);
assert.equal(
  isSlotAllowedForRoute("about", "content", "not-a-position"),
  false,
  "unknown position values must fail closed instead of normalizing to main",
);
assert.match(
  getUnsupportedSlotAssignmentMessage("about", "unsupported-module-kind", "main"),
  /لا يوجد موضع عرض مدعوم/,
);

const layout = read("src/components/page-composition/PageSlotLayout.tsx");
const plan = read("src/components/page-composition/build-slot-render-plan.ts");
const nodes = read("src/components/page-composition/slot-module-nodes.tsx");
const loader = read("src/lib/page-blocks/load-page-composition.ts");
const registry = read("src/lib/page-composition/slot-module-registry.ts");
const internalLayout = read("src/components/InternalPageLayout.tsx");
const topics = read("src/app/(site)/topics/page.tsx");
const mediaRoot = read("src/app/(site)/media-center/page.tsx");
const mediaShell = read("src/components/media-center/MediaCenterShellLayout.tsx");
const mediaDetail = read("src/components/media-center/MediaDetailPage.tsx");
const home = read("src/components/home/HomeMainSlotContent.tsx");

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

assert.ok(loader.includes("isSlotAllowedForRoute"), "loader must reject unsupported historical assignments");
assert.ok(loader.includes("layoutMode: getPageLayoutModeForRoute(pageSlug)"), "loader must use route layout owner");
assert.ok(loader.includes("slots.sidebar.push") && !loader.includes("if (!isMediaCenterPage)"), "Media Sidebar must enter the same canonical slot loader on every supported template");
assert.ok(registry.includes("PAGE_LAYOUT_SLOTS as PAGE_COMPOSITION_SLOTS"), "registry must alias the canonical position list");
assert.ok(!registry.includes('["hero", "main", "sidebar", "bottom", "footer"]'), "registry must not copy positions");

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

console.log("PASS Route Slot Policy: canonical assignment matrix, space-only Page Composition, bidirectional module-owned Presentation, fail-closed validation, shared loader/renderer/layout adoption, container-responsive modules and one position source.");

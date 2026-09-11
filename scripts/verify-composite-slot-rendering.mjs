/**
 * Verifies composite slot render-plan wiring and prevents cross-family Content sources.
 * Source-level only — no DB writes.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const failures = [];

function read(relPath) {
  const full = resolve(root, relPath);
  if (!existsSync(full)) {
    failures.push(`Missing file: ${relPath}`);
    return "";
  }
  return readFileSync(full, "utf8");
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const layout = read("src/components/page-composition/PageSlotLayout.tsx");
const plan = read("src/components/page-composition/build-slot-render-plan.ts");
const nodes = read("src/components/page-composition/slot-module-nodes.tsx");
const mediaHubPlan = read("src/lib/media-hub-modules/build-media-hub-render-plan.ts");
const orderContract = read("src/lib/page-composition/page-assignment-contract.ts");
const compositionLoader = read("src/lib/page-blocks/load-page-composition.ts");
const adminQueries = read("src/lib/page-blocks/admin-queries.ts");
const heroLoader = read("src/lib/load-hero-section.ts");
const topicsRoute = read("src/app/(site)/topics/page.tsx");
const homeRoute = read("src/app/(site)/page.tsx");
const compositionTypes = read("src/lib/page-blocks/page-composition-types.ts");
const mediaHubRenderer = read("src/components/media-center/renderMediaHubSections.tsx");

assert(layout.includes("buildSlotRenderPlan"), "PageSlotLayout must use buildSlotRenderPlan");
assert(
  !layout.includes("blocks={[entry.block]}"),
  "PageSlotLayout must not render singleton block arrays (breaks peer composites)",
);
assert(plan.includes("SLOT_COMPOSITE_RELATIONSHIPS"), "Composite relationships catalog missing");
assert(plan.includes("contact-office-form"), "Contact composite relationship missing");
assert(
  !plan.includes("about-intro-beats") && !plan.includes("about-documentary-beats"),
  "Content composition must not declare a Cards template as an About intro data peer",
);
assert(nodes.includes('slug === "contact-form-office" || slug === "contact-form"'), "Contact pairing missing");
assert(
  plan.includes("buildAdjacentContactFormPairs(composableEntries)") &&
    plan.includes("const next = ordered[index + 1]") &&
    plan.includes('current.kind !== "block" || next.kind !== "block"'),
  "Contact pairs must be derived from adjacency in the composable canonical sequence below fixed Hero",
);
assert(
  plan.includes('currentSlug === "contact-form-office" && nextSlug === "contact-form"') &&
    plan.includes('currentSlug === "contact-form" && nextSlug === "contact-form-office"') &&
    plan.includes("index += 1"),
  "Only complementary adjacent Contact halves may pair, one-to-one",
);
assert(
  nodes.includes("contactFormPairs: readonly ContactFormPair[] = []") &&
    plan.includes("buildSlotModuleNodes(blocks, context, contactFormPairs)"),
  "The full-sequence Contact pairing decision must reach the Page Block renderer",
);
assert(
  nodes.includes('slug === "contact-form-office" ? block : undefined') &&
    nodes.includes('slug === "contact-form" ? block : undefined'),
  "Non-adjacent or unmatched Contact assignments must render their own half",
);
assert(
  !nodes.includes("const offices = blocks.filter") &&
    !nodes.includes("const forms = blocks.filter"),
  "Contact pairing must not batch halves across intervening Assignments",
);
assert(!nodes.includes("indexBySlug") && !nodes.includes("bySlug.get"), "Slug Map first/last collapse must stay removed");
assert(
  nodes.includes("mapAboutIntroBeatsFromBlock(block)") &&
    !nodes.includes('bySlug.get("about-documentary-beats")') &&
    !nodes.includes("mapAboutDocumentaryBeatsBlock"),
  "About intro beats must come only from the Content template config",
);
assert(nodes.includes("assignmentId: block.assignmentId"), "Every slot module node must retain Assignment identity");
assert(nodes.includes("moduleKind: block.blockType"), "Every Page Block node must retain its canonical module kind");
assert(nodes.includes("comparePageAssignmentOrder"), "Page Block nodes must consume the canonical cross-kind comparator");
assert(plan.includes("buildSlotModuleNodes(blocks"), "Plan must batch blocks into buildSlotModuleNodes after full-sequence pairing");
assert(plan.includes('kind: "feed"'), "Plan must keep feed items separate");
assert(
  plan.includes('const composableEntries = entries.filter((entry) => entry.kind !== "hero")') &&
    !plan.includes("heroItems.push") &&
    !plan.includes("...heroItems"),
  "Fixed singleton Hero must stay outside the shared composable-module plan",
);
assert(plan.includes("assignmentId: node.assignmentId"), "Module plan items must carry Assignment identity");
assert(plan.includes("moduleKind: node.moduleKind"), "Module plan items must carry canonical kind into registry dispatch");
assert(plan.includes("comparePageAssignmentOrder(left, right)"), "Final slot plan must use the canonical cross-kind comparator");
assert(!plan.includes("key.localeCompare"), "Final slot plan must not use lexicographic key ordering");
assert(mediaHubPlan.includes("comparePageAssignmentOrder"), "Media Hub plan must consume the canonical comparator");
assert(!mediaHubPlan.includes("sectionKey.localeCompare"), "Media Hub ties must not use section-key ordering");
assert(
  orderContract.includes("left.sortOrder - right.sortOrder") &&
    orderContract.includes("left.moduleKind.localeCompare(right.moduleKind)") &&
    orderContract.includes("left.assignmentId - right.assignmentId"),
  "Canonical ordering must be sortOrder -> moduleKind -> numeric assignmentId",
);
for (const [source, owner] of [
  [adminQueries, "Admin reload"],
  [compositionLoader, "Composition loader"],
  [plan, "Public slot plan"],
  [nodes, "Page Block nodes"],
  [mediaHubPlan, "Media Hub plan"],
]) {
  assert(source.includes("comparePageAssignmentOrder"), `${owner} must share the canonical comparator`);
}

assert(
  heroLoader.includes('.eq("is_active", true)') &&
    heroLoader.includes('.order("priority", { ascending: false })') &&
    heroLoader.includes(".limit(1)") &&
    heroLoader.includes(".maybeSingle()") &&
    !heroLoader.includes("visibleAssignments.map"),
  "Hero loader must resolve the active fixed Hero as a singleton",
);
assert(
  compositionLoader.includes("if (heroState.hero && heroState.assignmentId !== null)") &&
    compositionLoader.includes("assignmentId: heroState.assignmentId") &&
    compositionLoader.includes("sortOrder: 0") &&
    !compositionLoader.includes("heroState.assignments"),
  "Composition loader must expose at most one fixed Hero without flexible ordering",
);
assert(
  layout.includes('const heroEntry = composition.slots.hero.find((entry) => entry.kind === "hero")') &&
    layout.includes('data-page-fixed-hero={heroEntry ? "singleton" : undefined}') &&
    layout.includes("compositionFooter={compositionFooter}") &&
    layout.includes('heroEntry?.hero.variant === "home-cinematic"') &&
    layout.includes('heroEntry?.hero.variant === "projects-hub"') &&
    layout.includes("heroEntry && !usesStandaloneHeroPresentation") &&
    layout.includes("compositionFooter: renderPeersInHeroFooter ? peerContent : undefined") &&
    layout.includes("!renderPeersInHeroFooter && peerNodes.length > 0") &&
    layout.includes('data-hero-composition-peers="ordered-below-fixed-hero"') &&
    layout.indexOf("{heroNode}") < layout.indexOf("{renderPeersAfterHero ? (") &&
    !layout.includes("function renderHeroSlotPlan("),
  "Standard Hero must keep footer peers while standalone Hero families render them once below the fixed Hero",
);

assert(
  nodes.includes("<TopicsListingContent") &&
    nodes.includes("block={block}") &&
    nodes.includes("context={context.listingContext}"),
  "Topics Listing must render per Assignment inside the shared slot renderer",
);
assert(
  !topicsRoute.includes("loadPublicTopicsListing") &&
    !topicsRoute.includes("topicsListingContentByAssignmentId") &&
    !topicsRoute.includes("new Map("),
  "Topics route must not own a parallel loader or Assignment map",
);
assert(
  compositionLoader.includes("isHomeProjectsTemplate(block.template.slug, block.template.variant)") &&
    compositionLoader.includes("await loadHomepageProjects()") &&
    compositionTypes.includes("homepageProjects: HomepageProjectCard[] | null") &&
    homeRoute.includes("composition.homepageProjects ?? []") &&
    !homeRoute.includes("loadHomepageProjects"),
  "Home Projects intrinsic data must be composition-owned and route-neutral",
);
assert(
  !/pageSlug\s*[!=]==?\s*["']home["']/u.test(compositionLoader),
  "Composition must not route-gate Home Projects data",
);

assert(
  compositionTypes.includes("export type ListingRenderContext") &&
    nodes.includes("listingContext?: ListingRenderContext") &&
    mediaHubRenderer.includes("listingContext?: ListingRenderContext"),
  "Topics and Media Listing must share one ListingRenderContext owner",
);
assert(
  plan.includes("isFeedModuleRenderable(entry.module)") &&
    plan.includes("isFeaturedModuleRenderable(entry.module)") &&
    plan.includes("isMediaHubModuleRenderable(entry.module") &&
    nodes.includes("if (!context.homepageProjects?.length) continue") &&
    nodes.includes("if (context.listingContext)"),
  "The shared plan must filter contextually non-renderable assignments before geometry",
);
assert(
  layout.includes("buildContextualSlotRenderPlan(entries, options).length > 0") &&
    layout.includes("hasRenderableSlotEntries(sidebarEntries, slotContentOptions)"),
  "Layout presence and sidebar geometry must use the contextual render plan",
);

if (failures.length) {
  console.error("verify-composite-slot-rendering FAILED:");
  for (const item of failures) console.error(` - ${item}`);
  process.exit(1);
}

console.log("verify-composite-slot-rendering OK");

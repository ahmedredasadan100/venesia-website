/**
 * Behavioral checks for composite pairing contracts (mirrors slot-module-nodes rules).
 * Pure JS — no React / TSX import.
 */

/** Mirrors the canonical Page Composition ordering contract. */
function comparePageAssignmentOrder(left, right) {
  const leftKind = left.moduleKind ?? "content";
  const rightKind = right.moduleKind ?? "content";
  return left.sortOrder - right.sortOrder ||
    leftKind.localeCompare(rightKind) ||
    left.assignmentId - right.assignmentId;
}

function sortEntries(entries) {
  return [...entries].sort(comparePageAssignmentOrder);
}

function buildAdjacentContactFormPairs(entries) {
  const ordered = sortEntries(entries);
  const pairs = [];

  for (let index = 0; index < ordered.length - 1; index += 1) {
    const current = ordered[index];
    const next = ordered[index + 1];
    const currentSlug = current.template?.slug;
    const nextSlug = next.template?.slug;
    const isComplementaryPair =
      (currentSlug === "contact-form-office" && nextSlug === "contact-form") ||
      (currentSlug === "contact-form" && nextSlug === "contact-form-office");
    if (!isComplementaryPair) continue;

    pairs.push({
      office: currentSlug === "contact-form-office" ? current : next,
      form: currentSlug === "contact-form" ? current : next,
    });
    index += 1;
  }

  return pairs;
}

/**
 * Pure plan of which assignment IDs produce a render key, mirroring composite rules.
 */
function planCompositeKeys(entries) {
  const sorted = sortEntries(entries);
  const contactFormPairs = buildAdjacentContactFormPairs(entries);
  const keys = [];

  for (const block of sorted) {
    if (!block.template) {
      keys.push({
        key: `${block.moduleKind}-${block.assignmentId}`,
        moduleKind: block.moduleKind,
        assignmentId: block.assignmentId,
        sortOrder: block.sortOrder,
        consumes: [block.assignmentId],
      });
      continue;
    }

    const slug = block.template.slug;

    if (slug === "about-intro" || block.template.variant === "about-intro") {
      keys.push({ key: `about-intro-${block.assignmentId}`, moduleKind: block.moduleKind, assignmentId: block.assignmentId, sortOrder: block.sortOrder, consumes: [block.assignmentId] });
      continue;
    }

    if (slug === "about-intro-single-image" || block.template.variant === "about-intro-single-image") {
      keys.push({ key: `about-intro-single-image-${block.assignmentId}`, moduleKind: block.moduleKind, assignmentId: block.assignmentId, sortOrder: block.sortOrder, consumes: [block.assignmentId] });
      continue;
    }

    if (slug === "contact-form-office" || slug === "contact-form") {
      const pair = contactFormPairs.find(
        ({ office, form }) => office === block || form === block,
      );
      const office = pair?.office ?? (slug === "contact-form-office" ? block : undefined);
      const form = pair?.form ?? (slug === "contact-form" ? block : undefined);
      const anchor = pair ? sortEntries([pair.office, pair.form])[0] : block;
      if (anchor !== block) continue;
      keys.push({
        key: `contact-form-${office?.assignmentId ?? "none"}-${form?.assignmentId ?? "none"}`,
        moduleKind: anchor.moduleKind,
        assignmentId: anchor.assignmentId,
        sortOrder: Math.min(office?.sortOrder ?? anchor.sortOrder, form?.sortOrder ?? anchor.sortOrder),
        consumes: [office?.assignmentId, form?.assignmentId].filter(Boolean),
      });
      continue;
    }

    keys.push({ key: `block-${block.assignmentId}`, moduleKind: block.moduleKind, assignmentId: block.assignmentId, sortOrder: block.sortOrder, consumes: [block.assignmentId] });
  }

  return keys.sort(comparePageAssignmentOrder);
}

/**
 * Pure behavioral projection of the public plan's contextual renderability.
 * Source guards bind each branch to the real implementation.
 */
function planSlotEntries(entries, context = {}) {
  return entries
    .filter((entry) => {
      if (entry.kind === "hero") return false;
      if (entry.kind === "feed") {
        return entry.emptyBehavior !== "hide" || entry.itemCount > 0;
      }
      if (entry.kind === "featured") {
        return !context.suppressFeaturedDuringSearch && entry.itemCount > 0;
      }
      if (entry.kind === "media-hub" && entry.placement === "listing") {
        return Boolean(context.listingContext);
      }
      if (entry.kind === "block" && entry.template === "topics-listing") {
        return Boolean(context.listingContext);
      }
      if (entry.kind === "block" && entry.template === "home-projects") {
        return Boolean(context.homepageProjects?.length);
      }
      return entry.renderable !== false;
    })
    .map((entry) => ({
      ...entry,
      moduleKind: entry.moduleKind ?? (entry.kind === "block" ? "content" : entry.kind),
    }))
    .sort(comparePageAssignmentOrder);
}

/** Mirrors HeroSlotContent's family-aware peer placement. */
function planHeroPeerPlacement(heroVariant, peerAssignmentIds) {
  const usesStandaloneHeroPresentation =
    heroVariant === "home-cinematic" || heroVariant === "projects-hub";
  const renderPeersInHeroFooter = Boolean(
    heroVariant && !usesStandaloneHeroPresentation,
  );
  return {
    footer: renderPeersInHeroFooter ? peerAssignmentIds : [],
    afterHero: renderPeersInHeroFooter ? [] : peerAssignmentIds,
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Contact office + form → one composite
{
  const keys = planCompositeKeys([
    { assignmentId: 1, sortOrder: 20, template: { slug: "contact-form-office", variant: null, config: {} } },
    { assignmentId: 2, sortOrder: 30, template: { slug: "contact-form", variant: null, config: {} } },
  ]);
  assert(keys.length === 1, "contact pair must yield one node");
  assert(keys[0].assignmentId === 1, "contact pair must keep its earliest Assignment identity");
  assert(keys[0].consumes.includes(1) && keys[0].consumes.includes(2), "contact must consume both");
}

// Contact office only
{
  const keys = planCompositeKeys([
    { assignmentId: 1, sortOrder: 10, template: { slug: "contact-form-office", variant: null, config: {} } },
  ]);
  assert(keys.length === 1, "office-only still one section");
  assert(keys[0].assignmentId === 1, "office-only node must retain its Assignment identity");
}

// Multiple adjacent office/form occurrences pair one-to-one without first/last collapse.
{
  const keys = planCompositeKeys([
    { assignmentId: 11, sortOrder: 10, template: { slug: "contact-form-office", variant: null, config: {} } },
    { assignmentId: 12, sortOrder: 20, template: { slug: "contact-form", variant: null, config: {} } },
    { assignmentId: 21, sortOrder: 30, template: { slug: "contact-form-office", variant: null, config: {} } },
    { assignmentId: 22, sortOrder: 40, template: { slug: "contact-form", variant: null, config: {} } },
  ]);
  assert(keys.length === 2, "two contact pairs must yield two nodes");
  assert(keys[0].key === "contact-form-11-12", "first occurrences must pair together");
  assert(keys[1].key === "contact-form-21-22", "second occurrences must pair together");
  assert(keys[0].assignmentId === 11 && keys[1].assignmentId === 21, "each composite must expose its own Assignment identity");
  assert(keys.flatMap((key) => key.consumes).join(",") === "11,12,21,22", "every duplicate Assignment must be consumed exactly once");
}

// A Page Block between complementary halves prevents pairing and preserves all three positions.
{
  const keys = planCompositeKeys([
    { assignmentId: 61, sortOrder: 10, moduleKind: "content", template: { slug: "contact-form-office", variant: null, config: {} } },
    { assignmentId: 62, sortOrder: 20, moduleKind: "content", template: { slug: "generic-middle", variant: null, config: {} } },
    { assignmentId: 63, sortOrder: 30, moduleKind: "content", template: { slug: "contact-form", variant: null, config: {} } },
  ]);
  assert(
    keys.map((key) => key.key).join(",") ===
      "contact-form-61-none,block-62,contact-form-none-63",
    "interleaved Page Block must keep Contact halves independent at saved order",
  );
  assert(
    keys.flatMap((key) => key.consumes).join(",") === "61,62,63",
    "interleaved Page Block must not be crossed or consumed by Contact pairing",
  );
}

// A non-Page-Block family in the full slot sequence also prevents cross-kind pairing.
{
  const keys = planCompositeKeys([
    { assignmentId: 71, sortOrder: 10, moduleKind: "content", template: { slug: "contact-form-office", variant: null, config: {} } },
    { assignmentId: 7, sortOrder: 20, moduleKind: "feed" },
    { assignmentId: 72, sortOrder: 30, moduleKind: "content", template: { slug: "contact-form", variant: null, config: {} } },
  ]);
  assert(
    keys.map((key) => key.key).join(",") ===
      "contact-form-71-none,feed-7,contact-form-none-72",
    "interleaved Feed must keep Contact halves independent in full canonical order",
  );
  assert(
    keys.flatMap((key) => key.consumes).join(",") === "71,7,72",
    "cross-kind interleaving must preserve every Assignment exactly once",
  );
}

// Uneven multiplicity keeps every unmatched occurrence as a half section.
{
  const keys = planCompositeKeys([
    { assignmentId: 31, sortOrder: 10, template: { slug: "contact-form-office", variant: null, config: {} } },
    { assignmentId: 32, sortOrder: 20, template: { slug: "contact-form", variant: null, config: {} } },
    { assignmentId: 41, sortOrder: 30, template: { slug: "contact-form-office", variant: null, config: {} } },
    { assignmentId: 51, sortOrder: 40, template: { slug: "contact-form-office", variant: null, config: {} } },
  ]);
  assert(keys.length === 3, "one pair plus two unmatched offices must yield three nodes");
  assert(keys.map((key) => key.key).join(",") === "contact-form-31-32,contact-form-41-none,contact-form-51-none", "unmatched office occurrences must remain independently rendered");
  assert(keys.flatMap((key) => key.consumes).join(",") === "31,32,41,51", "uneven multiplicity must preserve every Assignment exactly once");
}

// Failure path: a legacy Cards template must remain independent from Content intro.
{
  const keys = planCompositeKeys([
    { assignmentId: 5, sortOrder: 5, template: { slug: "about-documentary-beats", variant: null, config: {} } },
    { assignmentId: 4, sortOrder: 10, template: { slug: "about-intro", variant: "about-intro", config: {} } },
  ]);
  assert(keys.length === 2, "Cards and Content assignments must remain independent");
  assert(keys.some((key) => key.key === "block-5"), "legacy Cards assignment keeps its own renderer");
  assert(keys.some((key) => key.key === "about-intro-4"), "Content intro keeps its own renderer");
  assert(keys.every((key) => key.consumes.length === 1), "neither template may consume the other");
}

// Single-image remains independent from both Content intro and legacy Cards.
{
  const keys = planCompositeKeys([
    { assignmentId: 4, sortOrder: 10, template: { slug: "about-intro", variant: "about-intro", config: {} } },
    { assignmentId: 5, sortOrder: 15, template: { slug: "about-documentary-beats", variant: null, config: {} } },
    { assignmentId: 6, sortOrder: 20, template: { slug: "about-intro-single-image", variant: "about-intro-single-image", config: {} } },
  ]);
  assert(keys.length === 3, "all three template assignments stay independent");
  assert(keys.some((k) => k.key.startsWith("about-intro-single-image-")), "single-image node present");
}

// Generic block between composites keeps order
{
  const keys = planCompositeKeys([
    { assignmentId: 1, sortOrder: 10, template: { slug: "generic-a", variant: null, config: {} } },
    { assignmentId: 2, sortOrder: 20, template: { slug: "contact-form-office", variant: null, config: {} } },
    { assignmentId: 3, sortOrder: 30, template: { slug: "contact-form", variant: null, config: {} } },
    { assignmentId: 4, sortOrder: 40, template: { slug: "generic-b", variant: null, config: {} } },
  ]);
  assert(keys.length === 3, "generic + composite + generic");
  assert(keys[0].key === "block-1" && keys[2].key === "block-4", "generics keep ends");
}

// Equal sort_order inside one family uses numeric Assignment identity.
{
  const keys = planCompositeKeys([
    { assignmentId: 10, sortOrder: 10, moduleKind: "content", template: { slug: "generic-ten", variant: null, config: {} } },
    { assignmentId: 2, sortOrder: 10, moduleKind: "content", template: { slug: "generic-two", variant: null, config: {} } },
  ]);
  assert(keys.map((key) => key.assignmentId).join(",") === "2,10", "equal order must sort by numeric assignmentId");
  assert(keys.every((key) => Number.isInteger(key.assignmentId)), "every planned node must expose assignmentId");
}

// Cross-kind ties use module kind before table-local Assignment ids.
{
  const ordered = [
    { assignmentId: 1, sortOrder: 10, moduleKind: "feed" },
    { assignmentId: 100, sortOrder: 10, moduleKind: "content" },
    { assignmentId: 2, sortOrder: 10, moduleKind: "content" },
    { assignmentId: 90, sortOrder: 5, moduleKind: "media-hub" },
  ].sort(comparePageAssignmentOrder);
  assert(
    ordered.map((item) => `${item.moduleKind}:${item.assignmentId}`).join(",") ===
      "media-hub:90,content:2,content:100,feed:1",
    "cross-kind order must be sortOrder -> moduleKind -> numeric assignmentId",
  );
}

// Hero is a fixed singleton owned outside the shared composable-module plan.
{
  const planned = planSlotEntries([
    { kind: "hero", moduleKind: "hero", assignmentId: 12, sortOrder: 10 },
    { kind: "hero", moduleKind: "hero", assignmentId: 3, sortOrder: 10 },
    { kind: "block", moduleKind: "content", assignmentId: 100, sortOrder: 10, template: "generic" },
  ]);
  assert(
    planned.length === 1 && planned[0].assignmentId === 100,
    "Hero rows must never enter or affect the composable-module plan",
  );
}

// Standalone cinematic Hero families cannot consume compositionFooter, so all
// ordered peers render once in the existing region below the fixed Hero.
{
  const peerAssignmentIds = [41, 42];
  for (const variant of ["home-cinematic", "projects-hub"]) {
    const placement = planHeroPeerPlacement(variant, peerAssignmentIds);
    assert(placement.footer.length === 0, `${variant} must not receive footer peers`);
    assert(
      placement.afterHero.join(",") === "41,42",
      `${variant} must preserve both peers below the fixed Hero`,
    );
    assert(
      new Set([...placement.footer, ...placement.afterHero]).size === 2,
      `${variant} peers must render exactly once`,
    );
  }

  const standard = planHeroPeerPlacement("internal-page", peerAssignmentIds);
  assert(
    standard.footer.join(",") === "41,42" && standard.afterHero.length === 0,
    "Standard Internal Hero must keep both ordered peers in compositionFooter",
  );
}

// Contextually empty assignments must not create phantom slot geometry.
{
  const entries = [
    { kind: "hero", moduleKind: "hero", assignmentId: 1, sortOrder: 1 },
    { kind: "feed", moduleKind: "feed", assignmentId: 2, sortOrder: 2, emptyBehavior: "hide", itemCount: 0 },
    { kind: "featured", moduleKind: "featured", assignmentId: 3, sortOrder: 3, itemCount: 0 },
    { kind: "media-hub", moduleKind: "media-hub", assignmentId: 4, sortOrder: 4, placement: "listing" },
    { kind: "block", moduleKind: "content", assignmentId: 5, sortOrder: 5, template: "topics-listing" },
    { kind: "block", moduleKind: "content", assignmentId: 6, sortOrder: 6, template: "home-projects" },
  ];
  const closed = planSlotEntries(entries);
  assert(
    closed.length === 0,
    "missing listing/data context must fail closed before layout presence",
  );

  const opened = planSlotEntries(entries, {
    listingContext: { publicPath: "/any-page" },
    homepageProjects: [{ id: 1 }],
  });
  assert(
    opened.map((item) => item.assignmentId).join(",") === "4,5,6",
    "shared direct-page context must enable Media, Topics, and Home Projects without route gates",
  );
}

// Search suppression is a renderability decision, not empty Theme geometry.
{
  const featured = {
    kind: "featured",
    moduleKind: "featured",
    assignmentId: 8,
    sortOrder: 10,
    itemCount: 2,
  };
  assert(planSlotEntries([featured]).length === 1, "non-empty Featured assignment must render");
  assert(
    planSlotEntries([featured], { suppressFeaturedDuringSearch: true }).length === 0,
    "suppressed Featured assignment must leave no render-plan presence",
  );
}

console.log("verify-composite-slot-behavior OK");

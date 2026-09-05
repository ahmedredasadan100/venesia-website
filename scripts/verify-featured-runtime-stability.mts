import assert from "node:assert/strict";

import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const {
  FEATURED_PRESENTATION_PROFILES,
  FEATURED_PRESENTATION_VARIANTS,
} = await jiti.import<
  typeof import("../src/lib/featured-modules/contract.ts")
>("../src/lib/featured-modules/contract.ts");
const { parseFeaturedModuleConfig } = await jiti.import<
  typeof import("../src/lib/featured-modules/config.ts")
>("../src/lib/featured-modules/config.ts");
const {
  buildFeaturedModuleCacheKey,
  FEATURED_MODULE_CACHE_CONTRACT_VERSION,
  normalizeFeaturedModuleLoadResult,
  rememberFeaturedPayloadRecovery,
} = await jiti.import<
  typeof import("../src/lib/featured-modules/runtime-payload.ts")
>("../src/lib/featured-modules/runtime-payload.ts");

const AFFECTED_PAGE_SLUGS = [
  "topics",
  "media-center",
  "media-center-news",
  "media-center-site-updates",
  "media-center-videos",
  "media-center-press",
  "media-center-gallery",
] as const;
const SELECTION_MODES = [
  "automatic",
  "latest",
  "popular",
  "manual",
] as const;
const referenceItems = [701, 503, 902, 304, 805].map((id) => ({
  id,
  title: `Reference ${id}`,
}));
const referenceIds = referenceItems.map((item) => item.id);

function selection(mode: (typeof SELECTION_MODES)[number]) {
  return mode === "manual"
    ? { mode, topicIds: [...referenceIds] }
    : { mode };
}

function legacyModule(
  variant: (typeof FEATURED_PRESENTATION_VARIANTS)[number],
  mode: (typeof SELECTION_MODES)[number],
  items = referenceItems,
) {
  const current = parseFeaturedModuleConfig({
    source: { kind: "categories", categorySlug: "reference-category" },
    selection: selection(mode),
    itemLimit: items.length,
    display: {
      title: true,
      image: false,
      category: true,
      series: true,
      excerpt: true,
      date: true,
    },
    presentation: { variant },
  });

  return {
    assignmentId: 41,
    templateId: 17,
    sortOrder: 1,
    slot: "main",
    source: current.source,
    selection: current.selection,
    display: current.display,
    presentation: {
      ...current.presentation,
      categoryBold: true,
      categoryAlignment: "left",
      seriesBold: false,
      seriesAlignment: "right",
      excerptBold: false,
      excerptAlignment: "right",
      dateBold: false,
      dateAlignment: "right",
    },
    items,
  };
}

function readPresenterContract(module: unknown) {
  const value = module as {
    navigation: { autoplay: boolean };
    itemsPerView: number;
    displayFormatting: { titleBold: boolean };
  };
  return {
    autoplay: value.navigation.autoplay,
    itemsPerView: value.itemsPerView,
    titleBold: value.displayFormatting.titleBold,
  };
}

for (const pageSlug of AFFECTED_PAGE_SLUGS) {
  const currentKey = buildFeaturedModuleCacheKey(pageSlug);
  assert.deepEqual(currentKey, [
    "featured-module-state",
    FEATURED_MODULE_CACHE_CONTRACT_VERSION,
    pageSlug,
  ]);
  assert.notDeepEqual(
    currentKey,
    buildFeaturedModuleCacheKey(pageSlug, "featured-runtime-v1"),
  );
}

assert.throws(() => readPresenterContract(legacyModule("editorial", "latest")));

function normalizeLegacy(
  variant: (typeof FEATURED_PRESENTATION_VARIANTS)[number],
  mode: (typeof SELECTION_MODES)[number],
) {
  return normalizeFeaturedModuleLoadResult({
    modules: [legacyModule(variant, mode)],
    hasAnyAssignmentRows: true,
    hasCompositionError: false,
  });
}

const legacyBaseline = normalizeLegacy("editorial", "latest");
const legacyBaselineModule = legacyBaseline.state.modules[0];
assert.ok(legacyBaselineModule);
assert.equal(legacyBaselineModule.items, referenceItems);
assert.deepEqual(
  legacyBaselineModule.items.map((item) => item.id),
  referenceIds,
);
assert.equal(legacyBaselineModule.itemLimit, referenceItems.length);
assert.equal(legacyBaselineModule.displayFormatting.categoryBold, true);
assert.equal(legacyBaselineModule.displayFormatting.categoryAlignment, "left");
assert.ok(legacyBaseline.recoveries.length > 0);

for (const variant of FEATURED_PRESENTATION_VARIANTS) {
  const normalizedModule = normalizeLegacy(variant, "automatic").state.modules[0];
  assert.ok(normalizedModule, `${variant}: module survives`);
  assert.deepEqual(
    normalizedModule.navigation,
    FEATURED_PRESENTATION_PROFILES[variant].defaultNavigation,
  );
  assert.equal(normalizedModule.presentation.variant, variant);
  assert.doesNotThrow(() => readPresenterContract(normalizedModule));
}

for (const mode of SELECTION_MODES) {
  assert.equal(
    normalizeLegacy("editorial", mode).state.modules[0]?.selection.mode,
    mode,
  );
}

const malformedItems = [...referenceItems];
const malformed = normalizeFeaturedModuleLoadResult({
  modules: [
    {
      ...legacyModule("editorial", "latest", malformedItems),
      itemLimit: "not-a-number",
      itemsPerView: 99,
      displayFormatting: null,
      navigation: { autoplay: "sometimes" },
      presentation: null,
    },
  ],
  hasAnyAssignmentRows: true,
  hasCompositionError: false,
});
const malformedModule = malformed.state.modules[0];
assert.equal(malformedModule.items, malformedItems);
assert.deepEqual(malformedModule.items.map((item) => item.id), referenceIds);
assert.equal(malformedModule.itemLimit, malformedItems.length);
assert.deepEqual(
  malformedModule.navigation,
  FEATURED_PRESENTATION_PROFILES.editorial.defaultNavigation,
);
assert.equal(malformedModule.presentation.variant, "editorial");
assert.doesNotMatch(JSON.stringify(malformed.recoveries), /Reference/u);

const currentConfig = parseFeaturedModuleConfig({
  source: { kind: "media-center", contentType: "news" },
  selection: { mode: "popular" },
  itemLimit: referenceItems.length,
  itemsPerView: 3,
  presentation: { variant: "group-carousel" },
});
const currentState = {
  modules: [
    {
      assignmentId: 91,
      templateId: 27,
      sortOrder: 1,
      slot: "main",
      ...currentConfig,
      items: referenceItems,
    },
  ],
  hasAnyAssignmentRows: true,
  hasCompositionError: false,
};
const current = normalizeFeaturedModuleLoadResult(currentState);
assert.equal(current.state, currentState);
assert.deepEqual(current.recoveries, []);

const rememberedKeys = new Set<string>();
assert.equal(rememberFeaturedPayloadRecovery(rememberedKeys, "a", 2), true);
assert.equal(rememberFeaturedPayloadRecovery(rememberedKeys, "a", 2), false);
assert.equal(rememberFeaturedPayloadRecovery(rememberedKeys, "b", 2), true);
assert.equal(rememberFeaturedPayloadRecovery(rememberedKeys, "c", 2), true);
assert.equal(rememberedKeys.size, 2);
assert.equal(rememberedKeys.has("a"), false);
assert.equal(rememberFeaturedPayloadRecovery(rememberedKeys, "a", 2), true);
assert.equal(rememberedKeys.size, 2);

const corrupt = normalizeFeaturedModuleLoadResult({
  modules: [null],
  hasAnyAssignmentRows: true,
  hasCompositionError: false,
});
assert.deepEqual(corrupt.state.modules, []);
assert.equal(corrupt.state.hasCompositionError, true);
assert.doesNotThrow(() => normalizeFeaturedModuleLoadResult(undefined));

console.log(
  `Featured Runtime Stability verification passed (${AFFECTED_PAGE_SLUGS.length} cache keys; ${FEATURED_PRESENTATION_VARIANTS.length} variants + ${SELECTION_MODES.length} selection modes; bounded diagnostics).`,
);

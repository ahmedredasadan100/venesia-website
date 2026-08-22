/**
 * Verifies internal hero content-control parsing contracts.
 * Keep in sync with src/lib/hero/hero-content-controls.ts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const HERO_ELEMENT_KEYS = [
  "eyebrow",
  "title",
  "highlight",
  "subtitle",
  "description",
  "cta",
];

const DEFAULT_HERO_ELEMENT_ORDER = [...HERO_ELEMENT_KEYS];

function parseOptionalBool(value) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1" || value === "on") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return undefined;
}

function parseHeroTextAlignment(value, fallback = "right") {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if (text === "right" || text === "center" || text === "left") return text;
  return fallback;
}

function normalizeHeroElementOrder(raw) {
  const allowed = new Set(HERO_ELEMENT_KEYS);
  const collected = [];
  const seen = new Set();

  const push = (key) => {
    const canonicalKey = key === "explore" ? "cta" : key;
    if (!allowed.has(canonicalKey) || seen.has(canonicalKey)) return;
    seen.add(canonicalKey);
    collected.push(canonicalKey);
  };

  if (Array.isArray(raw)) {
    for (const item of raw) push(String(item).trim());
  } else if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) push(String(item).trim());
      } else {
        for (const part of raw.split(/[,\s]+/)) push(part);
      }
    } catch {
      for (const part of raw.split(/[,\s]+/)) push(part);
    }
  }

  for (const key of DEFAULT_HERO_ELEMENT_ORDER) {
    if (!seen.has(key)) collected.push(key);
  }
  return collected;
}

function resolveHeroContentControls(raw = {}) {
  const boolOr = (value, fallback) => parseOptionalBool(value) ?? fallback;
  const showCtaResolved =
    parseOptionalBool(raw.showCta) ?? parseOptionalBool(raw.show_cta) ?? true;

  return {
    showEyebrow: boolOr(raw.showEyebrow, true),
    eyebrowBold: boolOr(raw.eyebrowBold, false),
    eyebrowAlignment: parseHeroTextAlignment(raw.eyebrowAlignment, "right"),
    showTitle: boolOr(raw.showTitle, true),
    titleBold: boolOr(raw.titleBold, true),
    titleAlignment: parseHeroTextAlignment(raw.titleAlignment, "right"),
    showHighlight: boolOr(raw.showHighlight, true),
    highlightBold: boolOr(raw.highlightBold, false),
    highlightAlignment: parseHeroTextAlignment(raw.highlightAlignment, "right"),
    showSubtitle: boolOr(raw.showSubtitle, true),
    subtitleBold: boolOr(raw.subtitleBold, false),
    subtitleAlignment: parseHeroTextAlignment(raw.subtitleAlignment, "right"),
    showDescription: boolOr(raw.showDescription, true),
    descriptionAlignment: (() => {
      const text = String(raw.descriptionAlignment ?? "")
        .trim()
        .toLowerCase();
      if (["right", "center", "left", "justify"].includes(text)) return text;
      return "right";
    })(),
    showCta:
      parseOptionalBool(raw.showCta) ??
      parseOptionalBool(raw.show_cta) ??
      parseOptionalBool(raw.showExploreLink) ??
      parseOptionalBool(raw.show_explore_link) ??
      showCtaResolved,
    ctaAlignment: parseHeroTextAlignment(
      raw.ctaAlignment ?? raw.cta_alignment ?? raw.exploreAlignment ?? raw.explore_alignment,
      "right",
    ),
    heroElementOrder: normalizeHeroElementOrder(raw.heroElementOrder ?? raw.hero_element_order),
  };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

// Legacy empty config defaults
const legacy = resolveHeroContentControls({});
assert(legacy.showEyebrow && legacy.showTitle && legacy.showHighlight && legacy.showSubtitle, "legacy shows all elements");
assert(legacy.titleBold === true && legacy.eyebrowBold === false, "legacy bold defaults");
assert(legacy.highlightBold === false && legacy.subtitleBold === false, "highlight/subtitle bold defaults");
assert(legacy.eyebrowAlignment === "right" && legacy.titleAlignment === "right", "legacy alignment right");
assert(JSON.stringify(legacy.heroElementOrder) === JSON.stringify(DEFAULT_HERO_ELEMENT_ORDER), "default element order");

// Independent highlight/subtitle — parsing keeps both fields (render tests elsewhere)
assert(
  typeof legacy.showHighlight === "boolean" && typeof legacy.showSubtitle === "boolean",
  "highlight and subtitle have independent show flags",
);

// Bool parsing
assert(parseOptionalBool("true") === true && parseOptionalBool("false") === false, "bool string parsing");
assert(parseOptionalBool(undefined) === undefined, "bool missing stays undefined");

// Alignment parsing
assert(parseHeroTextAlignment("left") === "left", "alignment left");
assert(parseHeroTextAlignment("junk") === "right", "alignment fallback");

// Order validation
assert(
  JSON.stringify(normalizeHeroElementOrder(["cta", "title", "cta", "bogus"])) ===
    JSON.stringify(["cta", "title", "eyebrow", "highlight", "subtitle", "description"]),
  "order dedupe + append missing",
);
assert(
  JSON.stringify(normalizeHeroElementOrder('["subtitle","highlight"]')) ===
    JSON.stringify(["subtitle", "highlight", "eyebrow", "title", "description", "cta"]),
  "order from JSON string",
);

// Legacy Explore data is read into the one canonical CTA contract.
const withLegacyExplore = resolveHeroContentControls({
  showExploreLink: false,
  exploreAlignment: "center",
  descriptionAlignment: "justify",
});
assert(withLegacyExplore.showCta === false, "legacy Explore visibility maps to CTA");
assert(withLegacyExplore.ctaAlignment === "center", "legacy Explore alignment maps to CTA");
assert(withLegacyExplore.descriptionAlignment === "justify", "description justify alignment");
assert(
  JSON.stringify(normalizeHeroElementOrder(["explore", "title"])) ===
    JSON.stringify(["cta", "title", "eyebrow", "highlight", "subtitle", "description"]),
  "legacy Explore order maps to canonical CTA",
);

// Hidden reserved-space contract markers (static source check)
const heroSource = readFileSync(resolve("src/components/sections/DynamicHeroSection.tsx"), "utf8");
const heroVisibilitySource = readFileSync(
  resolve("src/app/admin/pages-blocks/blocks/hero/[id]/HeroVisibilityAlignRow.tsx"),
  "utf8",
);
const heroEditorSource = readFileSync(
  resolve("src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx"),
  "utf8",
);
const mediaGallerySource = readFileSync(
  resolve("src/components/admin/media/AdminMediaGalleryField.tsx"),
  "utf8",
);
const publicMediaImageSource = readFileSync(
  resolve("src/components/public/PublicMediaImage.tsx"),
  "utf8",
);
const heroContractSource = readFileSync(resolve("src/lib/hero/hero-content-controls.ts"), "utf8");
const genericHeroActionSource = readFileSync(resolve("src/app/admin/pages-blocks/blocks/hero/actions.ts"), "utf8");
const projectsHeroActionSource = readFileSync(resolve("src/app/admin/pages-blocks/blocks/content/actions.ts"), "utf8");
const internalPageLayoutSource = readFileSync(resolve("src/components/InternalPageLayout.tsx"), "utf8");
const mediaCenterConfigSource = readFileSync(resolve("src/lib/media-center-page-config.ts"), "utf8");
const heroClosureMigration = readFileSync(
  resolve("sql/migrations/20260822090000_hero_platform_product_preset_closure.sql"),
  "utf8",
);
const {
  normalizeHeroTemplateProductConfig,
  parseHeroContentControlsFormData,
  resolveHeroContentControlsForVariant,
  resolveHeroFamily,
  resolveHeroImageCompositionPreset,
} = await import(
  "../src/lib/hero/hero-content-controls.ts"
);
assert(heroSource.includes("data-hero-slot-visible"), "reserved-space attribute present");
assert(heroSource.includes('visibility: "hidden"') || heroSource.includes("visibility: 'hidden'"), "uses visibility hidden");
assert(heroSource.includes("inert: true") || heroSource.includes("inert:true"), "uses boolean inert true");
assert(!/inert:\s*""/.test(heroSource) && !/inert:\s*''/.test(heroSource), "does not pass empty-string inert");
assert(heroSource.includes("Fragment"), "empty slots use Fragment to avoid flex gap wrappers");
assert(
  heroVisibilitySource.includes('uncheckedValue="false"'),
  "Hero visibility controls persist explicit false state",
);
assert(!heroVisibilitySource.includes('label="خط عريض"'), "Hero typography remains Design System-owned");
assert(heroVisibilitySource.includes('type="hidden" name={boldName}'), "legacy bold values remain save-compatible");
assert(!heroSource.includes("HeroExploreLink"), "parallel Explore renderer removed");
assert(
  heroSource.includes("inline-flex w-fit max-w-full whitespace-normal rounded-full") &&
    heroSource.includes("heroPillAlignmentClass"),
  "Home Hero badges hug their content without losing responsive wrapping or alignment",
);
assert(
  heroSource.includes('usesHomeCinematicTypography') &&
    heroSource.includes('text-4xl font-semibold leading-[1.18] tracking-[-0.02em]') &&
    heroSource.includes('sm:text-5xl md:text-6xl lg:text-7xl'),
  "Home Hero highlight retains the cinematic title hierarchy",
);
assert(
  heroEditorSource.includes('dimensionHint="hero"') &&
    heroEditorSource.includes('dimensionHint="hero-mobile"') &&
    (heroEditorSource.match(/density="compact"/g) ?? []).length === 2,
  "Hero media tabs use compact cards with distinct desktop and mobile specifications",
);
assert(
  mediaGallerySource.includes('"hero-mobile"') &&
    mediaGallerySource.includes("DIMENSION_CARD_LABELS[dimensionHint]"),
  "Hero image specifications stay visible on every media card",
);
assert(
  publicMediaImageSource.includes('loading={priority ? "eager" : undefined}') &&
    publicMediaImageSource.includes('fetchPriority={priority ? "high" : undefined}') &&
    !publicMediaImageSource.includes("priority={priority}"),
  "Hero LCP images map the shared priority intent to Next 16 loading attributes",
);
assert(
  heroEditorSource.includes("AdminFormListboxSelect") &&
    heroEditorSource.includes('name="image_composition"') &&
    heroEditorSource.includes("HERO_IMAGE_COMPOSITION_OPTIONS_AR") &&
    !heroEditorSource.includes('name="image_position_class"'),
  "Hero image composition is persisted through a labelled Product preset",
);
assert(
  resolveHeroImageCompositionPreset("cover-upper") === "cover-upper" &&
    resolveHeroImageCompositionPreset("object-[42%_36%]") === "cover-upper" &&
    resolveHeroImageCompositionPreset("object-center") === "cover-center" &&
    resolveHeroImageCompositionPreset("object-[99%_1%]") === "cover-center",
  "Hero image composition resolver outputs Product presets and only reads legacy CSS",
);
assert(
  genericHeroActionSource.includes("resolveHeroImageCompositionPreset") &&
    genericHeroActionSource.includes("imageComposition:") &&
    !genericHeroActionSource.includes('formData.get("image_position_class")'),
  "Hero save persists semantic composition without a CSS-valued form field",
);
const normalizedLegacyConfig = normalizeHeroTemplateProductConfig(
  {
    imagePositionClassName: "object-[42%_36%]",
    heroLayout: "compact",
    eyebrowAlignment: "center",
    titleAlignment: "left",
    heroElementOrder: ["title", "eyebrow"],
  },
  "internal-page",
);
assert(
  normalizedLegacyConfig.imageComposition === "cover-upper" &&
    !("imagePositionClassName" in normalizedLegacyConfig) &&
    !("heroLayout" in normalizedLegacyConfig),
  "Hero persistence normalization removes legacy CSS and per-page height fields",
);
const standardizedInternalControls = resolveHeroContentControlsForVariant(
  {
    eyebrowAlignment: "center",
    titleAlignment: "left",
    ctaAlignment: "center",
    heroElementOrder: ["cta", "title", "eyebrow"],
  },
  "internal-page",
);
assert(
  standardizedInternalControls.eyebrowAlignment === "right" &&
    standardizedInternalControls.titleAlignment === "right" &&
    standardizedInternalControls.ctaAlignment === "right" &&
    JSON.stringify(standardizedInternalControls.heroElementOrder) ===
      JSON.stringify(DEFAULT_HERO_ELEMENT_ORDER),
  "Standard Internal Hero composition cannot fork alignment or ordering per page",
);
assert(
  resolveHeroFamily("home-cinematic") === "special" &&
    resolveHeroFamily("projects-hub") === "special" &&
    resolveHeroFamily("project-detail") === "special" &&
    resolveHeroFamily("internal-page") === "standard-internal",
  "Hero variants resolve into the two Product families",
);
assert(
  heroSource.includes('data-hero-family="standard-internal"') &&
    heroSource.includes('data-hero-height-preset="standard-internal"') &&
    heroSource.includes("data-hero-composition-baseline={STANDARD_INTERNAL_HERO_COMPOSITION_BASELINE}") &&
    heroSource.includes('data-hero-composition-root="standard-internal"') &&
    heroSource.includes('h-[min(62vh,580px)] min-h-[440px]') &&
    !heroSource.includes('h-[min(46vh,500px)]') &&
    !heroSource.includes("config.heroLayout"),
  "Family B owns one height and one composition anchor",
);
assert(
  heroSource.includes("STANDARD_INTERNAL_HERO_ELEMENT_ORDER.map") &&
    heroSource.includes(
      "flex-col px-6 pb-10 pt-20 sm:pb-12 sm:pt-24 md:pb-14 md:pt-28 lg:px-6 lg:pb-16",
    ) &&
    !heroSource.includes("flex-col justify-end px-6") &&
    heroContractSource.includes('STANDARD_INTERNAL_HERO_COMPOSITION_BASELINE = "topics"'),
  "Standard composition fixes the Topics start baseline and Product order across the Family",
);
assert(
  !internalPageLayoutSource.includes("heroHeightClassName") &&
    !internalPageLayoutSource.includes("PublicMediaImage") &&
    internalPageLayoutSource.includes("shouldRenderHero") &&
    internalPageLayoutSource.includes("<DynamicHeroSection") &&
    internalPageLayoutSource.includes("compositionFooter={heroCompositionFooter}") &&
    heroSource.includes('data-hero-composition-footer="page-composition"'),
  "Static internal fallbacks delegate to the same shared Hero presentation owner",
);
assert(
  heroEditorSource.includes("isStandardInternal") &&
    heroEditorSource.includes("enableAlignment={!isStandardInternal}") &&
    heroEditorSource.includes("...(!isStandardInternal"),
  "Standard Internal CMS removes per-page alignment and ordering controls",
);
assert(
  !mediaCenterConfigSource.includes("heroImagePositionClassName") &&
    !internalPageLayoutSource.includes("heroImagePositionClassName"),
  "unused Media Center static fallback cannot create a parallel object-position path",
);
assert(
  heroClosureMigration.includes("hero_image = '/images/projects/i87/hero.jpg'") &&
    heroClosureMigration.includes("and hero_image = '/images/projects/b84/progress-04 - copy (6).jpg'") &&
    heroClosureMigration.includes("I87 does not use its canonical Hero asset"),
  "Hero closure migration repairs and asserts the canonical I87 Hero asset",
);
assert(!heroContractSource.includes('  "explore",'), "parallel Explore element removed from contract");
assert(
  genericHeroActionSource.includes("parseHeroContentControlsFormData") &&
    projectsHeroActionSource.includes("parseHeroContentControlsFormData"),
  "Generic and Projects Hub saves share one Hero presentation parser",
);

const visibilityFields = {
  show_eyebrow: "showEyebrow",
  show_title: "showTitle",
  show_highlight: "showHighlight",
  show_subtitle: "showSubtitle",
  show_description: "showDescription",
  show_cta: "showCta",
};
const visibleFormData = new FormData();
const hiddenFormData = new FormData();
for (const field of Object.keys(visibilityFields)) {
  // AdminFormSwitch submits its hidden fallback first and checked value last.
  visibleFormData.append(field, "false");
  visibleFormData.append(field, "true");
  hiddenFormData.append(field, "false");
}
const visibleControls = parseHeroContentControlsFormData(visibleFormData);
const hiddenControls = parseHeroContentControlsFormData(hiddenFormData);
assert(
  Object.values(visibilityFields).every((field) => visibleControls[field] === true),
  "all six checked Hero visibility switches persist the authoritative final FormData value",
);
assert(
  Object.values(visibilityFields).every((field) => hiddenControls[field] === false),
  "all six unchecked Hero visibility switches persist the explicit hidden fallback",
);
assert(!heroSource.includes("goldAccent"), "About goldAccent merge removed");
assert(heroSource.includes("HomeDynamicHero"), "Home hero path still present");
assert(
  /function HomeDynamicHero[\s\S]*function InternalDynamicHero/.test(heroSource) ||
    /function InternalDynamicHero[\s\S]*function HomeDynamicHero/.test(heroSource) ||
    heroSource.includes('variant === "home-cinematic"'),
  "Home hero router gate preserved",
);

// Render contract: Highlight and Subtitle are independent (no goldAccent merge).
function resolveIndependentHeroText(config, isAboutPage) {
  const highlight = String(config.highlight || "").trim();
  const subtitle = String(config.subtitle || "").trim();
  // Legacy About bug (must stay removed):
  // const goldAccent = highlight || (isAboutPage ? subtitle : "");
  void isAboutPage;
  return {
    showHighlight: Boolean(highlight) && config.showHighlight !== false,
    showSubtitle: Boolean(subtitle) && config.showSubtitle !== false,
    highlight,
    subtitle,
  };
}

const both = resolveIndependentHeroText(
  { highlight: "HL", subtitle: "ST", showHighlight: true, showSubtitle: true },
  true,
);
assert(both.showHighlight && both.showSubtitle && both.highlight === "HL" && both.subtitle === "ST", "independent highlight+subtitle both show on About");

const onlySub = resolveIndependentHeroText(
  { highlight: "", subtitle: "ST", showHighlight: true, showSubtitle: true },
  true,
);
assert(!onlySub.showHighlight && onlySub.showSubtitle, "subtitle alone does not fabricate highlight");

if (process.exitCode) {
  console.error("\nInternal hero config verification failed.");
  process.exit(1);
}

console.log("\nInternal hero config verification passed.");

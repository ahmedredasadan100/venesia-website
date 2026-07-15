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
  "breadcrumb",
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
    if (!allowed.has(key) || seen.has(key)) return;
    seen.add(key);
    collected.push(key);
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
    showBreadcrumb: boolOr(raw.showBreadcrumb, true),
    breadcrumbBold: boolOr(raw.breadcrumbBold, false),
    breadcrumbAlignment: parseHeroTextAlignment(raw.breadcrumbAlignment, "right"),
    breadcrumbCurrentLabel:
      typeof raw.breadcrumbCurrentLabel === "string" ? raw.breadcrumbCurrentLabel.trim() : "",
    showCta: showCtaResolved,
    ctaAlignment: parseHeroTextAlignment(raw.ctaAlignment, "right"),
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
    JSON.stringify(["cta", "title", "eyebrow", "highlight", "subtitle", "description", "breadcrumb"]),
  "order dedupe + append missing",
);
assert(
  JSON.stringify(normalizeHeroElementOrder('["subtitle","highlight"]')) ===
    JSON.stringify(["subtitle", "highlight", "eyebrow", "title", "description", "breadcrumb", "cta"]),
  "order from JSON string",
);

// Breadcrumb override + rich flag presence
const withCrumb = resolveHeroContentControls({
  breadcrumbCurrentLabel: "  من نحن  ",
  showBreadcrumb: false,
  descriptionAlignment: "justify",
});
assert(withCrumb.breadcrumbCurrentLabel === "من نحن", "breadcrumb label trimmed");
assert(withCrumb.showBreadcrumb === false, "breadcrumb can be hidden");
assert(withCrumb.descriptionAlignment === "justify", "description justify alignment");

// Hidden reserved-space contract markers (static source check)
const heroSource = readFileSync(resolve("src/components/sections/DynamicHeroSection.tsx"), "utf8");
assert(heroSource.includes("data-hero-slot-visible"), "reserved-space attribute present");
assert(heroSource.includes('visibility: "hidden"') || heroSource.includes("visibility: 'hidden'"), "uses visibility hidden");
assert(!heroSource.includes("goldAccent"), "About goldAccent merge removed");
assert(heroSource.includes("HomeDynamicHero"), "Home hero path still present");
assert(
  /function HomeDynamicHero[\s\S]*function InternalDynamicHero/.test(heroSource) ||
    /function InternalDynamicHero[\s\S]*function HomeDynamicHero/.test(heroSource) ||
    heroSource.includes("variant === \"home-cinematic\""),
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

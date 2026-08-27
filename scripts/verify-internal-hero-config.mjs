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
  if (value === "true" || value === 1 || value === "1" || value === "on")
    return true;
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
      raw.ctaAlignment ??
        raw.cta_alignment ??
        raw.exploreAlignment ??
        raw.explore_alignment,
      "right",
    ),
    heroElementOrder: normalizeHeroElementOrder(
      raw.heroElementOrder ?? raw.hero_element_order,
    ),
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
assert(
  legacy.showEyebrow &&
    legacy.showTitle &&
    legacy.showHighlight &&
    legacy.showSubtitle,
  "legacy shows all elements",
);
assert(
  legacy.titleBold === true && legacy.eyebrowBold === false,
  "legacy bold defaults",
);
assert(
  legacy.highlightBold === false && legacy.subtitleBold === false,
  "highlight/subtitle bold defaults",
);
assert(
  legacy.eyebrowAlignment === "right" && legacy.titleAlignment === "right",
  "legacy alignment right",
);
assert(
  JSON.stringify(legacy.heroElementOrder) ===
    JSON.stringify(DEFAULT_HERO_ELEMENT_ORDER),
  "default element order",
);

// Independent highlight/subtitle — parsing keeps both fields (render tests elsewhere)
assert(
  typeof legacy.showHighlight === "boolean" &&
    typeof legacy.showSubtitle === "boolean",
  "highlight and subtitle have independent show flags",
);

// Bool parsing
assert(
  parseOptionalBool("true") === true && parseOptionalBool("false") === false,
  "bool string parsing",
);
assert(
  parseOptionalBool(undefined) === undefined,
  "bool missing stays undefined",
);

// Alignment parsing
assert(parseHeroTextAlignment("left") === "left", "alignment left");
assert(parseHeroTextAlignment("junk") === "right", "alignment fallback");

// Order validation
assert(
  JSON.stringify(
    normalizeHeroElementOrder(["cta", "title", "cta", "bogus"]),
  ) ===
    JSON.stringify([
      "cta",
      "title",
      "eyebrow",
      "highlight",
      "subtitle",
      "description",
    ]),
  "order dedupe + append missing",
);
assert(
  JSON.stringify(normalizeHeroElementOrder('["subtitle","highlight"]')) ===
    JSON.stringify([
      "subtitle",
      "highlight",
      "eyebrow",
      "title",
      "description",
      "cta",
    ]),
  "order from JSON string",
);

// Legacy Explore data is read into the one canonical CTA contract.
const withLegacyExplore = resolveHeroContentControls({
  showExploreLink: false,
  exploreAlignment: "center",
  descriptionAlignment: "justify",
});
assert(
  withLegacyExplore.showCta === false,
  "legacy Explore visibility maps to CTA",
);
assert(
  withLegacyExplore.ctaAlignment === "center",
  "legacy Explore alignment maps to CTA",
);
assert(
  withLegacyExplore.descriptionAlignment === "justify",
  "description justify alignment",
);
assert(
  JSON.stringify(normalizeHeroElementOrder(["explore", "title"])) ===
    JSON.stringify([
      "cta",
      "title",
      "eyebrow",
      "highlight",
      "subtitle",
      "description",
    ]),
  "legacy Explore order maps to canonical CTA",
);

// Hidden reserved-space contract markers (static source check)
const heroSource = readFileSync(
  resolve("src/components/sections/DynamicHeroSection.tsx"),
  "utf8",
);
const projectDetailsHeroSource = readFileSync(
  resolve("src/components/projects/details/ProjectDetailsHero.tsx"),
  "utf8",
);
const heroVisibilitySource = readFileSync(
  resolve("src/components/admin/page-blocks/ModuleEditorPresentation.tsx"),
  "utf8",
);
const heroVisibilityAdapterSource = readFileSync(
  resolve(
    "src/app/admin/pages-blocks/blocks/hero/[id]/HeroVisibilityAlignRow.tsx",
  ),
  "utf8",
);
const heroEditorSource = readFileSync(
  resolve("src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx"),
  "utf8",
);
const heroCtaEditorSource = readFileSync(
  resolve("src/app/admin/pages-blocks/blocks/hero/[id]/HeroCtaFields.tsx"),
  "utf8",
);
const heroOrderEditorSource = readFileSync(
  resolve(
    "src/app/admin/pages-blocks/blocks/hero/[id]/HeroElementOrderEditor.tsx",
  ),
  "utf8",
);
const adminLinkFieldSource = readFileSync(
  resolve("src/components/admin/ui/AdminLinkField.tsx"),
  "utf8",
);
const adminFormSwitchSource = readFileSync(
  resolve("src/components/admin/ui/AdminFormSwitch.tsx"),
  "utf8",
);
const adminTextFormatControlsSource = readFileSync(
  resolve("src/components/admin/ui/AdminTextFormatControls.tsx"),
  "utf8",
);
const adminRichTextSource = readFileSync(
  resolve("src/components/admin/AdminRichTextEditor.tsx"),
  "utf8",
);
const mediaGallerySource = readFileSync(
  resolve("src/components/admin/media/AdminMediaGalleryField.tsx"),
  "utf8",
);
const moduleRegistryMetadataSource = readFileSync(
  resolve("src/lib/page-composition/module-registry-metadata.ts"),
  "utf8",
);
const publicMediaImageSource = readFileSync(
  resolve("src/components/public/PublicMediaImage.tsx"),
  "utf8",
);
const globalStylesSource = readFileSync(resolve("src/app/globals.css"), "utf8");
const heroContractSource = readFileSync(
  resolve("src/lib/hero/hero-content-controls.ts"),
  "utf8",
);
const genericHeroActionSource = readFileSync(
  resolve("src/app/admin/pages-blocks/blocks/hero/actions.ts"),
  "utf8",
);
const projectsHeroActionSource = readFileSync(
  resolve("src/app/admin/pages-blocks/blocks/content/actions.ts"),
  "utf8",
);
const internalPageLayoutSource = readFileSync(
  resolve("src/components/InternalPageLayout.tsx"),
  "utf8",
);
const mediaCenterConfigSource = readFileSync(
  resolve("src/lib/media-center-page-config.ts"),
  "utf8",
);
const heroClosureMigration = readFileSync(
  resolve(
    "sql/migrations/20260822090000_hero_platform_product_preset_closure.sql",
  ),
  "utf8",
);
const {
  normalizeHeroTemplateProductConfig,
  parseHeroContentControlsFormData,
  resolveHeroContentControlsForVariant,
  resolveHeroFamily,
  resolveHeroImageCompositionPreset,
} = await import("../src/lib/hero/hero-content-controls.ts");
assert(
  heroSource.includes("data-hero-slot-visible"),
  "reserved-space attribute present",
);
assert(
  heroSource.includes('visibility: "hidden"') ||
    heroSource.includes("visibility: 'hidden'"),
  "uses visibility hidden",
);
assert(
  heroSource.includes("inert: true") || heroSource.includes("inert:true"),
  "uses boolean inert true",
);
assert(
  !/inert:\s*""/.test(heroSource) && !/inert:\s*''/.test(heroSource),
  "does not pass empty-string inert",
);
assert(
  heroSource.includes("Fragment"),
  "empty slots use Fragment to avoid flex gap wrappers",
);
assert(
  heroVisibilitySource.includes(
    "value={String(enableVisibility ? show : showDefault)}",
  ) &&
    heroVisibilitySource.includes(
      "onChange={(event) => setShow(event.target.checked)}",
    ) &&
    heroVisibilityAdapterSource.includes(
      "ModuleEditorVisibilityAlignRow as default",
    ),
  "Hero visibility controls persist explicit false state",
);
assert(
  heroVisibilitySource.includes("AdminTextFormatControls") &&
    adminTextFormatControlsSource.includes('data-admin-text-format-bold=""') &&
    adminTextFormatControlsSource.includes("aria-pressed={bold}") &&
    adminTextFormatControlsSource.includes(
      "onClick={() => onBoldChange(!bold)}",
    ) &&
    heroVisibilitySource.includes(
      "value={String(enableBold ? bold : boldDefault)}",
    ),
  "Hero text weight uses one shared toolbar button and preserves the canonical submitted field",
);
assert(
  adminTextFormatControlsSource.includes(
    "data-admin-text-alignment={option.value}",
  ) &&
    adminTextFormatControlsSource.includes("<svg") &&
    adminTextFormatControlsSource.includes("<path d={option.path} />") &&
    !adminTextFormatControlsSource.includes('label: "يمين"') &&
    !adminTextFormatControlsSource.includes('label: "وسط"') &&
    !adminTextFormatControlsSource.includes('label: "يسار"'),
  "Hero text alignment uses icon-only segmented controls with accessible labels",
);
const heroPresentationControlBindings = [
  ["show_eyebrow", "showEyebrow"],
  ["eyebrow_bold", "eyebrowBold"],
  ["eyebrow_alignment", "eyebrowAlignment"],
  ["show_title", "showTitle"],
  ["title_bold", "titleBold"],
  ["title_alignment", "titleAlignment"],
  ["show_highlight", "showHighlight"],
  ["highlight_bold", "highlightBold"],
  ["highlight_alignment", "highlightAlignment"],
  ["show_subtitle", "showSubtitle"],
  ["subtitle_bold", "subtitleBold"],
  ["subtitle_alignment", "subtitleAlignment"],
  ["show_description", "showDescription"],
  ["description_alignment", "descriptionAlignment"],
  ["show_cta", "showCta"],
  ["cta_alignment", "ctaAlignment"],
  ["show_project_download_action", "showProjectDownloadAction"],
  ["show_project_tracking_action", "showProjectTrackingAction"],
  ["show_project_reservation_action", "showProjectReservationAction"],
  ["project_action_order", "projectActionOrder"],
];
const heroPresentationEditorSources = `${heroEditorSource}\n${heroCtaEditorSource}\n${heroOrderEditorSource}`;
const heroPresentationRendererSources = `${heroSource}\n${projectDetailsHeroSource}`;
assert(
  heroPresentationControlBindings.every(
    ([fieldName, propertyName]) =>
      heroPresentationEditorSources.includes(fieldName) &&
      heroContractSource.includes(fieldName) &&
      heroPresentationRendererSources.includes(propertyName),
  ),
  "Every visible Hero presentation control maps through the canonical parser into the shared renderer",
);
assert(
  heroVisibilitySource.includes(
    "sm:flex-row sm:items-center sm:justify-between",
  ) && heroVisibilitySource.includes('controlsPlacement === "footer"'),
  "Hero controls share one dense responsive header/footer owner",
);
assert(
  (heroEditorSource.match(/name="name"/g) ?? []).length === 1 &&
    (heroEditorSource.match(/name="template_description"/g) ?? []).length ===
      1 &&
    /<input\s+type="hidden"\s+name="template_description"/.test(
      heroEditorSource,
    ) &&
    !heroEditorSource.includes("الوصف الداخلي") &&
    (heroEditorSource.match(/nature="standard"\s+span=\{3\}/g) ?? []).length >=
      2 &&
    /nature="binary-state"\s+span=\{3\}/.test(heroEditorSource) &&
    heroEditorSource.includes('className="flex h-full items-end pb-1.5"') &&
    heroEditorSource.includes("surface={false}") &&
    /<span className="block text-sm font-medium text-white\/70">\s*اسم الهيرو\s*<\/span>/.test(
      heroEditorSource,
    ) &&
    heroEditorSource.indexOf("اسم الهيرو") <
      heroEditorSource.indexOf('label="نمط العرض"') &&
    heroEditorSource.indexOf('label="نمط العرض"') <
      heroEditorSource.indexOf('label="حالة النشر"') &&
    adminFormSwitchSource.includes(
      "ADMIN_FORM_SWITCH_COMPACT_SURFACE_CLASS_NAME",
    ) &&
    adminFormSwitchSource.includes(
      'data-admin-form-switch-surface={surface ? "card" : "compact"}',
    ) &&
    adminFormSwitchSource.includes("border border-white/10 bg-white/[0.035]") &&
    !heroEditorSource.includes('className="min-h-11"'),
  "Hero identity row keeps three visible equal-quarter fields and an empty fourth quarter while preserving internal metadata",
);
assert(
  heroEditorSource.includes('nature="long-content" span={6}') &&
    heroEditorSource.includes("minHeight={56}") &&
    heroEditorSource.includes("maxHeight={88}") &&
    adminRichTextSource.includes("maxHeight?: number") &&
    adminRichTextSource.includes(
      'overflowY: maxHeight === undefined ? undefined : "clip"',
    ) &&
    !adminRichTextSource.includes("data-admin-rich-text-constrained=") &&
    !adminRichTextSource.includes(
      '[data-admin-rich-text-constrained="true"]:focus-within',
    ) &&
    !adminRichTextSource.includes("overscroll-contain") &&
    !heroEditorSource.includes("minHeight={140}") &&
    !heroEditorSource.includes("عنصر مستقل عن العنوان الفرعي") &&
    !heroEditorSource.includes("وجهات الإجراءات تُشتق من Route") &&
    !heroVisibilitySource.includes("helperText"),
  "Hero description keeps a fixed two-line card with clipped overflow and no focus expansion",
);
assert(
  (heroCtaEditorSource.match(/data-hero-cta-row=/g) ?? []).length === 2 &&
    heroCtaEditorSource.includes('controlsPlacement="cards"') &&
    (heroCtaEditorSource.match(/presentation="inline"/g) ?? []).length === 2 &&
    (heroCtaEditorSource.match(/chooseLinkLabel="اختيار الرابط"/g) ?? [])
      .length === 2 &&
    heroVisibilitySource.includes('controlsPlacement === "cards"') &&
    heroVisibilitySource.includes('data-module-editor-cta-grid=""') &&
    heroVisibilitySource.includes("lg:grid-cols-2") &&
    heroVisibilitySource.includes("Children.toArray(children)") &&
    heroVisibilitySource.includes("data-module-editor-cta-card=") &&
    heroVisibilitySource.includes(
      "value={String(enableVisibility ? show : showDefault)}",
    ) &&
    adminLinkFieldSource.includes('data-admin-link-field="inline"'),
  "Hero CTA text and shared link picker use two balanced cards with synchronized formatting inside each card",
);
assert(
  heroOrderEditorSource.includes('data-project-hero-action-cards=""') &&
    heroOrderEditorSource.includes("PROJECT_HERO_ACTION_VISIBILITY_FIELDS") &&
    heroOrderEditorSource.includes('name="project_action_order"') &&
    heroOrderEditorSource.includes("normalizeProjectHeroActionOrder") &&
    projectDetailsHeroSource.includes("showProjectActions") &&
    projectDetailsHeroSource.includes(
      "showDownload={resolvedPresentation.showProjectDownloadAction}",
    ) &&
    projectDetailsHeroSource.includes(
      "showTracking={resolvedPresentation.showProjectTrackingAction}",
    ) &&
    projectDetailsHeroSource.includes(
      "showReservation={resolvedPresentation.showProjectReservationAction}",
    ) &&
    projectDetailsHeroSource.includes(
      "order={resolvedPresentation.projectActionOrder}",
    ),
  "Project Detail adopts three compact independently ordered action cards through the shared Hero control contract",
);
assert(
  !heroSource.includes("HeroExploreLink"),
  "parallel Explore renderer removed",
);
assert(
  heroSource.includes(
    "inline-flex w-fit max-w-full whitespace-normal rounded-full",
  ) && heroSource.includes("heroPillAlignmentClass"),
  "Home Hero badges hug their content without losing responsive wrapping or alignment",
);
assert(
  heroSource.includes("usesHomeCinematicTypography") &&
    heroSource.includes(
      'activeConfig.highlightBold ? "font-semibold" : "font-normal"',
    ) &&
    heroSource.includes("sm:text-5xl md:text-6xl lg:text-7xl"),
  "Home Hero highlight retains the cinematic hierarchy while consuming its Bold field",
);
assert(
  heroSource.includes('activeConfig.titleBold ? "font-bold" : "font-normal"') &&
    heroSource.includes(
      'activeConfig.subtitleBold ? "font-bold" : "font-normal"',
    ) &&
    heroSource.includes("heroTextAlignClass(activeConfig.titleAlignment)") &&
    heroSource.includes("heroTextAlignClass(activeConfig.subtitleAlignment)"),
  "Special Hero title and subtitle consume their canonical Bold and alignment fields",
);
assert(
  globalStylesSource.includes("@layer base {") &&
    /@layer base \{[\s\S]*h1,[\s\S]*font-weight: 600;[\s\S]*p \{[\s\S]*font-weight: 400;[\s\S]*\}/u.test(
      globalStylesSource,
    ),
  "Base typography remains a fallback layer so Hero font-weight utilities win in computed CSS",
);
assert(
  heroSource.includes('config.titleAlignment === "center"') &&
    heroSource.includes('? "mx-auto"') &&
    heroSource.includes('config.titleAlignment === "left"') &&
    heroSource.includes('? "mr-auto"'),
  "Standard Internal title alignment moves the bounded title block as well as its text",
);
assert(
  (heroEditorSource.match(/id: "media"/g) ?? []).length === 1 &&
    !heroEditorSource.includes('id: "media-desktop"') &&
    !heroEditorSource.includes('id: "media-mobile"') &&
    heroEditorSource.includes('data-hero-media-section="desktop"') &&
    heroEditorSource.includes('data-hero-media-section="mobile"') &&
    heroEditorSource.includes('name="images"') &&
    heroEditorSource.includes('name="mobile_images"') &&
    moduleRegistryMetadataSource.includes('navigationLabelAr: "الصور"') &&
    !moduleRegistryMetadataSource.includes('navigationLabelAr: "ديسكتوب"') &&
    !moduleRegistryMetadataSource.includes('navigationLabelAr: "موبايل"'),
  "Hero desktop and mobile galleries share one Images tab without changing their submitted fields",
);
assert(
  mediaGallerySource.includes('data-admin-media-gallery-card="image"') &&
    mediaGallerySource.includes('data-admin-media-gallery-card="add"') &&
    mediaGallerySource.includes("galleryCardHeightClass") &&
    mediaGallerySource.includes("إضافة صورة") &&
    !mediaGallerySource.includes("تصفح وإضافة") &&
    !mediaGallerySource.includes("لا توجد صور —") &&
    heroEditorSource.includes('data-hero-image-composition=""') &&
    heroEditorSource.includes("HERO_CONTROL_CARD_CLASS_NAME") &&
    heroEditorSource.indexOf('data-hero-image-composition=""') <
      heroEditorSource.indexOf('data-hero-media-section="desktop"'),
  "Hero galleries use one equal-size add card and image composition is an independent text-style card",
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
  mediaGallerySource.includes("الصورة في أول الترتيب ولا يمكن تحريكها لأعلى") &&
    mediaGallerySource.includes(
      "الصورة في آخر الترتيب ولا يمكن تحريكها لأسفل",
    ) &&
    heroOrderEditorSource.includes("في أول الترتيب ولا يمكن تحريكه لأعلى") &&
    heroOrderEditorSource.includes("في آخر الترتيب ولا يمكن تحريكه لأسفل"),
  "Hero boundary controls explain every intentional disabled state",
);
assert(
  publicMediaImageSource.includes('loading={priority ? "eager" : undefined}') &&
    publicMediaImageSource.includes(
      'fetchPriority={priority ? "high" : undefined}',
    ) &&
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
    eyebrowBold: true,
    titleAlignment: "left",
    titleBold: false,
    ctaAlignment: "center",
    heroElementOrder: ["cta", "title", "eyebrow"],
  },
  "internal-page",
);
assert(
  standardizedInternalControls.eyebrowAlignment === "center" &&
    standardizedInternalControls.eyebrowBold === true &&
    standardizedInternalControls.titleAlignment === "left" &&
    standardizedInternalControls.titleBold === false &&
    standardizedInternalControls.ctaAlignment === "center" &&
    JSON.stringify(standardizedInternalControls.heroElementOrder) ===
      JSON.stringify(DEFAULT_HERO_ELEMENT_ORDER),
  "Standard Internal Hero preserves canonical typography fields while keeping one element order",
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
    heroSource.includes(
      "data-hero-composition-baseline={STANDARD_INTERNAL_HERO_COMPOSITION_BASELINE}",
    ) &&
    heroSource.includes('data-hero-composition-root="standard-internal"') &&
    heroSource.includes("h-[min(62vh,580px)] min-h-[440px]") &&
    !heroSource.includes("h-[min(46vh,500px)]") &&
    !heroSource.includes("config.heroLayout"),
  "Family B owns one height and one composition anchor",
);
assert(
  heroSource.includes("STANDARD_INTERNAL_HERO_ELEMENT_ORDER.map") &&
    heroSource.includes(
      "flex-col px-6 pb-10 pt-20 sm:pb-12 sm:pt-24 md:pb-14 md:pt-28 lg:px-6 lg:pb-16",
    ) &&
    !heroSource.includes("flex-col justify-end px-6") &&
    heroContractSource.includes(
      'STANDARD_INTERNAL_HERO_COMPOSITION_BASELINE = "topics"',
    ),
  "Standard composition fixes the Topics start baseline and Product order across the Family",
);
assert(
  !internalPageLayoutSource.includes("heroHeightClassName") &&
    !internalPageLayoutSource.includes("PublicMediaImage") &&
    internalPageLayoutSource.includes("shouldRenderHero") &&
    internalPageLayoutSource.includes("<DynamicHeroSection") &&
    internalPageLayoutSource.includes(
      "compositionFooter={resolvedHeroSlotContent}",
    ) &&
    heroSource.includes('data-hero-composition-footer="page-composition"'),
  "Static internal fallbacks delegate to the same shared Hero presentation owner",
);
assert(
  heroEditorSource.includes("isStandardInternal") &&
    !heroEditorSource.includes("enableAlignment={!isStandardInternal}") &&
    !heroEditorSource.includes("enableBold={!isStandardInternal}") &&
    heroVisibilitySource.includes(
      "alignment={enableAlignment ? alignment : undefined}",
    ) &&
    heroVisibilitySource.includes(
      "bold={boldName && enableBold ? bold : undefined}",
    ) &&
    heroEditorSource.includes("...(!isStandardInternal"),
  "Standard Internal CMS exposes supported typography tools while keeping ordering fixed",
);
assert(
  !mediaCenterConfigSource.includes("heroImagePositionClassName") &&
    !internalPageLayoutSource.includes("heroImagePositionClassName"),
  "unused Media Center static fallback cannot create a parallel object-position path",
);
assert(
  heroClosureMigration.includes(
    "hero_image = '/images/projects/i87/hero.jpg'",
  ) &&
    heroClosureMigration.includes(
      "and hero_image = '/images/projects/b84/progress-04 - copy (6).jpg'",
    ) &&
    heroClosureMigration.includes("I87 does not use its canonical Hero asset"),
  "Hero closure migration repairs and asserts the canonical I87 Hero asset",
);
assert(
  !heroContractSource.includes('  "explore",'),
  "parallel Explore element removed from contract",
);
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
  show_project_download_action: "showProjectDownloadAction",
  show_project_tracking_action: "showProjectTrackingAction",
  show_project_reservation_action: "showProjectReservationAction",
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
  Object.values(visibilityFields).every(
    (field) => visibleControls[field] === true,
  ),
  "all Hero visibility switches persist the authoritative final FormData value",
);
assert(
  Object.values(visibilityFields).every(
    (field) => hiddenControls[field] === false,
  ),
  "all Hero visibility switches persist the explicit hidden fallback",
);
const formattingFormData = new FormData();
formattingFormData.set("eyebrow_alignment", "center");
formattingFormData.set("eyebrow_bold", "true");
formattingFormData.set("title_alignment", "left");
formattingFormData.set("title_bold", "false");
formattingFormData.set("highlight_alignment", "center");
formattingFormData.set("highlight_bold", "true");
formattingFormData.set("subtitle_alignment", "left");
formattingFormData.set("subtitle_bold", "true");
const formattingControls = parseHeroContentControlsFormData(formattingFormData);
assert(
  formattingControls.eyebrowAlignment === "center" &&
    formattingControls.eyebrowBold === true &&
    formattingControls.titleAlignment === "left" &&
    formattingControls.titleBold === false &&
    formattingControls.highlightAlignment === "center" &&
    formattingControls.highlightBold === true &&
    formattingControls.subtitleAlignment === "left" &&
    formattingControls.subtitleBold === true,
  "Hero formatting FormData preserves every supported alignment and Bold value",
);
assert(!heroSource.includes("goldAccent"), "About goldAccent merge removed");
assert(heroSource.includes("HomeDynamicHero"), "Home hero path still present");
assert(
  /function HomeDynamicHero[\s\S]*function InternalDynamicHero/.test(
    heroSource,
  ) ||
    /function InternalDynamicHero[\s\S]*function HomeDynamicHero/.test(
      heroSource,
    ) ||
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
assert(
  both.showHighlight &&
    both.showSubtitle &&
    both.highlight === "HL" &&
    both.subtitle === "ST",
  "independent highlight+subtitle both show on About",
);

const onlySub = resolveIndependentHeroText(
  { highlight: "", subtitle: "ST", showHighlight: true, showSubtitle: true },
  true,
);
assert(
  !onlySub.showHighlight && onlySub.showSubtitle,
  "subtitle alone does not fabricate highlight",
);

if (process.exitCode) {
  console.error("\nInternal hero config verification failed.");
  process.exit(1);
}

console.log("\nInternal hero config verification passed.");

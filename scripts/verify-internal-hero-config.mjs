/**
 * Verifies internal hero content-control parsing contracts.
 * Keep in sync with src/lib/hero/hero-content-controls.ts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createJiti } from "jiti";
import { Children, Fragment, createElement, isValidElement, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { getModuleEditorSectionMetadata, MODULE_EDITOR_TAB_LABELS } from "../src/lib/page-composition/module-registry-metadata.ts";

import {
  DEFAULT_HERO_ELEMENT_ORDER,
  HERO_MEDIA_GEOMETRY,
  HERO_VARIANTS,
  heroFlexJustifyClass,
  normalizeHeroElementOrder,
  normalizeHeroTemplateProductConfig,
  parseOptionalBool,
  parseHeroTextAlignment,
  parseHeroContentControlsFormData,
  resolveDistinctHeroDescription,
  resolveHeroContentControls,
  resolveHeroContentControlsForVariant,
  resolveHeroFamily,
  resolveHeroImageCompositionPreset,
  resolveHeroMediaSlot,
} from "../src/lib/hero/hero-content-controls.ts";

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
const heroTextFieldSource = readFileSync(
  resolve("src/app/admin/pages-blocks/blocks/hero/[id]/HeroTextFieldRow.tsx"),
  "utf8",
);
const projectsHubEditorSource = readFileSync(
  resolve("src/components/admin/page-blocks/editors/ProjectsHubHeroModuleEditor.tsx"),
  "utf8",
);
const mediaGuidanceSource = readFileSync(
  resolve("src/components/admin/media/AdminMediaSlotGuidance.tsx"),
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
      "value={String(submittedBold)}",
    ) &&
    heroVisibilitySource.includes("preserveUnsetBold = false") &&
    heroVisibilitySource.includes("boldName && submittedBold !== undefined"),
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
  /<input\s+type="hidden"\s+name="template_description"/.test(heroEditorSource) &&
    heroEditorSource.includes("<ModuleEditorIdentitySection") &&
    heroEditorSource.includes('nameLabel="اسم الهيرو"') &&
    heroEditorSource.includes('name="variant"') &&
    heroEditorSource.includes('label="نمط العرض"') &&
    heroVisibilitySource.includes('data-module-editor-identity=""') &&
    heroVisibilitySource.includes('name="name"') &&
    heroVisibilitySource.includes("<ModuleEditorStatusSwitch") &&
    heroVisibilitySource.includes("surface={false}") &&
    adminFormSwitchSource.includes("ADMIN_FORM_SWITCH_COMPACT_SURFACE_CLASS_NAME"),
  "Hero identity delegates name, variant and status to the shared identity owner while preserving internal metadata",
);
assert(
  /<HeroTextFieldRow\s+label="الوصف"\s+name="description"[\s\S]*?preserveRichText/.test(heroEditorSource) &&
    heroEditorSource.includes('defaultValue={String(config.description ?? "")}') &&
    heroEditorSource.includes('boldName="description_bold"') &&
    !heroEditorSource.includes("<AdminRichTextEditor") &&
    heroTextFieldSource.includes('name={preserveRichText ? `${name}_editor` : name}') &&
    heroTextFieldSource.includes("value={text === initialText ? defaultValue : text}") &&
    heroTextFieldSource.includes("onChange={(event) => setText(event.target.value)}") &&
    heroTextFieldSource.includes("<HeroVisibilityAlignRow"),
  "Hero compact description retains original rich value until authored text changes and uses the shared Bold control",
);
assert(
  (heroCtaEditorSource.match(/data-hero-cta-row=/g) ?? []).length === 2 &&
    heroCtaEditorSource.includes('presentation="premium"') &&
    heroCtaEditorSource.includes('<AdminFormGrid columns={2}>') &&
    (heroCtaEditorSource.match(/<AdminCard presentation="premium"/g) ?? []).length === 2 &&
    heroCtaEditorSource.includes('<AdminFormControlHeader title="الزر الأساسي"') &&
    heroCtaEditorSource.includes('<AdminFormControlHeader title="الزر الثانوي"') &&
    (heroCtaEditorSource.match(/presentation="inline"/g) ?? []).length === 2 &&
    (heroCtaEditorSource.match(/actionPresentation="bare"/g) ?? []).length === 2 &&
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
    adminLinkFieldSource.includes('data-admin-link-field={presentation}') &&
    adminLinkFieldSource.includes('data-admin-link-destination=""') &&
    heroCtaEditorSource.includes('aria-label="نص الزر الأساسي"') &&
    heroCtaEditorSource.includes('aria-label="نص الزر الثانوي"') &&
    !/<span[^>]*>نص الزر (?:الأساسي|الثانوي)<\/span>/.test(heroCtaEditorSource) &&
    (heroCtaEditorSource.match(/<AdminFormGrid columns=\{1\}>/g) ?? []).length === 2,
  "Hero CTA shares one canonical formatting row and two balanced premium link cards while the default cards owner remains intact",
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
    getModuleEditorSectionMetadata("hero", "media")?.navigationLabelAr === MODULE_EDITOR_TAB_LABELS.images &&
    MODULE_EDITOR_TAB_LABELS.images === "الصور" &&
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
    heroEditorSource.includes('<AdminCard presentation="premium" className="h-full p-3">') &&
    heroEditorSource.includes('label={<AdminFormControlHeader title="تكوين الصورة"') &&
    heroEditorSource.indexOf('data-hero-image-composition=""') <
      heroEditorSource.indexOf('data-hero-media-section="desktop"'),
  "Hero galleries use one equal-size add card and image composition is an independent text-style card",
);
assert(
  heroEditorSource.includes('mediaSlot={resolveHeroMediaSlot(guidanceVariant, "desktop")}') &&
    heroEditorSource.includes('mediaSlot={resolveHeroMediaSlot(guidanceVariant, "mobile")}') &&
    (heroEditorSource.match(/density="compact"/g) ?? []).length === 2 &&
    HERO_VARIANTS.every((variant) => {
      const desktop = resolveHeroMediaSlot(variant, "desktop");
      const mobile = resolveHeroMediaSlot(variant, "mobile");
      return desktop.owner === `hero/${variant}` &&
        mobile.owner === desktop.owner &&
        desktop.device === "desktop" && mobile.device === "mobile" &&
        desktop.slot !== mobile.slot && desktop.fit === "cover" && mobile.fit === "cover";
    }),
  "Hero compact galleries retain distinct desktop and mobile contracts in the shared presentation owner",
);
assert(
  mediaGallerySource.includes("<AdminMediaOriginalDimensions") &&
    mediaGallerySource.includes("<AdminMediaSlotGuidance slot={mediaSlot}") &&
    mediaGuidanceSource.includes('slot.design?.kind !== "recommended"') &&
    mediaGuidanceSource.includes("slot.design.width") &&
    mediaGuidanceSource.includes("slot.design.height") &&
    !mediaGuidanceSource.includes("slot.display") &&
    !mediaGuidanceSource.includes("slot.note"),
  "Media cards retain original dimensions and practical recommended sizes while technical guidance stays out of Admin",
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
    heroSource.includes("HERO_MEDIA_GEOMETRY.internal.containerClass") &&
    HERO_MEDIA_GEOMETRY.internal.containerClass === "h-[min(62vh,580px)] min-h-[440px]" &&
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
      "alignment={hasAlignmentControl ? alignment : undefined}",
    ) &&
    heroVisibilitySource.includes(
      "bold={hasBoldControl ? (bold ?? false) : undefined}",
    ) &&
    heroEditorSource.includes("...(!isStandardInternal"),
  "Standard Internal CMS exposes supported typography tools while keeping ordering fixed",
);

// Exercise the actual shared row: the CTA-only unset opt-in must not alter
// Hero's default explicit boolean submission or its native Bold control.
const heroUiLoader = createJiti(import.meta.url, {
  fsCache: false,
  jsx: { runtime: "automatic" },
});
const [{ default: AdminCard }, { AdminFormControlHeader }, { default: AdminFormSwitch }, { default: AdminTextFormatControls }] = await Promise.all([
  heroUiLoader.import("../src/components/admin/ui/AdminCard.tsx"),
  heroUiLoader.import("../src/components/admin/ui/AdminForm.tsx"),
  heroUiLoader.import("../src/components/admin/ui/AdminFormSwitch.tsx"),
  heroUiLoader.import("../src/components/admin/ui/AdminTextFormatControls.tsx"),
]);
const heroRowTree = ts.createSourceFile("ModuleEditorPresentation.tsx", heroVisibilitySource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const heroRowNode = heroRowTree.statements.find(node =>
  ts.isFunctionDeclaration(node) && node.name?.text === "ModuleEditorVisibilityAlignRow");
const heroRowSurface = heroRowTree.statements.filter(ts.isVariableStatement)
  .flatMap(node => node.declarationList.declarations)
  .find(node => ts.isIdentifier(node.name) && node.name.text === "MODULE_EDITOR_CONTROL_CARD_CLASS_NAME");
if (!heroRowNode || !heroRowSurface?.initializer || !ts.isStringLiteral(heroRowSurface.initializer)) {
  throw new Error("The actual shared Hero row and its existing surface must be available to the rendering guard.");
}
const compiledHeroRow = ts.transpileModule(heroRowNode.getText(heroRowTree).replace(/^export /u, ""), {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
}).outputText;
const HeroVisibilityAlignRow = new Function(
  "React", "Children", "useState", "AdminCard", "AdminFormControlHeader", "AdminFormSwitch", "AdminTextFormatControls", "MODULE_EDITOR_CONTROL_CARD_CLASS_NAME",
  `${compiledHeroRow}\nreturn ModuleEditorVisibilityAlignRow;`,
)({ createElement, Fragment }, Children, useState, AdminCard, AdminFormControlHeader, AdminFormSwitch, AdminTextFormatControls, heroRowSurface.initializer.text);
assert(
  heroVisibilityAdapterSource.includes("ModuleEditorVisibilityAlignRow as default"),
  "Hero adapter retains the actual shared visibility and text-formatting owner",
);

for (const presentation of ["card", "premium"]) {
  for (const preserveUnsetBold of [false, true]) {
    for (const boldDefault of [undefined, false, true]) {
      for (const enableBold of [false, true]) {
        const markup = renderToStaticMarkup(createElement(HeroVisibilityAlignRow, {
          label: "عنوان الاختبار",
          showName: "show_title",
          alignmentName: "title_alignment",
          boldName: "title_bold",
          showDefault: false,
          alignmentDefault: "center",
          enableBold,
          ...(presentation === "premium" ? { presentation } : {}),
          ...(preserveUnsetBold ? { preserveUnsetBold } : {}),
          ...(boldDefault === undefined ? {} : { boldDefault }),
        }));
        const hiddenFields = [...markup.matchAll(/<input\b[^>]*>/gu)]
          .map(([tag]) => tag)
          .filter(tag => /\btype="hidden"/u.test(tag))
          .map(tag => [
            /\bname="([^"]+)"/u.exec(tag)?.[1],
            /\bvalue="([^"]*)"/u.exec(tag)?.[1],
          ]);
        const expectedBold = preserveUnsetBold ? boldDefault : (boldDefault ?? false);
        const boldInputs = hiddenFields.filter(([name]) => name === "title_bold");
        const boldButtons = [...markup.matchAll(/<button\b[^>]*>/gu)]
          .map(([tag]) => tag)
          .filter(tag => tag.includes('data-admin-text-format-bold=""'));
        const fieldsArePreserved =
          JSON.stringify(hiddenFields) === JSON.stringify([
            ["show_title", "false"],
            ["title_alignment", "center"],
            ...(expectedBold === undefined ? [] : [["title_bold", String(expectedBold)]]),
          ]) &&
          boldInputs.length === (expectedBold === undefined ? 0 : 1) &&
          boldButtons.length === (enableBold ? 1 : 0) &&
          boldButtons.every(tag =>
            tag.includes(`aria-pressed="${String(boldDefault ?? false)}"`) &&
            tag.includes('type="button"') &&
            !/\bdisabled(?:=|\s|>)/u.test(tag)) &&
          !markup.includes('name="undefined"');
        const submitted = new FormData();
        for (const [name, value] of hiddenFields) submitted.append(name, value);
        const heroRoundtrip = preserveUnsetBold ||
          ["home-cinematic", "internal-page", "project-detail"].every(variant => {
            const parsed = parseHeroContentControlsFormData(submitted);
            const saved = normalizeHeroTemplateProductConfig(parsed, variant);
            const reloaded = resolveHeroContentControlsForVariant(JSON.parse(JSON.stringify(saved)), variant);
            return reloaded.titleBold === expectedBold &&
              reloaded.showTitle === false && reloaded.titleAlignment === "center";
          });
        assert(
          fieldsArePreserved && heroRoundtrip,
          `Actual ${presentation} Hero row: Bold ${String(boldDefault)}, control ${enableBold ? "enabled" : "hidden"}, unset opt-in ${preserveUnsetBold} retains native submission and parser roundtrip`,
        );
      }
    }
  }
}

function findSharedBoldButton(node) {
  if (!isValidElement(node)) return undefined;
  if (node.type === "button" && node.props["data-admin-text-format-bold"] === "") return node;
  for (const child of Children.toArray(node.props.children)) {
    const found = findSharedBoldButton(child);
    if (found) return found;
  }
  return undefined;
}
for (const bold of [false, true]) {
  let changedValue;
  const button = findSharedBoldButton(AdminTextFormatControls({
    bold,
    onBoldChange: next => { changedValue = next; },
  }));
  button?.props.onClick();
  assert(
    button?.props["aria-pressed"] === bold && changedValue === !bold,
    `Actual shared Bold button toggles ${bold} to ${!bold} through its existing callback`,
  );
}

// Resolve the actual Hero link/read chain. Only the registered pages provider
// uses in-memory fixture data; no database client or production data is called.
const heroLinkLoader = createJiti(import.meta.url, {
  fsCache: false,
  alias: { "server-only": resolve("node_modules/next/dist/compiled/server-only/empty.js") },
});
const { resolveHeroConfigLinks } = await heroLinkLoader.import("../src/lib/admin/links/hero-config.ts");
const { getHeroConfig, readHeroLinkTarget } = await heroLinkLoader.import("../src/lib/page-sections.ts");
const { ensureAdminLinkProvidersRegistered } = await heroLinkLoader.import("../src/lib/admin/links/providers/index.ts");
const { registerAdminLinkProvider } = await heroLinkLoader.import("../src/lib/admin/links/registry.ts");
ensureAdminLinkProvidersRegistered();
let heroTargetProviderReads = 0;
registerAdminLinkProvider({
  type: "pages",
  label: "صفحة اختبار",
  labelPlural: "صفحات اختبار",
  search: async () => { throw new Error("Hero target verification cannot search live providers."); },
  resolveMany: async ids => {
    if (JSON.stringify(ids) !== "[901]") throw new Error("Unexpected Hero target fixture resource.");
    heroTargetProviderReads += 1;
    return new Map([[901, "/about"]]);
  },
});
const heroTargetCases = [];
for (const target of [undefined, "_self", "_blank", null, "_top"]) {
  for (const [kind, link, href] of [
    ["internal", { link_kind: "internal", linked_type: "pages", linked_id: 901, href: "/stale", anchor: "team" }, "/about#team"],
    ["external", { link_kind: "external", href: "https://example.test/hero#team" }, "https://example.test/hero#team"],
    ["anchor", { link_kind: "anchor", href: "#team", anchor: "team" }, "#team"],
  ]) {
    const value = { ...link, ...(target === undefined ? {} : { target }) };
    heroTargetCases.push({
      label: `${kind} ${String(target)}`,
      config: { primaryCtaLink: value, secondaryCtaLink: { ...value } },
      href,
      target: target === "_blank" ? "_blank" : "_self",
      explicitTarget: target === "_blank" || target === "_self" ? target : undefined,
    });
  }
}
for (const [label, config] of [
  ["legacy href", { primaryCtaHref: "https://example.test/legacy", secondaryCtaHref: "https://example.test/legacy" }],
  ["legacy string link", { primaryCtaLink: "https://example.test/legacy", secondaryCtaLink: "https://example.test/legacy" }],
  ["legacy object without kind", { primaryCtaLink: { href: "https://example.test/legacy" }, secondaryCtaLink: { href: "https://example.test/legacy" } }],
]) heroTargetCases.push({ label, config, href: "https://example.test/legacy", target: "_self" });

const resolvedHeroTargetCases = [];
for (const value of [undefined, null, "https://example.test", [], { target: "_top" }, { link_kind: "none", target: "_blank" }]) {
  assert(readHeroLinkTarget(value) === undefined, `Hero target reader rejects unsupported or unauthored target metadata: ${JSON.stringify(value)}`);
}
for (const target of ["_self", "_blank"]) {
  assert(readHeroLinkTarget({ link_kind: "external", target }) === target, `Hero target reader retains explicit ${target}`);
}
for (const fixture of heroTargetCases) {
  const stored = { title: "عنوان محفوظ", primaryCtaLabel: "الزر الأساسي", secondaryCtaLabel: "الزر الثانوي", ...fixture.config };
  const before = JSON.stringify(stored);
  const resolved = await resolveHeroConfigLinks(stored);
  for (const variant of ["home-cinematic", "internal-page"]) {
    const parsed = getHeroConfig({ variant, config: resolved });
    const targetsPreserved = ["primary", "secondary"].every(prefix =>
      parsed[`${prefix}CtaHref`] === fixture.href &&
      (parsed[`${prefix}CtaLink`]?.target === "_blank" ? "_blank" : "_self") === fixture.target);
    assert(
      targetsPreserved && parsed.title === stored.title && JSON.stringify(stored) === before,
      `${variant}: actual Hero link resolver and reader preserve ${fixture.label} without changing stored data or href resolution`,
    );
    resolvedHeroTargetCases.push({ ...fixture, variant, config: parsed });
  }
}
assert(heroTargetProviderReads === 10, "Hero internal targets resolve both buttons through the isolated canonical pages provider");

// Render the exact public CTA functions with real Next Link and shared hooks;
// extraction avoids loading unrelated Hero media/domain resources in this test.
const heroCtaTree = ts.createSourceFile("DynamicHeroSection.tsx", heroSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const heroCtaFunctionNames = ["HeroPressableLink", "useIntentPrefetch", "HeroReservedSlot", "HeroCtaButtons"];
const heroCtaNodes = heroCtaFunctionNames.map(name => heroCtaTree.statements.find(node =>
  ts.isFunctionDeclaration(node) && node.name?.text === name));
if (heroCtaNodes.some(node => !node)) throw new Error("The public Hero CTA owners must be available to the rendering guard.");
const compiledHeroCta = ts.transpileModule(heroCtaNodes.map(node => node.getText(heroCtaTree)).join("\n"), {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
}).outputText;
const [{ default: HeroNextLink }, { usePressFeedback }] = await Promise.all([
  heroUiLoader.import("next/link"),
  heroUiLoader.import("../src/hooks/use-press-feedback.ts"),
]);
const HeroCtaButtons = new Function(
  "React", "Link", "usePressFeedback", "useState", "heroFlexJustifyClass", "readHeroLinkTarget",
  `${compiledHeroCta}\nreturn HeroCtaButtons;`,
)({ createElement, Fragment }, HeroNextLink, usePressFeedback, useState, heroFlexJustifyClass, readHeroLinkTarget);
for (const fixture of resolvedHeroTargetCases) {
  const markup = renderToStaticMarkup(createElement(HeroCtaButtons, { config: fixture.config }));
  const anchors = [...markup.matchAll(/<a\b[^>]*>/gu)].map(([tag]) => tag);
  assert(
    anchors.length === 2 && anchors.every(tag => {
      const href = /\bhref="([^"]*)"/u.exec(tag)?.[1];
      const target = /\btarget="([^"]*)"/u.exec(tag)?.[1];
      const rel = /\brel="([^"]*)"/u.exec(tag)?.[1];
      return href === fixture.href && target === fixture.explicitTarget &&
        (target === "_blank"
          ? rel?.split(/\s+/u).includes("noopener") && rel.split(/\s+/u).includes("noreferrer")
          : rel === undefined);
    }),
    `${fixture.variant}: actual public Hero CTA anchors retain ${fixture.label} target, canonical href and safe new-window rel`,
  );
}
const heroWithoutLinks = getHeroConfig({ variant: "internal-page", config: await resolveHeroConfigLinks({}) });
assert(
  renderToStaticMarkup(createElement(HeroCtaButtons, { config: heroWithoutLinks })) === "",
  "Hero target adoption does not create buttons for absent links",
);

// Execute the two production composition expressions, including partial domain
// slides. A slide-owned href must not inherit unrelated manual link metadata.
function heroCompositionInitializer(functionName, variableName) {
  const owner = heroCtaTree.statements.find(node =>
    ts.isFunctionDeclaration(node) && node.name?.text === functionName);
  const declaration = owner?.body?.statements.filter(ts.isVariableStatement)
    .flatMap(node => node.declarationList.declarations)
    .find(node => ts.isIdentifier(node.name) && node.name.text === variableName);
  if (!declaration?.initializer) throw new Error(`Missing production Hero composition: ${functionName}.${variableName}`);
  return declaration.initializer.getText(heroCtaTree);
}
const composeHomeHero = new Function(
  "config", "activeSlide", "title", "highlight", "subtitle", "description",
  `return (${heroCompositionInitializer("HomeDynamicHero", "activeConfig")});`,
);
const composeInternalHero = new Function(
  "hero", "domainSlide",
  `return (${heroCompositionInitializer("DynamicHeroSection", "resolvedHero")});`,
);
const authoredHeroConfig = getHeroConfig({ variant: "home-cinematic", config: {
  title: "عنوان محفوظ",
  primaryCtaLabel: "أساسي", primaryCtaHref: "/manual-primary",
  primaryCtaLink: { link_kind: "internal", target: "_blank" },
  secondaryCtaLabel: "ثانوي", secondaryCtaHref: "/manual-secondary",
  secondaryCtaLink: { link_kind: "internal", target: "_self" },
} });
for (const [label, slide] of [
  ["no domain override", undefined],
  ["media-only slide", { desktopImage: "/fixture.webp" }],
  ["primary override", { primaryCtaLabel: "أساسي مستقل", primaryCtaHref: "/domain-primary" }],
  ["secondary override", { secondaryCtaLabel: "ثانوي مستقل", secondaryCtaHref: "/domain-secondary" }],
  ["both overrides", { primaryCtaLabel: "أساسي مستقل", primaryCtaHref: "/domain-primary", secondaryCtaLabel: "ثانوي مستقل", secondaryCtaHref: "/domain-secondary" }],
]) {
  const sourceHero = { variant: "internal-page", config: authoredHeroConfig };
  const before = JSON.stringify(sourceHero);
  const home = composeHomeHero(authoredHeroConfig, slide, "عنوان محفوظ", "", "", "");
  const internal = composeInternalHero(sourceHero, slide);
  for (const [variant, composed] of [["home/projects-hub", home], ["standard internal", internal.config]]) {
    assert(
      ["primary", "secondary"].every(prefix => {
        const hrefKey = `${prefix}CtaHref`;
        const linkKey = `${prefix}CtaLink`;
        const overridden = typeof slide?.[hrefKey] === "string";
        const expectedHref = variant === "standard internal" && slide
          ? slide[hrefKey] : (slide?.[hrefKey] ?? authoredHeroConfig[hrefKey]);
        return composed[hrefKey] === expectedHref &&
          composed[linkKey] === (overridden ? undefined : authoredHeroConfig[linkKey]);
      }) && JSON.stringify(sourceHero) === before &&
      (slide !== undefined || internal === sourceHero),
      `${variant}: actual ${label} composition clears only the target of a slide-owned href and retains existing fallback behavior`,
    );
  }
}
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

// Canonical content resolution keeps independently authored text and removes only duplicate description.
const independent = resolveHeroContentControls({ showHighlight: false, showSubtitle: true });
assert(
  independent.showHighlight === false && independent.showSubtitle === true &&
    resolveDistinctHeroDescription("Description", "Subtitle") === "Description" &&
    resolveDistinctHeroDescription("Subtitle", "Subtitle") === "",
  "actual Hero content owner preserves independent visibility and distinct description",
);

// Compatibility regressions execute the production parser/resolver, not local models.
assert(
  !/descriptionAlignment\s*===\s*"justify"\s*\?\s*"right"/u.test(
    `${heroEditorSource}\n${projectsHubEditorSource}`,
  ) &&
    (heroEditorSource.match(/alignmentDefault=\{controls.descriptionAlignment\}/gu) ?? []).length === 2 &&
    projectsHubEditorSource.includes("alignmentDefault={config.descriptionAlignment}") &&
    heroVisibilitySource.includes("useState<AdminTextAlignment>(alignmentDefault)") &&
    heroVisibilitySource.includes("value={hasAlignmentControl ? alignment : alignmentDefault}"),
  "Generic, Detail and Projects Hub editors pass supported description alignment unchanged into the shared submitted field",
);
for (const variant of HERO_VARIANTS) {
  for (const alignment of ["right", "center", "left", "justify"]) {
    const formData = new FormData();
    formData.set("description_alignment", alignment);
    const saved = normalizeHeroTemplateProductConfig(
      parseHeroContentControlsFormData(formData),
      variant,
    );
    const reloaded = resolveHeroContentControlsForVariant(
      JSON.parse(JSON.stringify(saved)),
      variant,
    );
    assert(
      reloaded.descriptionAlignment === alignment,
      `${variant}: authored ${alignment} description alignment survives parser, persistence normalization and reload`,
    );
  }
}
const invalidAlignmentForm = new FormData();
invalidAlignmentForm.set("description_alignment", "unsupported");
assert(
  parseHeroContentControlsFormData(invalidAlignmentForm).descriptionAlignment === "right",
  "invalid description alignment retains the canonical fallback",
);

const actionFields = [
  ["showProjectDownloadAction", "show_project_download_action"],
  ["showProjectTrackingAction", "show_project_tracking_action"],
  ["showProjectReservationAction", "show_project_reservation_action"],
];
const detailActionCases = [
  ["empty legacy config", {}, [true, true, true]],
  ["legacy collective false", { showCta: false }, [false, false, false]],
  ["legacy collective true", { showCta: true }, [true, true, true]],
  ["legacy snake string false", { show_cta: "false" }, [false, false, false]],
  ["legacy snake numeric false", { show_cta: 0 }, [false, false, false]],
  ["partial modern true", { showCta: false, showProjectDownloadAction: true }, [true, false, false]],
  ["partial modern false", { showCta: true, showProjectTrackingAction: false }, [true, false, true]],
  ["partial snake modern true", { show_cta: false, show_project_reservation_action: "true" }, [false, false, true]],
  ["partial snake modern false", { showCta: true, show_project_download_action: "false" }, [false, true, true]],
  ["explicit camel flags win", { showCta: false, showProjectDownloadAction: true, showProjectTrackingAction: false, showProjectReservationAction: true }, [true, false, true]],
  ["explicit snake flags win", { showCta: false, show_project_download_action: true, show_project_tracking_action: true, show_project_reservation_action: false }, [true, true, false]],
  ["explicit camel false wins over snake true", { showCta: true, showProjectDownloadAction: false, show_project_download_action: true }, [false, true, true]],
];
for (const [label, raw, expected] of detailActionCases) {
  const stored = { ...raw, projectActionOrder: ["reservation", "download", "tracking"], ctaAlignment: "left" };
  const before = JSON.stringify(stored);
  const resolved = resolveHeroContentControlsForVariant(stored, "project-detail");
  const formData = new FormData();
  for (const [key, field] of actionFields) formData.set(field, String(resolved[key]));
  formData.set("project_action_order", JSON.stringify(resolved.projectActionOrder));
  formData.set("cta_alignment", resolved.ctaAlignment);
  const saved = normalizeHeroTemplateProductConfig(parseHeroContentControlsFormData(formData), "project-detail");
  const reloaded = resolveHeroContentControlsForVariant(JSON.parse(JSON.stringify(saved)), "project-detail");
  assert(
    actionFields.every(([key], index) => resolved[key] === expected[index] && reloaded[key] === expected[index]) &&
      JSON.stringify(reloaded.projectActionOrder) === JSON.stringify(stored.projectActionOrder) &&
      reloaded.ctaAlignment === "left" && before === JSON.stringify(stored),
    `Project Detail ${label}: independent action visibility survives save/reload without changing order, alignment or input data`,
  );
}
assert(
  HERO_VARIANTS.filter((variant) => variant !== "project-detail").every((variant) => {
    const resolved = resolveHeroContentControlsForVariant({ showCta: false }, variant);
    return resolved.showCta === false && actionFields.every(([key]) => resolved[key] === true);
  }),
  "legacy Detail CTA compatibility leaves every other Hero variant unchanged",
);

if (process.exitCode) {
  console.error("\nInternal hero config verification failed.");
  process.exit(1);
}

console.log("\nInternal hero config verification passed.");

/** Verify Projects Hub adoption of the existing Hero and Projects owners. */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const failures = [];
const read = (relPath) => readFileSync(resolve(root, relPath), "utf8");
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const planSrc = read("src/lib/projects/build-projects-hub-render-plan.ts");
const planLoaderSrc = read("src/lib/projects/load-and-build-projects-hub-plan.ts");
const pageSrc = read("src/app/(site)/projects/page.tsx");
const hubPageSrc = read("src/components/projects/ProjectsHubPage.tsx");
const heroContractSrc = read("src/lib/hero/hero-content-controls.ts");
const heroConfigSrc = read("src/lib/page-blocks/projects-hub-config.ts");
const heroAdapterSrc = read("src/lib/projects/project-hero-adapter.ts");
const heroRendererSrc = read("src/components/sections/DynamicHeroSection.tsx");
const heroConsumerSrc = read("src/components/projects/ProjectsHubCanonicalHero.tsx");
const heroEditorSrc = read("src/components/admin/page-blocks/editors/ProjectsHubHeroModuleEditor.tsx");
const contentEditorSrc = read("src/components/admin/page-blocks/ContentModuleEditClient.tsx");
const contentActionsSrc = read("src/app/admin/pages-blocks/blocks/content/actions.ts");
const genericHeroEditorSrc = read("src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx");
const genericHeroActionsSrc = read("src/app/admin/pages-blocks/blocks/hero/actions.ts");
const visibilityOwnerSrc = read("src/app/admin/pages-blocks/blocks/hero/[id]/HeroVisibilityAlignRow.tsx");
const textFieldOwnerSrc = read("src/app/admin/pages-blocks/blocks/hero/[id]/HeroTextFieldRow.tsx");
const ctaOwnerSrc = read("src/app/admin/pages-blocks/blocks/hero/[id]/HeroCtaFields.tsx");
const moduleRegistrySrc = read("src/lib/page-blocks/module-edit-registry.ts");
const assignmentRowSrc = read("src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignmentRow.tsx");
const pageBlocksClientSrc = read("src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx");
const richTextEditorSrc = read("src/components/admin/AdminRichTextEditor.tsx");
const listingSrc = read("src/components/projects/ProjectsListSection.tsx");
const filtersSrc = read("src/components/projects/ProjectsHubFilters.tsx");

assert(planSrc.includes("incomplete_hub_modules"), "all-or-nothing incomplete reason missing");
assert(planSrc.includes("required_module_missing"), "required module missing markers absent");
assert(planSrc.includes("unsupported_slot"), "non-main slot must be skipped");
assert(pageSrc.includes("loadAndBuildProjectsHubPlan"), "projects page must load the canonical CMS plan");
assert(pageSrc.includes("تعذر تحميل صفحة المشروعات"), "incomplete composition must fail closed");
assert(!pageSrc.includes("isProjectsHubCmsEnabled"), "projects page must not have an environment adoption gate");
assert(!planLoaderSrc.includes("feature_flag_disabled"), "plan loader must not expose a feature-flag bypass");
assert(
  !existsSync(resolve(root, "src/lib/projects/projects-hub-cms-flag.ts")),
  "the Projects Hub Hero feature flag owner must be retired",
);
assert(!hubPageSrc.includes("useCmsPlan"), "Projects Hub must not keep a parallel static render branch");
assert(!hubPageSrc.includes("<ProjectsHubCanonicalHero"), "Hero rendering must occur only through the module plan");

assert(
  (listingSrc.match(/<ProjectListingEnglishName/g) ?? []).length === 2,
  "list and card views must share one English-name presentation owner",
);
assert(
  !filtersSrc.includes("إعادة تعيين الفلاتر") &&
    filtersSrc.includes("visibleFilters") &&
    filtersSrc.includes("options[0]?.id ?? \"all\""),
  "projects filters must consume configured visibility without a parallel reset action",
);

for (const field of ["showEyebrow", "showTitle", "showSubtitle", "showDescription", "showCta", "ctaAlignment"]) {
  assert(heroConfigSrc.includes(field), `Hero contract adoption missing ${field}`);
}
assert(heroContractSrc.includes('"cta"'), "shared Hero CTA element is missing");
assert(!heroContractSrc.includes('  "explore",'), "Explore must not remain a second Hero element contract");
assert(
  heroContractSrc.includes("parseHeroContentControlsFormData") &&
    contentActionsSrc.includes("parseHeroContentControlsFormData") &&
    genericHeroActionsSrc.includes("parseHeroContentControlsFormData"),
  "Generic and Projects Hub saves must use the same Hero presentation parser",
);

assert(heroEditorSrc.includes("HeroVisibilityAlignRow"), "Projects Hub must adopt shared visibility/alignment controls");
assert(!heroEditorSrc.includes("AdminFormSwitch"), "Projects Hub must not rebuild visibility controls locally");
assert(!heroEditorSrc.includes('name="project_order"'), "Hero must not own project ordering");
assert(!heroEditorSrc.includes('name="hidden_project_ids"'), "Hero must not own project visibility selection");
assert(!heroEditorSrc.includes('name="images"'), "Hero must not expose parallel project media controls");
assert(heroEditorSrc.includes('type="hidden" name="selection_mode"'), "single selection mode must be hidden");
for (const field of ["project_type", "limit", "autoplay_ms", "empty_state"]) {
  assert(heroEditorSrc.includes(`name="${field}"`), `Projects Hub editor missing ${field}`);
}
assert(!heroEditorSrc.includes('name="hero_variant"'), "Hero variant must not use a Projects Hub-local placement");
assert(
  contentEditorSrc.includes('type="hidden"') && contentEditorSrc.includes('name="hero_variant"'),
  "the single Projects Hub Hero variant must remain a hidden save contract",
);
assert(
  !contentEditorSrc.includes('label="نمط العرض"'),
  "a fixed one-option Projects Hub Hero variant must not remain a visible control",
);
assert(
  !contentEditorSrc.includes('id: "media-desktop"') && !contentEditorSrc.includes('id: "media-mobile"'),
  "Projects Hub must not expose read-only media tabs for Project Domain-owned images",
);
const topFieldIndexes = ["project_type", "limit", "autoplay_ms"].map((field) =>
  heroEditorSrc.indexOf(`name="${field}"`),
);
assert(topFieldIndexes.every((value) => value >= 0), "top-row fields must exist");
assert(topFieldIndexes.every((value, index) => index === 0 || value > topFieldIndexes[index - 1]), "top-row field order drifted");
assert(heroEditorSrc.indexOf('name="empty_state"') > topFieldIndexes.at(-1), "empty-state message must be a separate later row");
assert(
  heroEditorSrc.includes('className="lg:grid-cols-3 xl:grid-cols-12"') &&
    heroEditorSrc.includes('className="lg:grid-cols-2 xl:grid-cols-12"'),
  "Projects Hub fields must keep the requested desktop grouping and responsive visibility grid",
);

assert(contentEditorSrc.includes("HeroCtaFields"), "Projects Hub must adopt the shared CTA editor");
assert(contentEditorSrc.includes("HeroElementOrderEditor"), "Projects Hub must adopt the shared element-order editor");
assert(contentEditorSrc.includes("PROJECTS_HUB_HERO_ELEMENT_KEYS"), "Projects Hub order applicability must be explicit");
assert(!contentEditorSrc.includes("ProjectsHubHeroActionsEditor"), "parallel Projects Hub CTA editor must be removed");
assert(!contentEditorSrc.includes("ProjectsHubHeroOrderEditor"), "parallel Projects Hub order editor must be removed");
assert(textFieldOwnerSrc.includes("HeroVisibilityAlignRow"), "Generic text controls must compose the same visibility owner");
assert(!textFieldOwnerSrc.includes("function toolClass"), "Generic text fields must not duplicate the alignment toolbar");
assert(visibilityOwnerSrc.includes("boldName") && visibilityOwnerSrc.includes('type="hidden" name={boldName}'), "saved bold values must remain compatibility-only");
assert(!visibilityOwnerSrc.includes('label="خط عريض"'), "typographic weight must not remain a Hero CMS product control");
assert(visibilityOwnerSrc.includes('data-hero-control-row=""'), "all Hero fields must use one visual control row");
assert(
  visibilityOwnerSrc.includes("flex-nowrap") && visibilityOwnerSrc.includes("justify-between"),
  "shared Hero toolbars must keep one stable responsive layout",
);
assert(genericHeroEditorSrc.includes("HeroCtaFields"), "Generic Hero must consume the shared CTA editor");
assert(
  genericHeroEditorSrc.includes("HeroVisibilityAlignRow") &&
    genericHeroEditorSrc.includes('toolbarMode="none"') &&
    !genericHeroEditorSrc.includes("visibilityName=") &&
    !genericHeroEditorSrc.includes("enableTextAlign"),
  "Generic Hero description must use the shared Hero presentation toolbar without rich-text styling controls",
);
assert(
  genericHeroEditorSrc.includes('className="lg:grid-cols-2 xl:grid-cols-12"') &&
    genericHeroEditorSrc.includes('className="lg:col-span-2 xl:col-span-12"') &&
    richTextEditorSrc.includes('label && toolbarMode !== "none"') &&
    !richTextEditorSrc.includes("toolbarPlacement") &&
    !richTextEditorSrc.includes("visibilityName"),
  "Generic Hero must keep a balanced responsive grid without duplicate or dead rich-text presentation controls",
);
assert(!genericHeroEditorSrc.includes("show_cta_element"), "CTA visibility must have one canonical form key");
assert(!genericHeroEditorSrc.includes("show_explore"), "Generic Hero must not expose a parallel Explore control");
assert(ctaOwnerSrc.includes('linkSource?: "admin" | "project-domain"'), "shared CTA editor must declare link ownership");
assert(
  ctaOwnerSrc.includes("HeroVisibilityAlignRow") &&
    ctaOwnerSrc.includes('alignmentName="cta_alignment"') &&
    ctaOwnerSrc.includes('showName="show_cta"'),
  "shared CTA editor must own text/link/visibility/alignment UX",
);
assert(!contentEditorSrc.includes("الأزرار والإجراءات"), "Projects Hub must not duplicate the shared Hero CTA tab heading");
assert(
  ctaOwnerSrc.includes("يفتح الزر صفحة المشروع الحالية تلقائيًا") &&
    !ctaOwnerSrc.includes("صفحة المشروع الحالية\n            </div>"),
  "Project-domain CTA must explain automatic link ownership without a fake editable control",
);

assert(
  moduleRegistrySrc.includes("resolveModuleProductKind") &&
    moduleRegistrySrc.includes('return "hero"') &&
    contentEditorSrc.includes('moduleKind={moduleProductKind}') &&
    assignmentRowSrc.includes("row.template_slug") &&
    assignmentRowSrc.includes("row.template_variant") &&
    pageBlocksClientSrc.includes("resolveModuleProductKind"),
  "Projects Hub Hero product classification must resolve once while persistence remains Content",
);

assert(
  heroContractSrc.includes('HERO_TEMPLATE_VARIANTS = ["home-cinematic", "internal-page"]') &&
    heroContractSrc.includes("HERO_TEMPLATE_VARIANT_OPTIONS_AR") &&
    heroContractSrc.includes("parseHeroTemplateVariant") &&
    read("src/app/admin/pages-blocks/blocks/hero/[id]/page.tsx").includes("HERO_TEMPLATE_VARIANT_OPTIONS_AR") &&
    read("src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx").includes("HERO_TEMPLATE_VARIANT_OPTIONS_AR") &&
    genericHeroActionsSrc.match(/parseHeroTemplateVariant\(formData\.get\("variant"\)\)/g)?.length === 2,
  "Generic Hero editor variants must exclude domain-owned Hero pipelines",
);

assert(heroAdapterSrc.includes("sortProjectsByHomepageOrder(projects)"), "Hero must consume Projects Domain ordering");
assert(!heroAdapterSrc.includes("config.projectReferences"), "Hero adapter must not apply parallel project ordering");
assert(heroAdapterSrc.includes("project.heroImage.src"), "Hero images must come from Projects Domain");
assert(heroAdapterSrc.includes("primaryCtaLabel") && heroAdapterSrc.includes("primaryCtaHref"), "Projects Hub must adapt into the shared CTA contract");
assert(!heroAdapterSrc.includes("exploreLabel") && !heroAdapterSrc.includes("exploreHref"), "parallel Explore CTA adapter must be removed");
assert(!heroRendererSrc.includes("HeroExploreLink"), "parallel Explore renderer must be removed");
assert(heroRendererSrc.includes("HeroCtaButtons"), "shared Hero CTA renderer must remain canonical");
assert(heroConsumerSrc.includes("DynamicHeroSection"), "Projects Hub must render through the shared Hero facade");
assert(!heroConsumerSrc.includes("FALLBACK_MODULE"), "Projects Hub must not keep a local Hero fallback module");

assert(
  heroRendererSrc.includes('variant === "home-cinematic" || variant === "projects-hub"') &&
    heroRendererSrc.includes("const config = getHeroConfig(hero)") &&
    heroRendererSrc.includes("InternalDynamicHero"),
  "Home, Projects Hub, and Internal Hero must resolve the same presentation contract",
);

if (failures.length) {
  console.error("verify-projects-hub-readiness FAILED:");
  for (const item of failures) console.error(` - ${item}`);
  process.exit(1);
}

console.log("verify-projects-hub-readiness OK");

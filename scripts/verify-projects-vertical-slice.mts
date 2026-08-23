import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const heroRenderer = read("src/components/sections/DynamicHeroSection.tsx");
const heroAdapter = read("src/lib/projects/project-hero-adapter.ts");
const heroConfig = read("src/lib/page-blocks/projects-hub-config.ts");
const heroConsumer = read("src/components/projects/ProjectsHubCanonicalHero.tsx");
const projectRenderer = read("src/components/projects/details/ResidentialProjectDetails.tsx");
const commercialProjectRenderer = read("src/components/projects/details/CommercialProjectDetails.tsx");
const projectDetailsHero = read("src/components/projects/details/ProjectDetailsHero.tsx");
const projectDetailsRoute = read("src/app/(site)/projects/[slug]/page.tsx");
const heroPresentationOwner = read("src/lib/hero/hero-content-controls.ts");
const heroLoader = read("src/lib/load-hero-section.ts");
const heroAdminEditor = read("src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx");
const heroAdminActions = read("src/app/admin/pages-blocks/blocks/hero/actions.ts");
const projectDistrict = read("src/components/projects/details/ProjectDistrictSection.tsx");
const plansRenderer = read("src/components/projects/details/ProjectPlansAndAreasSection.tsx");
const deliveryRenderer = read("src/components/projects/details/ProjectDeliverySpecsSection.tsx");
const galleries = read("src/components/projects/details/ProjectImageGalleries.tsx");
const publicMediaImage = read("src/components/public/PublicMediaImage.tsx");
const publicLoader = read("src/lib/projects/load-published-projects.ts");
const publicMapper = read("src/lib/projects/map-public-project.ts");
const listRenderer = read("src/components/projects/ProjectsListSection.tsx");
const featuredRenderer = read("src/components/projects/ProjectsFeaturedSection.tsx");
const mobileProjectOverlays = read("src/components/projects/ProjectCardMobileOverlays.tsx");
const projectsTable = read("src/app/admin/projects/ProjectsTableClient.tsx");
const adminPagination = read("src/components/admin/ui/AdminTablePagination.tsx");
const header = read("src/components/admin/page-blocks/BlockEditorContextHeader.tsx");
const contentEditor = read("src/components/admin/page-blocks/ContentModuleEditClient.tsx");
const homeProjectsConfig = read("src/lib/page-blocks/configs.ts");
const homeProjectsMapper = read("src/components/home/home-projects-mappers.ts");
const homeProjectsRenderer = read("src/components/home/HomeProjectsSection.tsx");
const homeProjectsEditor = read("src/components/admin/page-blocks/editors/HomeProjectsPlacementEditor.tsx");
const contentActions = read("src/app/admin/pages-blocks/blocks/content/actions.ts");
const locationMigration = read("sql/migrations/20260729150000_project_admin_schema_parity_forward_fix.sql");
const titleMigration = read("sql/migrations/20260817100000_project_section_title_contract.sql");
const mediaMigration = read("sql/migrations/20260817101000_media_ordinary_attachment_scope.sql");
const safeDeleteMigration = read("sql/migrations/20260725180000_media_delete_reservation_saga.sql");
const projectDetailHeroMigration = read("sql/migrations/20260823100000_project_detail_hero_configuration_adoption.sql");

assert.equal(existsSync(resolve(root, "src/components/projects/ProjectsHubHero.tsx")), false,
  "parallel ProjectsHubHero presentation must be retired");
assert.match(heroRenderer, /domainSlides/);
assert.match(heroAdapter, /adaptProjectsToHeroSlides/);
assert.match(heroAdapter, /project\.heroImage\.src/);
assert.doesNotMatch(heroConfig, /arabicName|englishName|heroImage|shortDescription/,
  "Hero config must not copy Project domain data");
for (const token of ["projectType", "limit", "heroElementOrder", "showCta", "ctaAlignment", "primaryCtaLabel", "projects-hub"]) {
  assert.ok(heroConfig.includes(token), `Hero contract missing ${token}`);
}
assert.match(heroConsumer, /DynamicHeroSection/);
assert.doesNotMatch(heroConsumer, /BreadcrumbModuleSection/);
assert.doesNotMatch(heroRenderer, /belowTitle|breadcrumb/);
assert.match(heroAdapter, /sortProjectsByHomepageOrder\(projects\)/,
  "Projects Hero must consume the Projects Domain ordering owner");
assert.doesNotMatch(heroAdapter, /config\.projectReferences/,
  "Projects Hero must not apply parallel project ordering");
assert.match(heroAdapter, /primaryCtaLabel:/,
  "Projects Hero must adopt the shared CTA contract");
assert.match(heroAdapter, /primaryCtaHref:\s*config\.showCta\s*\?\s*getProjectHref\(project\)/,
  "Projects Hero CTA links must resolve from the Project domain");
assert.match(heroAdapter, /showEyebrow:\s*config\.showEyebrow/,
  "Projects Hub Hero must keep its independent location presentation decision in the shared Hero contract");
assert.match(heroPresentationOwner, /HERO_TEMPLATE_VARIANTS[\s\S]*"project-detail"/,
  "Project Detail must be authored by the existing Hero Template pipeline");
assert.match(heroPresentationOwner, /HERO_DOMAIN_BACKED_TEMPLATE_VARIANTS = \["project-detail"\]/,
  "Project Detail Hero must declare domain-backed content without moving Project data");
assert.match(heroLoader, /getDomainBackedHeroTemplateState/,
  "the shared Hero loader must own Project Detail presentation reads");
assert.match(projectDetailsRoute, /getDomainBackedHeroTemplateState\("project-detail"\)/,
  "Project Detail route must load Hero Configuration before rendering its consumer");
assert.match(projectDetailsRoute, /getHeroConfig\(projectDetailHeroState\.hero\)/,
  "Project Detail route must resolve the existing shared Hero config contract");
for (const token of [
  "showEyebrow",
  "showTitle",
  "showSubtitle",
  "showDescription",
  "showCta",
  "heroElementOrder",
  "imageComposition",
]) {
  assert.ok(projectDetailsHero.includes(token), `Project Detail Hero adoption missing ${token}`);
}
assert.match(projectRenderer, /presentation=\{heroPresentation\}/);
assert.match(commercialProjectRenderer, /presentation=\{heroPresentation\}/);
assert.match(projectRenderer, /showProjectHero\s*\?/);
assert.match(commercialProjectRenderer, /showProjectHero\s*\?/);
assert.match(heroAdminEditor, /Project Domain[\s\S]*showName="show_eyebrow"/,
  "the existing Hero Admin screen must expose Project Detail presentation controls");
assert.match(heroAdminActions, /isDomainBackedHeroTemplateVariant\(variant\)[\s\S]*imageComposition: base\.imageComposition/,
  "domain-backed Hero persistence must exclude copied Project content");
assert.match(projectDetailHeroMigration, /hero_templates_project_detail_singleton_idx/,
  "Project Detail Hero must have one canonical Hero Configuration");
assert.match(projectDetailHeroMigration, /source_type = 'domain-backed'/,
  "Project Detail Hero content ownership must stay explicit");
assert.match(projectDistrict, /resolveVisibleProjectLocationLabel\(location\)/,
  "Project District detailed address must adopt the Project-owned presentation decision");
assert.match(projectDistrict, /resolveVisibleProjectLocationTags\(/,
  "Project District tags must adopt the Project-owned presentation decision");
assert.doesNotMatch(projectRenderer, /showDistrictLocationLabel|showLocationLabel=/,
  "Project Detail must not retain an unmanaged parallel location decision");

for (const source of [homeProjectsConfig, homeProjectsMapper, homeProjectsRenderer]) {
  assert.match(source, /showProjectLocation/,
    "Home Project Cards must carry their existing module presentation decision end-to-end");
}
assert.match(homeProjectsConfig, /readShowFlag\("showProjectLocation", "show_project_location"\)/,
  "Home Project Cards must preserve legacy visible defaults while reading the persisted presentation flag");
assert.match(homeProjectsEditor, /name="show_project_location"/,
  "Home Project Cards must expose their location presentation decision in the existing editor");
assert.match(contentActions, /showProjectLocation:\s*parseFormBoolean\(formData, "show_project_location", false\)/,
  "Home Project Cards must persist the presentation decision through the existing module config owner");
assert.match(homeProjectsRenderer, /resolveVisibleProjectLocationLabel\([\s\S]*showProjectLocation/,
  "Home Project Cards must compose their own decision with the Project-owned hidden-location path");
for (const source of [listRenderer, featuredRenderer, mobileProjectOverlays]) {
  assert.match(source, /show(Project)?Location/,
    "Projects listing and featured cards must keep their existing consumer-owned location decision");
}
assert.match(heroRenderer, /PublicArtDirectedMediaImage/,
  "art-directed Hero images must adopt the shared public image owner");
assert.match(publicMediaImage, /onError=\{\(\) => setFailedSourceKey\(sourceKey\)\}/,
  "the shared public image owner must fall back after an art-directed source fails");
assert.match(heroRenderer, /setPreparedSlideIndexes\(new Set\(\[safeIndex, nextIndex\]\)\)/,
  "Hero image preparation must replace its bounded window instead of accumulating slides");
assert.match(publicMediaImage, /PUBLIC_MEDIA_IMAGE_FALLBACK/);

for (const field of ["location_title", "overview_title", "plans_title", "delivery_title", "gallery_title"]) {
  assert.ok(titleMigration.includes(field), `Migration missing ${field}`);
}
assert.match(titleMigration, /alter column overview_title drop not null/);
assert.match(titleMigration, /alter column delivery_title drop not null/);
assert.match(titleMigration, /NULL\/blank renders no heading/);
for (const hardCodedCopy of [
  "اختيارات واضحة لمساحات مدروسة",
  "كل مساحة هنا لها توزيع عملي",
  "مواصفات التنفيذ والتسليم",
]) {
  assert.equal(
    [projectRenderer, plansRenderer, deliveryRenderer].some((source) => source.includes(hardCodedCopy)),
    false,
    `Residential renderer still contains hard-coded copy: ${hardCodedCopy}`,
  );
}
assert.match(projectRenderer, /project\.overview\.title \?/);
assert.match(projectRenderer, /project\.gallery\.title \?/);
assert.match(galleries, /slice\(safeGroupIndex \* 4, safeGroupIndex \* 4 \+ 4\)/);
assert.match(galleries, /slice\(safeGroupIndex \* 3, safeGroupIndex \* 3 \+ 3\)/);

assert.match(publicLoader, /\.eq\("slug", slug\)\s*\.eq\("publication_status", "published"\)/);
assert.match(publicLoader, /PUBLIC_PROJECT_MODEL_CACHE_VERSION/,
  "public Project caches must version the mapped section-title contract");
assert.match(publicMapper, /RETIRED_DELIVERY_PRESENTATION_COPY/);
assert.match(publicMapper, /plainText === RETIRED_DELIVERY_PRESENTATION_COPY \? "" : body/);
assert.doesNotMatch(projectsTable, /pageSizeOptions=\{\["10", "20", "30", "50"\]\}/);
assert.match(projectsTable, /pageSizeOptions=\{\["10", "20", "30"\]\}/);
assert.match(adminPagination, /const pageSizeOptions = requestedPageSizeOptions;/,
  "shared pagination must honor each consumer's declared page-size contract");
assert.match(listRenderer, /display\.showProjectName/);
assert.match(listRenderer, /display\.showProjectCode/);

assert.match(header, /AdminActionButton href=\{backHref\}/);
assert.doesNotMatch(contentEditor, /href="\/admin\/projects"/);
assert.match(locationMigration, /v_parent_level <> v_expected_parent_level/);
assert.match(locationMigration, /message = 'The selected location hierarchy is invalid\.'/);

const leaseBody = mediaMigration.slice(mediaMigration.indexOf("create or replace function public.acquire_media_reference_write_lease"));
assert.doesNotMatch(leaseBody, /assert_media_catalog_coordination_ready/);
assert.doesNotMatch(leaseBody, /reconciliation_state <> 'synced'/);
assert.match(leaseBody, /asset\.status <> 'active'/);
assert.match(leaseBody, /asset\.missing_object/);
assert.match(leaseBody, /media_write_lease_delete_reserved/);
assert.match(leaseBody, /media_write_lease_conflict/);
assert.match(safeDeleteMigration, /assert_media_catalog_coordination_ready/,
  "safe-delete global readiness guard must remain intact");

console.log("verify-projects-vertical-slice OK");

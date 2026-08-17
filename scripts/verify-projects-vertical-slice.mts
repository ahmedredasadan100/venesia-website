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
const plansRenderer = read("src/components/projects/details/ProjectPlansAndAreasSection.tsx");
const deliveryRenderer = read("src/components/projects/details/ProjectDeliverySpecsSection.tsx");
const galleries = read("src/components/projects/details/ProjectImageGalleries.tsx");
const publicMediaImage = read("src/components/public/PublicMediaImage.tsx");
const publicLoader = read("src/lib/projects/load-published-projects.ts");
const publicMapper = read("src/lib/projects/map-public-project.ts");
const listRenderer = read("src/components/projects/ProjectsListSection.tsx");
const projectsTable = read("src/app/admin/projects/ProjectsTableClient.tsx");
const adminPagination = read("src/components/admin/ui/AdminTablePagination.tsx");
const header = read("src/components/admin/page-blocks/BlockEditorContextHeader.tsx");
const contentEditor = read("src/components/admin/page-blocks/ContentModuleEditClient.tsx");
const locationMigration = read("sql/migrations/20260729150000_project_admin_schema_parity_forward_fix.sql");
const titleMigration = read("sql/migrations/20260817100000_project_section_title_contract.sql");
const mediaMigration = read("sql/migrations/20260817101000_media_ordinary_attachment_scope.sql");
const safeDeleteMigration = read("sql/migrations/20260725180000_media_delete_reservation_saga.sql");

assert.equal(existsSync(resolve(root, "src/components/projects/ProjectsHubHero.tsx")), false,
  "parallel ProjectsHubHero presentation must be retired");
assert.match(heroRenderer, /domainSlides/);
assert.match(heroAdapter, /adaptProjectsToHeroSlides/);
assert.match(heroAdapter, /project\.heroImage\.src/);
assert.doesNotMatch(heroConfig, /arabicName|englishName|heroImage|shortDescription/,
  "Hero config must not copy Project domain data");
for (const token of ["projectType", "projectReferences", "limit", "visible", "order", "heroElementOrder"]) {
  assert.ok(heroConfig.includes(token), `Hero contract missing ${token}`);
}
assert.match(heroConsumer, /DynamicHeroSection/);
assert.match(heroRenderer, /onError=\{\(\) => setFailedSourceKey\(sourceKey\)\}/,
  "art-directed Hero images must fall back after a selected source fails");
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

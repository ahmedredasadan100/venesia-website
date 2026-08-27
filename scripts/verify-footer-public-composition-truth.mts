import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const footerTypes = read("src/lib/footer/types.ts");
const footerLoader = read("src/lib/footer/load-footer-settings.ts");
const footerSave = read("src/app/admin/pages-blocks/footer/footer-actions/save.ts");
const footerRestore = read("src/app/admin/pages-blocks/footer/footer-actions/restore-default.ts");
const footerHelpers = read("src/app/admin/pages-blocks/footer/footer-actions/helpers.ts");
const siteLayout = read("src/app/(site)/layout.tsx");
const homeContent = read("src/components/home/HomeMainSlotContent.tsx");
const homeSections = [
  "HomeStorySection.tsx",
  "HomeProjectsSection.tsx",
  "HomeTrustSection.tsx",
  "HomeContactSection.tsx",
].map((file) => read(`src/components/home/${file}`));
const compositionLoader = read("src/lib/page-blocks/load-page-composition.ts");
const compositionTypes = read("src/lib/page-blocks/page-composition-types.ts");
const mediaHubConsumer = read("src/components/media-center/renderMediaHubSections.tsx");
const venisiaMediaHubLayout = read("src/components/page-composition/VenesiaThemeMediaHubLayout.tsx");
const mediaListingConsumer = read("src/components/media-center/MediaListingPage.tsx");
const mediaDetailConsumer = read("src/components/media-center/MediaDetailPage.tsx");
const mediaShell = read("src/components/media-center/MediaCenterShellLayout.tsx");
const cacheOwner = read("src/lib/cache/revalidate-public-cache-tags.ts");
const diagnostics = read("src/lib/seo/run-global-seo-health.ts");
const migration = read("sql/migrations/20260805090000_footer_public_composition_truth_closure.sql");

assert.ok(!footerTypes.includes('"footer.brand"'), "footer.brand must not remain in the runtime contract");
assert.ok(!footerSave.includes("footer.brand") && !footerRestore.includes("footer.brand"), "Footer writers must not dual-write footer.brand");
assert.ok(footerLoader.includes('sourceStatus: "database"') && footerLoader.includes("cloneEmptyFooterSettings"), "Footer loader must expose database/outage truth");
assert.ok(!footerLoader.includes("buildSlotsFromLegacy") && !siteLayout.includes("DEFAULT_FOOTER_SETTINGS"), "Public Footer must not use a hidden legacy/default composition fallback");
assert.ok(footerHelpers.includes('rpc("save_footer_settings"') && footerSave.includes("saveFooterSettingsWithAudit") && footerRestore.includes("saveFooterSettingsWithAudit"), "Footer persistence and Audit must share the atomic owner");

assert.ok(homeContent.includes("PageSlotContent") && !homeContent.includes("HomeStorySection") && !homeContent.includes("HomeContactSection"), "Home must use the shared CMS-only renderer without hardcoded section fallbacks");
for (const source of homeSections) {
  assert.ok(!source.includes("STATIC_DEFAULTS"), "Home sections must not hide persisted gaps behind static content");
  assert.ok(source.includes("content:"), "Home section content must be required from the CMS mapper");
}

assert.ok(compositionTypes.includes("mediaHubModules") && compositionTypes.includes("mediaSidebarModules") && compositionTypes.includes("heroVisibility"), "Page Composition must own specialized Media states and Hero visibility");
assert.ok(compositionLoader.includes("queryMediaHubModules") && compositionLoader.includes("queryMediaSidebarModules"), "Page Composition must aggregate Media Hub/Sidebar queries");
for (const consumer of [mediaHubConsumer, mediaListingConsumer, mediaDetailConsumer]) {
  assert.ok(!consumer.includes("loadMediaCenterSidebarProps") && !consumer.includes("loadMediaSidebarModules"), "Parallel Media Sidebar public loader is forbidden");
}
assert.ok(
  compositionLoader.includes('isAssignmentPositionAllowed("media-sidebar", widget.slot)') &&
    compositionLoader.includes("slots[widget.slot].push") &&
    compositionLoader.includes('isAssignmentPositionAllowed("media-hub", hubModule.slot)') &&
    compositionLoader.includes("slots[hubModule.slot].push") &&
    !compositionLoader.includes("if (!isMediaCenterPage)"),
  "Specialized Media truth must enter the canonical persisted Position path",
);
assert.ok(!mediaHubConsumer.includes("MediaSidebar") && !mediaListingConsumer.includes("sidebarModules=") && !mediaDetailConsumer.includes("sidebarModules="), "Media consumers must not render the specialized Sidebar in parallel");
assert.ok(mediaHubConsumer.includes("renderMediaHubSection") && !mediaHubConsumer.includes("loadMediaHubModules"), "Media Hub Module presentation must expose Nodes without a parallel loader");
assert.ok(venisiaMediaHubLayout.includes("renderVenesiaThemeMediaHubNodes") && !venisiaMediaHubLayout.includes("renderMediaHubSection"), "Venisia Theme must group opaque Media Hub Nodes without rendering Module content");
assert.ok(mediaShell.includes("composition: PageComposition") && !mediaShell.includes("loadPageCompositionBySlug") && mediaShell.includes("<PageSlotLayout"), "Media shell must consume one passed composition through the shared renderer without a static hero fallback");

assert.ok(cacheOwner.includes('"media-center", "media-sidebar"') && cacheOwner.includes('revalidateTag(tag, "max")'), "Page Composition cache owner must cover specialized Media tags with current Next semantics");
for (const check of ["footer_single_source", "home_composition_assignment_count", "media_hub_composition_assignment_count", "media_sidebar_composition_assignment_count", "public_composition_reference_integrity", "footer_public_composition_audit_evidence"]) {
  assert.ok(diagnostics.includes(check), `Diagnostics is missing ${check}`);
}
for (const proof of ["footer.legacy_brand_removed", "public_composition.code_fallback_retired", "save_footer_settings", "footer_single_source", "public_composition_unresolved_reference_count"]) {
  assert.ok(migration.includes(proof), `Migration proof is missing ${proof}`);
}
assert.ok(migration.includes("brand_value <> canonical_brand") && migration.includes("raise exception"), "Migration must fail closed before removing footer.brand");
assert.ok(migration.includes("revoke all on function public.save_footer_settings") && migration.includes("grant execute on function public.save_footer_settings") && migration.includes("to service_role"), "Atomic Footer writer must remain service-role only");

console.log("PASS Footer/Public Composition Truth: canonical Footer persistence, CMS-only Home, one Page Composition resolver, specialized Media adoption, fail-safe outage behavior, diagnostics, cache and guards.");

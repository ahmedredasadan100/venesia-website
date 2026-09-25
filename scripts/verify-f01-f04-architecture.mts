import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { resolveLayoutRegionAdminLabel } from "../src/lib/page-blocks/layout-slots.ts";
import { resolveVenesiaThemeLayout } from "../src/components/page-composition/venisia-theme-regions.ts";

const regions = [
  { key: "hero", adminLabel: "الهيرو", sortOrder: 10 },
  { key: "main", adminLabel: "المحتوى الرئيسي", sortOrder: 20 },
  { key: "sidebar", adminLabel: "الشريط الجانبي", sortOrder: 30 },
];

assert.deepEqual(resolveVenesiaThemeLayout({
  layoutKey: "venisia-legacy",
  regions,
  hasSidebarContent: true,
}), {
  topology: "main-sidebar",
  regionOrder: ["hero", "main", "sidebar", "bottom", "footer"],
});
assert.equal(resolveVenesiaThemeLayout({
  layoutKey: "venisia-legacy",
  regions,
  hasSidebarContent: false,
}).topology, "region-stack", "Legacy pages without sidebar content retain the current stack path.");
assert.deepEqual(resolveVenesiaThemeLayout({
  layoutKey: "brand-layout-example",
  regions: [
    { key: "lead", adminLabel: "المقدمة", sortOrder: 10 },
    { key: "details", adminLabel: "التفاصيل", sortOrder: 20 },
  ],
  hasSidebarContent: true,
}), {
  topology: "region-stack",
  regionOrder: ["lead", "details"],
}, "A novel Layout uses its stored Region order without a renderer branch.");

assert.equal(resolveLayoutRegionAdminLabel("north-gallery", "المعرض الشمالي"), "المعرض الشمالي");
assert.equal(resolveLayoutRegionAdminLabel("main", null), "المحتوى الرئيسي");
assert.equal(resolveLayoutRegionAdminLabel("north-gallery", null), "المنطقة: north-gallery");

const read = (path: string) => readFileSync(path, "utf8");
const layout = read("src/components/page-composition/PageSlotLayout.tsx");
const sharedPlan = read("src/components/page-composition/build-slot-render-plan.ts");
const themeNodes = read("src/components/page-composition/slot-module-nodes.tsx");
const presentationContract = read("src/components/page-composition/slot-module-presentation-contract.ts");
const assignmentRead = read("src/lib/page-blocks/module-assignments-query.ts");
const usageBanner = read("src/components/admin/page-blocks/ModuleCrossPageUsageBanner.tsx");

assert.ok(layout.includes("VENISIA_THEME_CONTRACT.resolveLayout"));
assert.ok(layout.includes("VENISIA_THEME_CONTRACT.modulePresentation"));
assert.ok(sharedPlan.includes("presentation.buildNodes({"));
assert.ok(!presentationContract.includes('from "./slot-module-nodes"'),
  "The shared Theme contract must not depend on the Venisia implementation.");
for (const brandedSlug of ["home-story", "about-approach", "contact-form", "topics-intro"]) {
  assert.ok(!sharedPlan.includes(brandedSlug), `Shared render plan leaked branded template ${brandedSlug}.`);
  assert.ok(themeNodes.includes(brandedSlug), `Venisia Theme lost template ${brandedSlug}.`);
}
assert.ok(assignmentRead.includes("page_composition_regions(key,admin_label)"));
assert.ok(assignmentRead.includes("region_admin_label: storedRegionAdminLabel"));
assert.ok(usageBanner.includes("resolveLayoutRegionAdminLabel(row.slot, row.region_admin_label)"));

console.log("PASS F01 Theme Layout contract, F02 branded presentation seam, and F04 stored Region labels/fallbacks");

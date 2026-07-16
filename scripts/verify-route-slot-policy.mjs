/**
 * Verify route slot policy is the shared source for Admin UI + server assignment actions.
 * Pure Node — mirrors policy rules from route-slot-policy.ts without TS runtime imports.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const failures = [];

function read(relPath) {
  const full = resolve(root, relPath);
  if (!existsSync(full)) {
    failures.push(`Missing file: ${relPath}`);
    return "";
  }
  return readFileSync(full, "utf8");
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const policySrc = read("src/lib/page-composition/route-slot-policy.ts");
const utilsSrc = read("src/app/admin/pages-blocks/pages/[id]/page-blocks/page-blocks-utils.ts");
const modalSrc = read("src/app/admin/pages-blocks/pages/[id]/page-blocks/use-page-blocks-assign-modal.ts");
const createSrc = read("src/app/admin/pages-blocks/pages/page-actions/assignment-create.ts");
const updateSrc = read("src/app/admin/pages-blocks/pages/page-actions/assignment-update.ts");
const helpersSrc = read("src/app/admin/pages-blocks/pages/page-actions/helpers.ts");

assert(policySrc.includes("export function getAssignableSlotsForRoute"), "policy export missing");
assert(policySrc.includes('slug === "home"') && policySrc.includes('return ["main"]'), "home main-only rule missing");
assert(policySrc.includes('slug === "projects"'), "projects main-only rule missing");
assert(policySrc.includes("slot !== \"hero\"") || policySrc.includes('slot !== "hero"') || policySrc.includes('return ["main", "sidebar", "bottom", "footer"]'), "about/contact freeform without hero missing");
assert(utilsSrc.includes("getAssignableSlotsForRoute"), "Admin getSlotOptions must delegate to policy");
assert(modalSrc.includes("getSlotOptions(assignModuleKind, pageSlug)"), "Assign modal must pass pageSlug");
assert(createSrc.includes("slotPolicyFailure"), "assignPageBlock must enforce slot policy");
assert(updateSrc.includes("slotPolicyFailure"), "updatePageBlockAssignment must enforce slot policy");
assert(helpersSrc.includes("isSlotAllowedForRoute"), "helpers must use shared policy");
assert(helpersSrc.includes("getUnsupportedSlotAssignmentMessage"), "helpers must use shared Arabic rejection message");

// Mirror of route-slot-policy.ts for behavioural asserts (must stay in sync with source markers above).
const PAGE_LAYOUT_SLOTS = ["hero", "main", "sidebar", "bottom", "footer"];
const FREEFORM = new Set(["content", "cta", "cards"]);

function normalize(slot) {
  const value = String(slot ?? "main").trim().toLowerCase();
  const legacy = { top: "hero", "before-footer": "bottom", "after-content": "bottom" };
  return legacy[value] ?? (PAGE_LAYOUT_SLOTS.includes(value) ? value : "main");
}

function kindBase(kind) {
  const k = kind.trim().toLowerCase();
  if (k === "hero" || k === "breadcrumb") return ["hero"];
  if (k === "feed" || k === "media-sidebar") return ["sidebar"];
  if (k === "media-hub") return ["main"];
  return [...PAGE_LAYOUT_SLOTS];
}

function freeform(slug) {
  if (slug === "home" || slug === "projects") return ["main"];
  if (slug === "topics") return ["main", "sidebar", "bottom", "footer"];
  if (slug === "media-center") return ["main", "bottom", "footer"];
  if (slug.startsWith("media-center-")) return ["main", "bottom"];
  return ["main", "sidebar", "bottom", "footer"];
}

function slots(pageSlug, moduleKind) {
  const slug = String(pageSlug ?? "").trim().toLowerCase();
  const kind = moduleKind.trim().toLowerCase();
  const base = kindBase(kind);
  if (kind === "hero" || kind === "breadcrumb" || kind === "media-hub" || kind === "media-sidebar") return base;
  if (kind === "feed") {
    if (slug === "home" || slug.startsWith("media-center-")) return [];
    return base;
  }
  if (FREEFORM.has(kind)) {
    const allowed = new Set(freeform(slug));
    return base.filter((s) => allowed.has(s));
  }
  return base;
}

function allowed(pageSlug, moduleKind, slot) {
  return slots(pageSlug, moduleKind).includes(normalize(slot));
}

assert(JSON.stringify(slots("home", "content")) === JSON.stringify(["main"]), "home content => main only");
assert(!allowed("home", "content", "sidebar"), "home rejects content sidebar");
assert(!allowed("home", "feed", "sidebar"), "home rejects feed");
assert(JSON.stringify(slots("projects", "content")) === JSON.stringify(["main"]), "projects content => main only");
assert(!allowed("topics", "content", "hero"), "topics rejects content in hero");
assert(allowed("topics", "feed", "sidebar"), "topics allows feed sidebar");
assert(!allowed("media-center-news", "content", "sidebar"), "media listing rejects sidebar");
assert(!allowed("media-center-news", "content", "footer"), "media listing rejects footer");
assert(allowed("media-center-news", "content", "main"), "media listing allows main");
assert(!allowed("about", "content", "hero"), "about rejects content hero");
assert(allowed("about", "content", "sidebar"), "about allows content sidebar");
assert(allowed("about", "breadcrumb", "hero"), "about allows breadcrumb hero");

const currentAssignments = [
  ["home", "content", "main"],
  ["about", "content", "main"],
  ["about", "content", "bottom"],
  ["about", "breadcrumb", "hero"],
  ["contact", "content", "main"],
  ["contact", "cards", "main"],
  ["contact", "cta", "bottom"],
  ["contact", "breadcrumb", "hero"],
  ["topics", "content", "main"],
  ["topics", "feed", "sidebar"],
  ["topics", "cta", "sidebar"],
  ["topics", "breadcrumb", "hero"],
  ["projects", "content", "main"],
  ["media-center", "content", "main"],
  ["media-center", "breadcrumb", "hero"],
  ["media-center-news", "content", "main"],
  ["media-center-news", "breadcrumb", "hero"],
];

for (const [slug, kind, slot] of currentAssignments) {
  assert(allowed(slug, kind, slot), `existing assignment must remain valid: ${slug}/${kind}/${slot}`);
}

if (failures.length) {
  console.error("verify-route-slot-policy FAILED:");
  for (const item of failures) console.error(` - ${item}`);
  process.exit(1);
}

console.log("verify-route-slot-policy OK");

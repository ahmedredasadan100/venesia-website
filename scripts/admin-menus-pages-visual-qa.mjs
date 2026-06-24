/**
 * Visual/layout QA: compare /admin/pages-blocks/menus vs /admin/pages-blocks/pages.
 * Usage: node scripts/admin-menus-pages-visual-qa.mjs [port]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const port = process.argv[2] || "3021";
const baseUrl = `http://127.0.0.1:${port}`;
const shotsDir = resolve(dirname(fileURLToPath(import.meta.url)), "screenshots", "admin-menus-pages-qa");
mkdirSync(shotsDir, { recursive: true });

const routes = {
  pages: "/admin/pages-blocks/pages",
  menus: "/admin/pages-blocks/menus",
};

const issues = [];
const passes = [];

function pass(label, detail = "") {
  passes.push({ label, detail });
  console.log(`PASS  ${label}${detail ? `: ${detail}` : ""}`);
}

function fail(label, detail = "") {
  issues.push({ label, detail });
  console.log(`FAIL  ${label}${detail ? `: ${detail}` : ""}`);
}

function approx(a, b, tolerance = 2) {
  return Math.abs(a - b) <= tolerance;
}

async function measurePage(page, routeKey, path) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const header = page.locator("section.rounded-\\[34px\\]").first();
  const grid = page.locator('section[class*="shadow-[0_24px_80px"]').first();
  const headerBox = await header.boundingBox();
  const gridBox = await grid.boundingBox();

  const actionsHeader = page.getByText("الإجراءات", { exact: true }).first();
  const actionsHeaderBox = await actionsHeader.boundingBox();

  const gridColumns = await page
    .locator("div[style*='grid-template-columns']")
    .first()
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns);

  const actionsCell = page.locator('[dir="rtl"].flex.min-w-max.flex-nowrap.items-center.justify-center').first();
  const actionsCellBox = await actionsCell.boundingBox();

  const headerActions = header.locator(".flex.shrink-0");
  const addButton = headerActions.locator("button").first();
  const addButtonBox = await addButton.boundingBox().catch(() => null);

  const gridStyle = await grid.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      marginLeft: style.marginLeft,
      marginRight: style.marginRight,
      paddingLeft: style.paddingLeft,
      paddingRight: style.paddingRight,
    };
  });

  await page.screenshot({
    path: resolve(shotsDir, `${routeKey}-list.png`),
    fullPage: false,
  });

  return {
    routeKey,
    path,
    headerBox,
    gridBox,
    actionsHeaderBox,
    actionsCellBox,
    gridColumns,
    addButtonBox,
    gridStyle,
    hasAddButton: addButtonBox !== null,
  };
}

async function measureMenusModal(page) {
  await page.goto(`${baseUrl}${routes.menus}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const addButton = page.getByRole("button", { name: "إضافة منيو" });
  await addButton.click();
  await page.locator('[role="dialog"]').waitFor({ state: "visible", timeout: 8000 });

  const modal = page.locator('[role="dialog"]').first();
  const modalVisible = await modal.isVisible();
  const modalBox = modalVisible ? await modal.boundingBox() : null;
  const panelClasses = modalVisible ? await modal.getAttribute("class") : null;

  await page.screenshot({
    path: resolve(shotsDir, "menus-add-modal.png"),
    fullPage: false,
  });

  return { modalVisible, modalBox, panelClasses };
}

async function auditSliderHidden(page) {
  await page.goto(`${baseUrl}/admin/pages-blocks/blocks`, { waitUntil: "networkidle" });
  const deprecatedSection = page.locator("section").filter({ hasText: "موديولات Deprecated" });
  const sliderInDeprecated = deprecatedSection.getByText("السلايدر");
  const sliderInMainGrid = page
    .locator("section.grid")
    .first()
    .getByText("السلايدر");

  const deprecatedCount = await sliderInDeprecated.count();
  const mainCount = await sliderInMainGrid.count();

  await page.goto(`${baseUrl}/admin/pages-blocks/pages/1`, { waitUntil: "networkidle" }).catch(() => null);
  const assignSelect = page.locator('select').filter({ has: page.locator('option[value="hero"]') }).first();
  let assignOptions = [];
  if (await assignSelect.count()) {
    assignOptions = await assignSelect.locator("option").allTextContents();
  }

  const hasSliderOption = assignOptions.some((text) => /slider|سلايد/i.test(text));

  return { deprecatedCount, mainCount, hasSliderOption, assignOptions };
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

let pagesMetrics;
let menusMetrics;

try {
  pagesMetrics = await measurePage(page, "pages", routes.pages);
  menusMetrics = await measurePage(page, "menus", routes.menus);
} catch (error) {
  fail("Page load", error.message);
  await browser.close();
  process.exit(1);
}

if (pagesMetrics.headerBox && menusMetrics.headerBox) {
  if (approx(pagesMetrics.headerBox.x, menusMetrics.headerBox.x)) {
    pass("Header horizontal alignment", `x=${Math.round(pagesMetrics.headerBox.x)}px`);
  } else {
    fail(
      "Header horizontal alignment",
      `pages x=${Math.round(pagesMetrics.headerBox.x)} vs menus x=${Math.round(menusMetrics.headerBox.x)}`,
    );
  }

  if (approx(pagesMetrics.headerBox.width, menusMetrics.headerBox.width, 4)) {
    pass("Header width", `${Math.round(pagesMetrics.headerBox.width)}px`);
  } else {
    fail(
      "Header width",
      `pages=${Math.round(pagesMetrics.headerBox.width)} menus=${Math.round(menusMetrics.headerBox.width)}`,
    );
  }
} else {
  fail("Header boxes", "Could not measure one or both headers");
}

if (pagesMetrics.gridBox && menusMetrics.gridBox) {
  if (approx(pagesMetrics.gridBox.x, menusMetrics.gridBox.x)) {
    pass("Grid horizontal alignment", `x=${Math.round(pagesMetrics.gridBox.x)}px`);
  } else {
    fail(
      "Grid horizontal alignment",
      `pages x=${Math.round(pagesMetrics.gridBox.x)} vs menus x=${Math.round(menusMetrics.gridBox.x)}`,
    );
  }

  if (approx(pagesMetrics.gridBox.width, menusMetrics.gridBox.width, 4)) {
    pass("Grid width", `${Math.round(pagesMetrics.gridBox.width)}px`);
  } else {
    fail("Grid width", `pages=${Math.round(pagesMetrics.gridBox.width)} menus=${Math.round(menusMetrics.gridBox.width)}`);
  }
} else {
  fail("Grid boxes", "Could not measure one or both grids");
}

for (const metrics of [pagesMetrics, menusMetrics]) {
  const lastColumn = metrics.gridColumns?.split(" ").pop() ?? "";
  if (lastColumn.includes("220px")) {
    pass(`${metrics.routeKey} actions column template`, lastColumn);
  } else {
    fail(`${metrics.routeKey} actions column template`, `${lastColumn || metrics.gridColumns} (expected 220px)`);
  }

  if (metrics.actionsCellBox) {
    pass(`${metrics.routeKey} actions cell centered cluster`, `${Math.round(metrics.actionsCellBox.width)}px wide`);
  } else {
    fail(`${metrics.routeKey} actions cell`, "not found");
  }
}

if (menusMetrics.hasAddButton) {
  pass("Menus add button present in header");
} else {
  fail("Menus add button", "not found in header actions area");
}

if (menusMetrics.addButtonBox && menusMetrics.headerBox) {
  const insideHeader =
    menusMetrics.addButtonBox.x >= menusMetrics.headerBox.x - 8 &&
    menusMetrics.addButtonBox.y >= menusMetrics.headerBox.y - 8 &&
    menusMetrics.addButtonBox.x + menusMetrics.addButtonBox.width <=
      menusMetrics.headerBox.x + menusMetrics.headerBox.width + 8 &&
    menusMetrics.addButtonBox.y + menusMetrics.addButtonBox.height <=
      menusMetrics.headerBox.y + menusMetrics.headerBox.height + 8;

  if (insideHeader) {
    pass("Menus add button placement", "inside header actions cluster (matches Pages meta/actions row)");
  } else {
    fail("Menus add button placement", "button outside header bounds");
  }
}

const modalMetrics = await measureMenusModal(page);
if (modalMetrics.modalVisible) {
  pass("Menus add modal opens");
  if (modalMetrics.panelClasses?.includes("rounded-[26px]")) {
    pass("Menus modal uses VenesiaModal panel styling");
  } else {
    fail("Menus modal styling", "expected rounded-[26px] VenesiaModal panel");
  }
} else {
  fail("Menus add modal", "dialog not visible after click");
}

const sliderAudit = await auditSliderHidden(page);
if (sliderAudit.mainCount === 0) pass("Slider not in main Blocks grid");
else fail("Slider in main Blocks grid", `found ${sliderAudit.mainCount}`);

if (sliderAudit.deprecatedCount > 0) pass("Slider shown only in Deprecated section");
else fail("Slider Deprecated section", "not found");

if (!sliderAudit.hasSliderOption) pass("Slider not in page assignment picker");
else fail("Slider in assignment picker", sliderAudit.assignOptions.join(", "));

console.log("\n--- Summary ---");
console.log(`Passes: ${passes.length}`);
console.log(`Issues: ${issues.length}`);
console.log(`Screenshots: ${shotsDir}`);

await browser.close();
process.exit(issues.length ? 1 : 0);

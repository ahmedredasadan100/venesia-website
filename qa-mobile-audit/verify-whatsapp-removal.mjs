import { chromium } from "playwright";

const BASE = process.env.QA_BASE_URL || "http://localhost:3000";
const VIEWPORTS = [320, 360, 375, 390, 412, 430, 768, 1280];

async function check(page, vp) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const headerWa = page.locator('header a[href*="wa.me"]');
  const headerWaCount = await headerWa.count();

  let drawerWaCount = 0;
  let menuWorks = false;
  const menuBtn = page.locator('button[aria-label="فتح القائمة"]').first();
  if (vp < 1024 && (await menuBtn.isVisible().catch(() => false))) {
    await menuBtn.click({ force: true });
    await page.waitForTimeout(400);
    drawerWaCount = await page.locator('aside a[href*="wa.me"]').count();
    menuWorks = await page.locator('[aria-label="القائمة الرئيسية"]').isVisible();
    const linkCount = await page.locator('[aria-label="القائمة الرئيسية"] a, [aria-label="القائمة الرئيسية"] button').count();
    menuWorks = menuWorks && linkCount > 0;
    await page.locator('button[aria-label="إغلاق القائمة"]').click().catch(() => {});
  }

  const metrics = await page.evaluate(() => {
    const cw = document.documentElement.clientWidth;
    const sw = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
    const btn = document.querySelector('button[aria-label="فتح القائمة"], button[aria-label="إغلاق القائمة"]');
    const b = btn?.getBoundingClientRect();
    const nav = document.querySelector("header nav");
    return {
      overflow: sw - cw,
      menu: b && getComputedStyle(btn).display !== "none" ? { left: Math.round(b.left), right: Math.round(b.right), ok: b.left >= 0 && b.right <= cw } : null,
      desktopNav: nav ? getComputedStyle(nav).display !== "none" : false,
    };
  });

  return { vp, headerWaCount, drawerWaCount, menuWorks, ...metrics };
}

const browser = await chromium.launch();
const results = [];

for (const vp of VIEWPORTS) {
  const page = await (await browser.newContext({ viewport: { width: vp, height: 844 }, locale: "ar-EG" })).newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
  if (await page.evaluate(() => document.body.textContent?.includes("الموقع قيد الصيانة") ?? false)) {
    results.push({ vp, maintenance: true });
  } else {
    results.push(await check(page, vp));
  }
  await page.context().close();
}

await browser.close();

const ok = results.every(
  (r) =>
    !r.maintenance &&
    r.headerWaCount === 0 &&
    r.drawerWaCount === 0 &&
    r.overflow <= 1 &&
    (r.vp >= 1024 ? r.desktopNav : r.menu?.ok && r.menuWorks)
);

console.log(JSON.stringify({ ok, results }, null, 2));
process.exit(ok ? 0 : 1);

import { chromium } from "playwright";

const BASE = process.env.QA_BASE_URL || "http://localhost:3000";
const VIEWPORTS = [320, 360, 375, 390, 412, 430, 768, 1280];
const MOBILE = [320, 360, 375, 390, 412, 430, 768];

async function check(page, vp, label) {
  const wa = page.locator('header a[href*="wa.me"]');
  const waVisible = await wa.isVisible().catch(() => false);
  const menuBtn = page.locator('button[aria-label="فتح القائمة"], button[aria-label="إغلاق القائمة"]').first();
  const metrics = await page.evaluate(() => {
    const cw = document.documentElement.clientWidth;
    const sw = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
    const btn = document.querySelector('button[aria-label="فتح القائمة"], button[aria-label="إغلاق القائمة"]');
    const b = btn?.getBoundingClientRect();
    const waEl = document.querySelector('header a[href*="wa.me"]');
    const waR = waEl?.getBoundingClientRect();
    const waShown = waEl ? getComputedStyle(waEl).display !== "none" && waR && waR.width > 0 && waR.height > 0 : false;
    return {
      overflow: sw - cw,
      menu: b ? { left: Math.round(b.left), right: Math.round(b.right), w: Math.round(b.width), ok: b.left >= 0 && b.right <= cw } : null,
      waHeaderVisible: waShown,
      desktopNav: (() => { const n = document.querySelector("header nav"); return n ? getComputedStyle(n).display !== "none" : false; })(),
    };
  });

  let menuWorks = null;
  if (vp < 1024 && metrics.menu?.ok) {
    await page.evaluate(() => document.querySelector('button[aria-label="فتح القائمة"]')?.click());
    await page.waitForTimeout(400);
    menuWorks = await page.locator('[aria-label="القائمة الرئيسية"]').isVisible();
    await page.evaluate(() => document.querySelector('button[aria-label="إغلاق القائمة"]')?.click());
  }

  return { vp, label, waVisible, ...metrics, menuWorks };
}

const browser = await chromium.launch();
const results = [];

for (const vp of VIEWPORTS) {
  const page = await (await browser.newContext({ viewport: { width: vp, height: 844 }, locale: "ar-EG" })).newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
  const maintenance = await page.evaluate(() => document.body.textContent?.includes("الموقع قيد الصيانة") ?? false);
  if (maintenance) {
    results.push({ vp, maintenance: true });
    await page.context().close();
    continue;
  }
  results.push(await check(page, vp, "home"));
  await page.context().close();
}

await browser.close();

const mobile = results.filter((r) => MOBILE.includes(r.vp));
const desktop = results.find((r) => r.vp === 1280);
const pass = mobile.every((r) => !r.waHeaderVisible && r.menu?.ok && r.overflow <= 1 && r.menuWorks === true);
const desktopOk = desktop && desktop.waHeaderVisible && desktop.desktopNav;

console.log(JSON.stringify({ pass, desktopOk, results }, null, 2));
process.exit(pass && desktopOk ? 0 : 1);

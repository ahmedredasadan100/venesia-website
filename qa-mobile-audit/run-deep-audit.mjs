import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "output-deep");
const BASE = "http://localhost:3000";

const KEY_PAGES = [
  "/",
  "/about",
  "/contact",
  "/projects",
  "/projects/venesia-new-cairo-mall",
  "/topics",
  "/topics/what-is-new-cairo",
  "/media-center",
  "/media-center/news",
  "/media-center/gallery",
  "/track-your-project",
];

const VIEWPORTS = [320, 360, 375, 390, 412, 430, 768];
const issues = [];

async function analyze(page, urlPath, vp) {
  const dir = path.join(OUT, "screenshots", `${vp}w`, urlPath.replace(/\//g, "_") || "home");
  fs.mkdirSync(dir, { recursive: true });

  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const sw = Math.max(doc.scrollWidth, document.body?.scrollWidth ?? 0);
    const cw = doc.clientWidth;
    const offenders = [];
    for (const el of document.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      if (r.right > cw + 1 || r.left < -1) {
        offenders.push({
          tag: el.tagName,
          cls: String(el.className).slice(0, 70),
          right: Math.round(r.right),
          left: Math.round(r.left),
          w: Math.round(r.width),
        });
      }
    }
    const smallTouch = [];
    for (const el of document.querySelectorAll("button, a, input, select, textarea, [role=button]")) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0 || r.bottom < 0 || r.top > innerHeight) continue;
      if (r.width < 44 || r.height < 44) {
        smallTouch.push({
          tag: el.tagName,
          w: Math.round(r.width),
          h: Math.round(r.height),
          label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 50),
        });
      }
    }
    const textClip = [];
    for (const el of document.querySelectorAll("h1,h2,h3,h4,p,span,li,a")) {
      const r = el.getBoundingClientRect();
      if (r.width < 20 || r.top > innerHeight * 3) continue;
      if (el.scrollWidth > el.clientWidth + 3) {
        textClip.push({
          tag: el.tagName,
          text: (el.textContent || "").trim().slice(0, 60),
          sw: el.scrollWidth,
          cw: el.clientWidth,
        });
      }
    }
    const brokenImgs = [...document.querySelectorAll("img")]
      .filter((i) => i.complete && i.naturalWidth === 0)
      .map((i) => i.src.slice(-80));
    const cls = performance
      .getEntriesByType("layout-shift")
      .reduce((s, e) => (e.hadRecentInput ? s : s + e.value), 0);
    const menuBtn = document.querySelector('button[aria-label="فتح القائمة"]');
    const menuBtnSize = menuBtn ? menuBtn.getBoundingClientRect() : null;
    return {
      overflow: sw - cw,
      sw,
      cw,
      offenders: offenders.slice(0, 20),
      smallTouch: smallTouch.slice(0, 15),
      textClip: textClip.slice(0, 10),
      brokenImgs,
      cls: Math.round(cls * 1000) / 1000,
      menuBtnSize: menuBtnSize
        ? { w: Math.round(menuBtnSize.width), h: Math.round(menuBtnSize.height) }
        : null,
      dir: document.documentElement.getAttribute("dir"),
    };
  });

  await page.screenshot({ path: path.join(dir, "full.png"), fullPage: true });

  const btn = page.locator('button[aria-label="فتح القائمة"]').first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(dir, "menu-open.png"), fullPage: false });
    await btn.click().catch(() => {});
  }

  if (metrics.overflow > 0) {
    issues.push({
      sev: metrics.overflow > 15 ? "high" : "medium",
      cat: "overflow",
      page: urlPath,
      vp,
      title: `Overflow ${metrics.overflow}px`,
      detail: metrics.offenders.slice(0, 5),
      shot: path.join(dir, "full.png"),
    });
  }
  if (metrics.cls > 0.08) {
    issues.push({
      sev: metrics.cls > 0.2 ? "high" : "medium",
      cat: "cls",
      page: urlPath,
      vp,
      title: `CLS ${metrics.cls}`,
      shot: path.join(dir, "full.png"),
    });
  }
  if (metrics.smallTouch.length > 3) {
    issues.push({
      sev: "medium",
      cat: "touch-target",
      page: urlPath,
      vp,
      title: `${metrics.smallTouch.length} عناصر لمس أصغر من 44px`,
      detail: metrics.smallTouch.slice(0, 6),
      shot: path.join(dir, "full.png"),
    });
  }
  if (metrics.textClip.length > 2) {
    issues.push({
      sev: "medium",
      cat: "text-clip",
      page: urlPath,
      vp,
      title: "نص مقطوع/مخفي أفقيًا",
      detail: metrics.textClip.slice(0, 4),
      shot: path.join(dir, "full.png"),
    });
  }
  if (metrics.brokenImgs.length) {
    issues.push({
      sev: "high",
      cat: "image",
      page: urlPath,
      vp,
      title: "صور لا تُحمّل",
      detail: metrics.brokenImgs,
      shot: path.join(dir, "full.png"),
    });
  }
  if (metrics.menuBtnSize && (metrics.menuBtnSize.w < 44 || metrics.menuBtnSize.h < 44)) {
    issues.push({
      sev: "medium",
      cat: "touch-target",
      page: urlPath,
      vp,
      title: `زر القائمة ${metrics.menuBtnSize.w}×${metrics.menuBtnSize.h}px`,
      shot: path.join(dir, "menu-open.png"),
    });
  }

  return metrics;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const consoleAll = [];
  const networkAll = [];

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp, height: 844 },
      locale: "ar-EG",
      deviceScaleFactor: 2,
    });
    for (const urlPath of KEY_PAGES) {
      const page = await ctx.newPage();
      page.on("console", (m) => {
        if (m.type() === "error") consoleAll.push({ vp, urlPath, text: m.text().slice(0, 200) });
      });
      page.on("response", (r) => {
        if (r.status() >= 400 && !r.url().includes("_next") && !r.url().includes("favicon")) {
          networkAll.push({ vp, urlPath, status: r.status(), url: r.url().slice(0, 150) });
        }
      });
      await page.goto(BASE + urlPath, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(2000);
      await analyze(page, urlPath, vp);
      await page.close();
      process.stdout.write(`${vp} ${urlPath} ok\n`);
    }
    await ctx.close();
  }

  await browser.close();

  const report = {
    issues,
    consoleAll: [...new Map(consoleAll.map((x) => [x.text, x])).values()],
    networkAll: [...new Map(networkAll.map((x) => [x.url + x.status, x])).values()],
  };
  fs.writeFileSync(path.join(OUT, "deep-report.json"), JSON.stringify(report, null, 2));
  console.log(`Deep audit: ${issues.length} issues`);
}

main();

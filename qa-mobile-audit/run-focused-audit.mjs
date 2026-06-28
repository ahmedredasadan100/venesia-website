import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "output-focused");
const BASE = "http://localhost:3000";
const VIEWPORTS = [320, 360, 375, 390, 412, 430, 768];
const PAGES = [
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
  "/media-center/videos",
  "/track-your-project",
];
const issues = [];

function add(i) {
  issues.push(i);
}

async function metrics(page) {
  return page.evaluate(() => {
    const cw = document.documentElement.clientWidth;
    const sw = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
    const hero = document.querySelector("section");
    const heroRect = hero?.getBoundingClientRect();
    const contactSection = [...document.querySelectorAll("section,h2")].find((el) =>
      (el.textContent || "").includes("تواصل")
    );
    const contactRect = contactSection?.getBoundingClientRect();
    const menuBtn = document.querySelector('button[aria-label="فتح القائمة"]');
    const mb = menuBtn?.getBoundingClientRect();
    const imgs = [...document.querySelectorAll("img")].map((img) => {
      const r = img.getBoundingClientRect();
      const cs = getComputedStyle(img);
      return {
        src: img.src.slice(-70),
        nw: img.naturalWidth,
        nh: img.naturalHeight,
        w: Math.round(r.width),
        h: Math.round(r.height),
        fit: cs.objectFit,
        broken: img.complete && img.naturalWidth === 0,
        overflow: r.right > cw + 2,
      };
    }).filter((x) => x.w > 40);
    const ltrInputs = [...document.querySelectorAll("input,textarea")].filter((el) => getComputedStyle(el).textAlign === "left").map((el) => el.getAttribute("name") || el.id);
    const cls = performance.getEntriesByType("layout-shift").reduce((s, e) => (e.hadRecentInput ? s : s + e.value), 0);
    const revealHidden = [...document.querySelectorAll("[data-reveal]")].filter((el) => {
      const cs = getComputedStyle(el);
      return cs.opacity === "0" || cs.visibility === "hidden" || cs.transform.includes("translateY");
    }).length;
    return {
      overflow: sw - cw,
      heroH: heroRect ? Math.round(heroRect.height) : 0,
      vh: innerHeight,
      menuBtn: mb ? { w: Math.round(mb.width), h: Math.round(mb.height) } : null,
      imgs: imgs.slice(0, 8),
      ltrInputs,
      cls: Math.round(cls * 1000) / 1000,
      revealHidden,
      dir: document.documentElement.getAttribute("dir"),
    };
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp, height: 844 }, locale: "ar-EG", deviceScaleFactor: 2 });
    for (const p of PAGES) {
      const page = await ctx.newPage();
      const logs = [];
      const nets = [];
      page.on("console", (m) => { if (m.type() === "error") logs.push(m.text()); });
      page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("_next")) nets.push(`${r.status()} ${r.url().slice(0, 120)}`); });
      await page.goto(BASE + p, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(2500);
      const dir = path.join(OUT, `${vp}w`, p.replace(/\//g, "_") || "home");
      fs.mkdirSync(dir, { recursive: true });
      const m1 = await metrics(page);
      await page.screenshot({ path: path.join(dir, "initial.png"), fullPage: true });
      if (m1.overflow > 0) add({ sev: "medium", cat: "overflow", p, vp, detail: `${m1.overflow}px`, shot: path.join(dir, "initial.png") });
      if (m1.cls > 0.08) add({ sev: "medium", cat: "cls", p, vp, detail: `CLS ${m1.cls}`, shot: path.join(dir, "initial.png") });
      if (m1.menuBtn && (m1.menuBtn.w < 44 || m1.menuBtn.h < 44)) add({ sev: "medium", cat: "touch", p, vp, detail: `menu ${m1.menuBtn.w}x${m1.menuBtn.h}`, shot: path.join(dir, "initial.png") });
      if (m1.heroH > m1.vh * 1.15 && p === "/") add({ sev: "low", cat: "hero", p, vp, detail: `hero ${m1.heroH}px vs vh ${m1.vh}`, shot: path.join(dir, "initial.png") });
      if (m1.revealHidden > 5) add({ sev: "medium", cat: "animation", p, vp, detail: `${m1.revealHidden} عناصر data-reveal مخفية`, shot: path.join(dir, "initial.png") });
      const badImgs = m1.imgs.filter((i) => i.broken || i.overflow);
      if (badImgs.length) add({ sev: "high", cat: "image", p, vp, detail: JSON.stringify(badImgs.slice(0, 3)), shot: path.join(dir, "initial.png") });

      const btn = page.locator('button[aria-label="فتح القائمة"]').first();
      if (await btn.isVisible()) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(200);
        await btn.click({ force: true });
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(dir, "menu.png"), fullPage: false });
        const links = page.locator('[aria-label="القائمة الرئيسية"] a');
        const lc = await links.count();
        for (let i = 0; i < Math.min(lc, 3); i++) {
          await links.nth(i).click({ timeout: 2000 }).catch(() => {});
          await page.waitForTimeout(400);
        }
        await page.goto(BASE + p, { waitUntil: "networkidle" });
      }

      if (p === "/projects" || p === "/topics" || p.includes("news")) {
        const next = page.locator('a:has-text("التالي"), button:has-text("التالي"), nav a').last();
        if (await next.isVisible().catch(() => false)) {
          await next.click({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(800);
          await page.screenshot({ path: path.join(dir, "pagination.png"), fullPage: false });
        }
      }

      if (p === "/contact" || p === "/track-your-project") {
        const form = page.locator("form").first();
        if (await form.count()) {
          await form.locator("input, textarea, select").first().fill("اختبار").catch(() => {});
          await page.screenshot({ path: path.join(dir, "form.png"), fullPage: false });
        }
      }

      await page.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) {
          scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 80));
        }
      });
      await page.waitForTimeout(500);
      const m2 = await metrics(page);
      await page.screenshot({ path: path.join(dir, "scrolled.png"), fullPage: true });
      if (m2.overflow > m1.overflow + 2) add({ sev: "medium", cat: "overflow-scroll", p, vp, detail: `${m2.overflow}px after scroll`, shot: path.join(dir, "scrolled.png") });

      if (logs.length) add({ sev: "high", cat: "console", p, vp, detail: [...new Set(logs)].slice(0, 3).join(" | "), shot: path.join(dir, "scrolled.png") });
      if (nets.length) add({ sev: "high", cat: "network", p, vp, detail: nets.slice(0, 3).join(" | "), shot: path.join(dir, "scrolled.png") });

      await page.close();
      process.stdout.write(`${vp} ${p} `);
    }
    await ctx.close();
    console.log("");
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "focused-report.json"), JSON.stringify(issues, null, 2));
  console.log("issues", issues.length);
}

main();

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "output-report");
const BASE = "http://localhost:3000";
const VIEWPORTS = [320, 360, 375, 390, 412, 430, 768];
const issues = [];

function addIssue(i) {
  issues.push(i);
}

async function fetchUrls() {
  const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
  return [...new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/https:\/\/www\.venesia-developments\.net/, BASE)))];
}

async function pageMetrics(page) {
  return page.evaluate(() => {
    const cw = document.documentElement.clientWidth;
    const sw = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
    const btn = document.querySelector('button[aria-label="فتح القائمة"]');
    const br = btn?.getBoundingClientRect();
    const offenders = [];
    for (const el of document.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      if (r.right > cw + 2 || r.left < -2) {
        offenders.push({ tag: el.tagName, cls: String(el.className).slice(0, 60), left: Math.round(r.left), right: Math.round(r.right) });
      }
    }
    const cls = performance.getEntriesByType("layout-shift").reduce((s, e) => (e.hadRecentInput ? s : s + e.value), 0);
    const broken = [...document.querySelectorAll("img")].filter((i) => i.complete && i.naturalWidth === 0 && i.src).map((i) => i.src.slice(-80));
    return {
      overflow: sw - cw,
      offenders: offenders.slice(0, 10),
      menu: br ? { left: Math.round(br.left), right: Math.round(br.right), w: Math.round(br.width), h: Math.round(br.height), offScreen: br.right < 0 || br.left > cw, partial: br.left < 0 && br.right > 0 } : null,
      cls: Math.round(cls * 1000) / 1000,
      broken,
      dir: document.documentElement.getAttribute("dir"),
    };
  });
}

async function jsClickMenu(page) {
  return page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="فتح القائمة"]');
    btn?.click();
    return Boolean(document.querySelector('[aria-label="القائمة الرئيسية"]'));
  });
}

async function audit(browser, url, vp) {
  const urlPath = url.replace(BASE, "") || "/";
  const dir = path.join(OUT, "shots", `${vp}w`, urlPath.replace(/\//g, "_") || "home");
  fs.mkdirSync(dir, { recursive: true });
  const page = await (await browser.newContext({ viewport: { width: vp, height: 844 }, locale: "ar-EG", deviceScaleFactor: 2 })).newPage();
  const consoleErr = [];
  const netErr = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErr.push(m.text().slice(0, 200)); });
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("_next") && !r.url().includes("favicon")) netErr.push({ s: r.status(), u: r.url().slice(0, 150) }); });

  const nav = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => null);
  if (!nav || nav.status() >= 400) {
    const shot = path.join(dir, "fail.png");
    await page.screenshot({ path: shot, fullPage: true });
    addIssue({ sev: "critical", cat: "load", page: urlPath, vp, title: "فشل تحميل الصفحة", shot });
    await page.context().close();
    return;
  }
  await page.waitForTimeout(2000);

  let m = await pageMetrics(page);
  const initial = path.join(dir, "01-initial.png");
  await page.screenshot({ path: initial, fullPage: true });

  if (m.menu?.offScreen) {
    addIssue({ sev: "critical", cat: "rtl-nav", page: urlPath, vp, title: "زر القائمة خارج الشاشة — التنقل مستحيل", detail: `left=${m.menu.left}px`, shot: initial });
  } else if (m.menu?.partial) {
    addIssue({ sev: "high", cat: "rtl-nav", page: urlPath, vp, title: "زر القائمة مقطوع جزئيًا", detail: `left=${m.menu.left}px right=${m.menu.right}px`, shot: initial });
  } else if (m.menu && (m.menu.w < 44 || m.menu.h < 44)) {
    addIssue({ sev: "medium", cat: "touch", page: urlPath, vp, title: `زر القائمة صغير ${m.menu.w}×${m.menu.h}px`, shot: initial });
  }

  if (m.overflow > 1) addIssue({ sev: m.overflow > 15 ? "high" : "medium", cat: "overflow", page: urlPath, vp, title: `Overflow ${m.overflow}px`, detail: JSON.stringify(m.offenders.slice(0, 3)), shot: initial });
  if (m.cls > 0.1) addIssue({ sev: m.cls > 0.25 ? "high" : "medium", cat: "cls", page: urlPath, vp, title: `CLS ${m.cls}`, shot: initial });
  if (m.broken.length) addIssue({ sev: "high", cat: "image", page: urlPath, vp, title: "صور مكسورة", detail: m.broken.join(", "), shot: initial });

  await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); });
  const scrolled = path.join(dir, "02-scrolled.png");
  await page.screenshot({ path: scrolled, fullPage: true });
  m = await pageMetrics(page);
  if (m.overflow > 1) addIssue({ sev: "medium", cat: "overflow-scroll", page: urlPath, vp, title: `Overflow بعد scroll ${m.overflow}px`, shot: scrolled });

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  const menuOpened = await jsClickMenu(page);
  await page.waitForTimeout(450);
  const menuShot = path.join(dir, "03-menu.png");
  await page.screenshot({ path: menuShot, fullPage: false });
  if (!menuOpened && !m.menu?.offScreen) addIssue({ sev: "high", cat: "nav", page: urlPath, vp, title: "قائمة الموبايل لا تُفتح", shot: menuShot });

  for (const sel of ['button[aria-expanded="false"]', "details:not([open]) summary"]) {
    const el = page.locator(sel).first();
    if (await el.count()) { await el.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(300); break; }
  }
  for (const sel of ['a:has-text("التالي")', 'button:has-text("التالي")']) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) { await el.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(600); break; }
  }
  const forms = page.locator("form");
  if (await forms.count()) {
    const inputs = forms.first().locator('input:not([type="hidden"]):not([type="submit"]), textarea');
    for (let i = 0; i < (await inputs.count()); i++) await inputs.nth(i).fill("اختبار QA").catch(() => {});
  }
  const final = path.join(dir, "04-final.png");
  await page.screenshot({ path: final, fullPage: true });

  const ce = [...new Set(consoleErr)].filter((e) => !/devtools|favicon/i.test(e));
  if (ce.length) addIssue({ sev: "high", cat: "console", page: urlPath, vp, title: "Console errors", detail: ce.slice(0, 3).join(" | "), shot: final });
  const ne = [...new Map(netErr.map((x) => [x.u, x])).values()];
  if (ne.length) addIssue({ sev: "high", cat: "network", page: urlPath, vp, title: "Network errors", detail: JSON.stringify(ne.slice(0, 3)), shot: final });

  await page.context().close();
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const urls = await fetchUrls();
  const browser = await chromium.launch({ headless: true });
  let n = 0;
  for (const vp of VIEWPORTS) {
    console.log(`=== ${vp}px ===`);
    for (const url of urls) {
      await audit(browser, url, vp);
      n++;
      if (n % 20 === 0) console.log(`  ${n}/${urls.length * VIEWPORTS.length}`);
    }
  }
  await browser.close();

  const dedup = [];
  const seen = new Set();
  for (const i of issues) {
    const k = `${i.cat}|${i.page}|${i.title}|${i.vp}`;
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push(i);
  }
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ tested: n, issues: dedup, counts: dedup.reduce((a, i) => { a[i.sev] = (a[i.sev] || 0) + 1; return a; }, {}) }, null, 2));
  console.log(`Done ${dedup.length} issues`);
}

main();

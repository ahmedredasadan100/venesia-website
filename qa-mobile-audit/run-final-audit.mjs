import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "output-final");
const BASE = "http://localhost:3000";
const VIEWPORTS = [320, 360, 375, 390, 412, 430, 768];
const issues = [];
let issueId = 0;

function addIssue(data) {
  issueId++;
  issues.push({ id: `QA-${String(issueId).padStart(3, "0")}`, ...data });
}

async function fetchUrls() {
  const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
  return [
    ...new Set(
      [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
        m[1].replace(/https:\/\/www\.venesia-developments\.net/, BASE)
      )
    ),
  ];
}

async function detect(page) {
  return page.evaluate(() => {
    const cw = document.documentElement.clientWidth;
    const sw = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
    const offenders = [];
    for (const el of document.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width < 6 || r.height < 6) continue;
      if (r.right > cw + 2 || r.left < -2) {
        offenders.push({
          tag: el.tagName,
          cls: String(el.className).slice(0, 80),
          right: Math.round(r.right),
          left: Math.round(r.left),
        });
      }
    }
    const smallTouch = [];
    for (const el of document.querySelectorAll("button, a, [role=button]")) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0 || r.top > innerHeight || r.bottom < 0) continue;
      if (r.width < 44 || r.height < 44) {
        smallTouch.push({
          tag: el.tagName,
          w: Math.round(r.width),
          h: Math.round(r.height),
          label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 45),
        });
      }
    }
    const textClip = [];
    for (const el of document.querySelectorAll("h1,h2,h3,p,span,a,li")) {
      if (el.scrollWidth > el.clientWidth + 4 && el.clientWidth > 20) {
        const r = el.getBoundingClientRect();
        if (r.top < innerHeight * 4 && r.width > 0) {
          textClip.push({
            tag: el.tagName,
            text: (el.textContent || "").trim().slice(0, 55),
            overflow: el.scrollWidth - el.clientWidth,
          });
        }
      }
    }
    const brokenImgs = [...document.querySelectorAll("img")]
      .filter((i) => i.complete && i.naturalWidth === 0 && i.src && !i.src.startsWith("data:"))
      .map((i) => i.src.slice(-90));
    const cls = performance.getEntriesByType("layout-shift").reduce((s, e) => (e.hadRecentInput ? s : s + e.value), 0);
    return {
      overflow: sw - cw,
      offenders: offenders.slice(0, 12),
      smallTouch: smallTouch.slice(0, 12),
      textClip: textClip.slice(0, 8),
      brokenImgs,
      cls: Math.round(cls * 1000) / 1000,
      dir: document.documentElement.getAttribute("dir"),
    };
  });
}

async function shot(page, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function interact(page, dir, urlPath, vp) {
  const log = {};

  const menuBtn = page.locator('button[aria-label="فتح القائمة"]').first();
  if (await menuBtn.isVisible().catch(() => false)) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    await menuBtn.click({ force: true, timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(450);
    log.menu = path.join(dir, "menu-open.png");
    await page.screenshot({ path: log.menu, fullPage: false });
    const menuOverflow = await page.locator('[aria-label="القائمة الرئيسية"]').evaluate((el) => el.scrollWidth > el.clientWidth + 2).catch(() => false);
    if (menuOverflow) {
      addIssue({ sev: "medium", cat: "overflow", page: urlPath, vp, title: "قائمة الموبايل تتجاوز العرض", shot: log.menu });
    }
    await menuBtn.click().catch(() => {});
  }

  for (const sel of ['[role="tab"]', 'button[aria-selected="false"]']) {
    const tabs = page.locator(sel);
    const n = await tabs.count();
    if (n > 1) {
      for (let i = 0; i < Math.min(n, 4); i++) {
        await tabs.nth(i).click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(300);
      }
      log.tabs = true;
      break;
    }
  }

  for (const sel of ['button[aria-expanded="false"]', "details:not([open]) summary"]) {
    const acc = page.locator(sel);
    const n = await acc.count();
    if (n > 0) {
      await acc.first().click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(350);
      log.accordion = path.join(dir, "accordion-open.png");
      await page.screenshot({ path: log.accordion, fullPage: false });
      break;
    }
  }

  for (const sel of ['nav[aria-label*="pagination" i] a', 'a:has-text("التالي")', 'button:has-text("التالي")']) {
    const p = page.locator(sel);
    if ((await p.count()) > 0) {
      await p.first().click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(700);
      log.pagination = path.join(dir, "pagination.png");
      await page.screenshot({ path: log.pagination, fullPage: false });
      break;
    }
  }

  const slider = page.locator('[class*="swiper"], [class*="carousel"], [class*="slider"]').first();
  if (await slider.count()) {
    await page.keyboard.press("ArrowLeft").catch(() => {});
    await page.waitForTimeout(350);
    log.slider = path.join(dir, "slider.png");
    await page.screenshot({ path: log.slider, fullPage: false });
  }

  const forms = page.locator("form");
  const fc = await forms.count();
  for (let i = 0; i < fc; i++) {
    const form = forms.nth(i);
    const inputs = form.locator('input:not([type="hidden"]):not([type="submit"]), textarea, select');
    for (let j = 0; j < (await inputs.count()); j++) {
      const inp = inputs.nth(j);
      const t = (await inp.getAttribute("type")) || "text";
      if (t === "checkbox" || t === "radio") await inp.check({ timeout: 1000 }).catch(() => {});
      else if (t !== "file") await inp.fill("اختبار QA", { timeout: 1500 }).catch(() => {});
    }
    log.form = path.join(dir, `form-${i}.png`);
    await page.screenshot({ path: log.form, fullPage: false });
  }

  return log;
}

async function auditPage(page, url, vp) {
  const urlPath = url.replace(BASE, "") || "/";
  const dir = path.join(OUT, "screenshots", `${vp}w`, urlPath.replace(/\//g, "_") || "home");
  const consoleErr = [];
  const netErr = [];
  const jsErr = [];

  page.on("console", (m) => { if (m.type() === "error") consoleErr.push(m.text().slice(0, 250)); });
  page.on("pageerror", (e) => jsErr.push(String(e).slice(0, 250)));
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("_next") && !r.url().includes("favicon")) {
      netErr.push({ s: r.status(), u: r.url().slice(0, 180) });
    }
  });

  const nav = await page.goto(url, { waitUntil: "networkidle", timeout: 60000 }).catch((e) => ({ error: e.message }));
  if (nav?.error) {
    const f = path.join(dir, "nav-fail.png");
    await shot(page, f);
    addIssue({ sev: "critical", cat: "navigation", page: urlPath, vp, title: "فشل تحميل الصفحة", detail: nav.error, shot: f });
    return;
  }
  if (nav?.status() >= 400) {
    const f = path.join(dir, "http-error.png");
    await shot(page, f);
    addIssue({ sev: "critical", cat: "network", page: urlPath, vp, title: `HTTP ${nav.status()}`, shot: f });
    return;
  }

  await page.waitForTimeout(2000);
  const initial = path.join(dir, "01-initial.png");
  await shot(page, initial);

  let m = await detect(page);
  if (m.overflow > 1) {
    addIssue({ sev: m.overflow > 20 ? "high" : "medium", cat: "overflow", page: urlPath, vp, title: `Overflow أفقي ${m.overflow}px`, detail: JSON.stringify(m.offenders.slice(0, 4)), shot: initial });
  }
  if (m.cls > 0.08) {
    addIssue({ sev: m.cls > 0.2 ? "high" : "medium", cat: "cls", page: urlPath, vp, title: `Layout Shift CLS≈${m.cls}`, shot: initial });
  }
  if (m.brokenImgs.length) {
    addIssue({ sev: "high", cat: "image", page: urlPath, vp, title: "صور لا تُحمّل", detail: m.brokenImgs.join(", "), shot: initial });
  }
  if (m.textClip.length > 3) {
    addIssue({ sev: "medium", cat: "text-clip", page: urlPath, vp, title: "نص مقطوع أفقيًا", detail: JSON.stringify(m.textClip.slice(0, 3)), shot: initial });
  }
  const menuBtnSmall = m.smallTouch.find((t) => /قائمة|menu/i.test(t.label) || (t.w <= 40 && t.h <= 40 && t.tag === "BUTTON"));
  if (menuBtnSmall) {
    addIssue({ sev: "medium", cat: "touch-target", page: urlPath, vp, title: `زر القائمة ${menuBtnSmall.w}×${menuBtnSmall.h}px`, detail: menuBtnSmall.label, shot: initial });
  }

  await page.evaluate(async () => {
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y < h; y += innerHeight * 0.75) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 100));
    }
    scrollTo(0, 0);
  });
  const scrolled = path.join(dir, "02-scrolled.png");
  await shot(page, scrolled);
  m = await detect(page);
  if (m.overflow > 1) {
    addIssue({ sev: "medium", cat: "overflow", page: urlPath, vp, title: `Overflow بعد التمرير ${m.overflow}px`, shot: scrolled });
  }

  await interact(page, dir, urlPath, vp);
  const final = path.join(dir, "03-final.png");
  await shot(page, final);

  const ce = [...new Set(consoleErr)].filter((e) => !/devtools|favicon/i.test(e));
  if (ce.length) addIssue({ sev: "high", cat: "console", page: urlPath, vp, title: "Console Errors", detail: ce.slice(0, 4).join(" | "), shot: final });
  if (jsErr.length) addIssue({ sev: "critical", cat: "javascript", page: urlPath, vp, title: "JS Errors", detail: jsErr.slice(0, 3).join(" | "), shot: final });
  const ne = [...new Map(netErr.map((x) => [x.u, x])).values()];
  if (ne.length) addIssue({ sev: ne.some((x) => x.s >= 500) ? "critical" : "high", cat: "network", page: urlPath, vp, title: "Network Errors", detail: JSON.stringify(ne.slice(0, 4)), shot: final });

  page.removeAllListeners();
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const urls = await fetchUrls();
  console.log(`Auditing ${urls.length} URLs × ${VIEWPORTS.length} viewports`);
  const browser = await chromium.launch({ headless: true });

  for (const vp of VIEWPORTS) {
    console.log(`\n=== ${vp}px ===`);
    const ctx = await browser.newContext({ viewport: { width: vp, height: 844 }, locale: "ar-EG", deviceScaleFactor: 2 });
    for (const url of urls) {
      const page = await ctx.newPage();
      process.stdout.write(`  ${vp} ${url.replace(BASE, "") || "/"} ... `);
      await auditPage(page, url, vp);
      console.log("ok");
      await page.close();
    }
    await ctx.close();
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

  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ tested: urls.length * VIEWPORTS.length, issueCount: dedup.length, issues: dedup }, null, 2));
  console.log(`\nDone: ${dedup.length} issues`);
}

main();

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "output");
const BASE = process.env.QA_BASE_URL || "http://localhost:3000";

const VIEWPORTS = [320, 360, 375, 390, 412, 430, 768];
const VIEWPORT_H = 844;

const issues = [];
let issueCounter = 0;

function slug(s) {
  return s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function addIssue(data) {
  issueCounter++;
  const id = `issue-${String(issueCounter).padStart(4, "0")}`;
  const entry = { id, ...data };
  issues.push(entry);
  return id;
}

async function fetchUrls() {
  const res = await fetch(`${BASE}/sitemap.xml`);
  const xml = await res.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    m[1].replace(/https:\/\/www\.venesia-developments\.net/, BASE)
  );
  return [...new Set(urls)];
}

async function detectOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const scrollW = Math.max(doc.scrollWidth, body?.scrollWidth ?? 0);
    const clientW = doc.clientWidth;
    const overflow = scrollW - clientW;
    const offenders = [];
    document.querySelectorAll("*").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.right > clientW + 2 || r.left < -2) {
        const tag = el.tagName.toLowerCase();
        const cls = el.className?.toString?.().slice(0, 60) || "";
        if (r.width > 10 && r.height > 10) {
          offenders.push({
            tag,
            cls,
            right: Math.round(r.right),
            left: Math.round(r.left),
            width: Math.round(r.width),
          });
        }
      }
    });
    return {
      overflowPx: overflow,
      clientW,
      scrollW,
      offenders: offenders.slice(0, 15),
    };
  });
}

async function detectRtlIssues(page) {
  return page.evaluate(() => {
    const dir = document.documentElement.getAttribute("dir") || getComputedStyle(document.documentElement).direction;
    const problems = [];
    document.querySelectorAll("[dir=ltr], [dir=rtl]").forEach((el) => {
      const elDir = el.getAttribute("dir");
      if (elDir && elDir !== dir) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          problems.push({ tag: el.tagName, dir: elDir, cls: String(el.className).slice(0, 50) });
        }
      }
    });
    const misaligned = [];
    document.querySelectorAll("input, textarea, select").forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.textAlign === "left" && dir === "rtl") {
        misaligned.push({ tag: el.tagName, name: el.getAttribute("name") || el.id });
      }
    });
    return { dir, nestedDir: problems.slice(0, 10), ltrInputsInRtl: misaligned.slice(0, 10) };
  });
}

async function detectImageCrop(page) {
  return page.evaluate(() => {
    const bad = [];
    document.querySelectorAll("img").forEach((img) => {
      const cs = getComputedStyle(img);
      const r = img.getBoundingClientRect();
      if (r.width < 20 || r.height < 20) return;
      const ow = img.naturalWidth;
      const oh = img.naturalHeight;
      if (!ow || !oh) return;
      const objFit = cs.objectFit;
      if (objFit === "cover" || objFit === "contain") {
        const boxRatio = r.width / r.height;
        const imgRatio = ow / oh;
        const ratioDiff = Math.abs(boxRatio - imgRatio) / imgRatio;
        if (objFit === "cover" && ratioDiff > 0.35 && r.width > 80) {
          bad.push({
            src: img.src.slice(-80),
            objFit,
            box: `${Math.round(r.width)}x${Math.round(r.height)}`,
            natural: `${ow}x${oh}`,
            ratioDiff: Math.round(ratioDiff * 100),
          });
        }
      }
      if (r.right > window.innerWidth + 5 || r.left < -5) {
        bad.push({ src: img.src.slice(-80), issue: "overflow", box: `${Math.round(r.width)}x${Math.round(r.height)}` });
      }
    });
    return bad.slice(0, 12);
  });
}

async function measureCls(page) {
  return page.evaluate(async () => {
    return new Promise((resolve) => {
      let cls = 0;
      try {
        const po = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            if (!e.hadRecentInput) cls += e.value;
          }
        });
        po.observe({ type: "layout-shift", buffered: true });
        setTimeout(() => {
          po.disconnect();
          resolve(Math.round(cls * 1000) / 1000);
        }, 2500);
      } catch {
        resolve(null);
      }
    });
  });
}

async function screenshot(page, filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

async function tryMobileMenu(page, ctx, vp, urlPath) {
  const btn = page.locator('button[aria-label="فتح القائمة"], button[aria-label="إغلاق القائمة"]').first();
  if (!(await btn.isVisible({ timeout: 2000 }).catch(() => false))) return { opened: false };
  await btn.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(400);
  const menu = page.locator('[aria-label="القائمة الرئيسية"]');
  const visible = await menu.isVisible().catch(() => false);
  const shot = path.join(OUT, "screenshots", `${vp}w`, slug(urlPath || "home"), "mobile-menu.png");
  await screenshot(page, shot);
  if (visible) {
    const menuOverflow = await menu.evaluate((el) => el.scrollWidth > el.clientWidth + 2);
    if (menuOverflow) {
      addIssue({
        severity: "medium",
        category: "overflow",
        viewport: vp,
        page: urlPath,
        title: "قائمة الموبايل تتجاوز العرض",
        screenshot: shot,
      });
    }
  }
  await btn.click({ timeout: 2000 }).catch(() => {});
  return { opened: visible, screenshot: shot };
}

async function tryInteractions(page, ctx, vp, urlPath) {
  const interactionLog = { tabs: 0, accordions: 0, pagination: 0, buttons: 0, forms: 0, sliders: 0 };

  const tabSelectors = [
    '[role="tab"]',
    '[data-state="inactive"]',
    'button[data-tab]',
    '.tabs button',
  ];
  for (const sel of tabSelectors) {
    const tabs = page.locator(sel);
    const count = await tabs.count().catch(() => 0);
    if (count > 1) {
      for (let i = 0; i < Math.min(count, 5); i++) {
        await tabs.nth(i).click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(300);
        interactionLog.tabs++;
      }
      break;
    }
  }

  const accSelectors = [
    '[data-state="closed"]',
    'button[aria-expanded="false"]',
    'details:not([open]) summary',
    '.accordion-trigger',
  ];
  for (const sel of accSelectors) {
    const accs = page.locator(sel);
    const count = await accs.count().catch(() => 0);
    if (count > 0) {
      for (let i = 0; i < Math.min(count, 4); i++) {
        await accs.nth(i).click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(350);
        interactionLog.accordions++;
      }
      break;
    }
  }

  const pagSelectors = [
    'nav[aria-label*="pagination" i] a',
    'nav[aria-label*="صف" i] a',
    'a[aria-label="Next"], a[aria-label="التالي"]',
    '.pagination a, .pagination button',
    'button:has-text("التالي"), a:has-text("التالي")',
    'button:has-text("›"), a:has-text("›")',
  ];
  for (const sel of pagSelectors) {
    const pags = page.locator(sel);
    const count = await pags.count().catch(() => 0);
    if (count > 0) {
      await pags.first().click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(800);
      interactionLog.pagination++;
      break;
    }
  }

  const sliders = page.locator('[class*="swiper"], [class*="slider"], [class*="carousel"], .splide');
  if ((await sliders.count()) > 0) {
    const slider = sliders.first();
    await slider.hover().catch(() => {});
    await page.keyboard.press("ArrowLeft").catch(() => {});
    await page.waitForTimeout(400);
    await page.keyboard.press("ArrowRight").catch(() => {});
    interactionLog.sliders++;
  }

  const btns = page.locator('main button:visible, main a[role="button"]:visible').filter({
    hasNot: page.locator('[aria-label="فتح القائمة"], [aria-label="إغلاق القائمة"]'),
  });
  const btnCount = await btns.count().catch(() => 0);
  for (let i = 0; i < Math.min(btnCount, 6); i++) {
    const b = btns.nth(i);
    const text = (await b.textContent().catch(() => ""))?.trim() || "";
    if (/submit|إرسال|تأكيد|حذف|delete/i.test(text)) continue;
    await b.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(250);
    interactionLog.buttons++;
  }

  const forms = page.locator("form");
  const formCount = await forms.count().catch(() => 0);
  for (let fi = 0; fi < formCount; fi++) {
    const form = forms.nth(fi);
    const inputs = form.locator('input:not([type="hidden"]):not([type="submit"]), textarea, select');
    const ic = await inputs.count();
    for (let j = 0; j < ic; j++) {
      const inp = inputs.nth(j);
      const type = (await inp.getAttribute("type")) || "text";
      if (type === "checkbox" || type === "radio") {
        await inp.check({ timeout: 1000 }).catch(() => inp.click().catch(() => {}));
      } else if (type === "file") {
        /* skip */
      } else {
        await inp.fill("اختبار QA", { timeout: 1500 }).catch(() => {});
      }
    }
    interactionLog.forms++;
    const formShot = path.join(OUT, "screenshots", `${vp}w`, slug(urlPath || "home"), `form-${fi}.png`);
    await screenshot(page, formShot);
  }

  return interactionLog;
}

async function auditPage(page, ctx, url, vp) {
  const urlPath = url.replace(BASE, "") || "/";
  const pageKey = slug(urlPath || "home");
  const consoleErrors = [];
  const networkErrors = [];
  const pageErrors = [];

  const onConsole = (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 300));
  };
  const onPageError = (err) => pageErrors.push(String(err).slice(0, 300));
  const onResponse = (res) => {
    const u = res.url();
    if (res.status() >= 400 && !u.includes("favicon") && !u.includes("_next")) {
      networkErrors.push({ status: res.status(), url: u.slice(0, 200) });
    }
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("response", onResponse);

  const result = { url: urlPath, viewport: vp, ok: true };

  try {
    const nav = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1500);
    const status = nav?.status() ?? 0;
    if (status >= 400) {
      const shot = path.join(OUT, "screenshots", `${vp}w`, pageKey, "error-page.png");
      await screenshot(page, shot);
      addIssue({
        severity: "critical",
        category: "network",
        viewport: vp,
        page: urlPath,
        title: `HTTP ${status}`,
        detail: `فشل تحميل الصفحة`,
        screenshot: shot,
      });
      result.ok = false;
      return result;
    }

    const clsBefore = await measureCls(page);
    const shotInitial = path.join(OUT, "screenshots", `${vp}w`, pageKey, "01-initial.png");
    await screenshot(page, shotInitial);

    const overflow = await detectOverflow(page);
    if (overflow.overflowPx > 2) {
      const shot = path.join(OUT, "screenshots", `${vp}w`, pageKey, "overflow.png");
      await screenshot(page, shot);
      addIssue({
        severity: overflow.overflowPx > 20 ? "high" : "medium",
        category: "overflow",
        viewport: vp,
        page: urlPath,
        title: `Overflow أفقي ${overflow.overflowPx}px`,
        detail: JSON.stringify(overflow.offenders.slice(0, 5)),
        screenshot: shot,
      });
    }

    if (clsBefore !== null && clsBefore > 0.1) {
      addIssue({
        severity: clsBefore > 0.25 ? "high" : "medium",
        category: "cls",
        viewport: vp,
        page: urlPath,
        title: `Layout Shift (CLS ≈ ${clsBefore})`,
        screenshot: shotInitial,
      });
    }

    const rtl = await detectRtlIssues(page);
    if (rtl.ltrInputsInRtl.length > 0) {
      addIssue({
        severity: "low",
        category: "rtl",
        viewport: vp,
        page: urlPath,
        title: "حقول إدخال بمحاذاة LTR داخل صفحة RTL",
        detail: JSON.stringify(rtl.ltrInputsInRtl),
        screenshot: shotInitial,
      });
    }

    const crops = await detectImageCrop(page);
    if (crops.length > 0) {
      const shot = path.join(OUT, "screenshots", `${vp}w`, pageKey, "image-crop.png");
      await screenshot(page, shot);
      addIssue({
        severity: "low",
        category: "image-crop",
        viewport: vp,
        page: urlPath,
        title: "احتمال قص مبالغ فيه للصور (object-fit: cover)",
        detail: JSON.stringify(crops.slice(0, 3)),
        screenshot: shot,
      });
    }

    await page.evaluate(async () => {
      const h = document.documentElement.scrollHeight;
      const step = window.innerHeight * 0.7;
      for (let y = 0; y < h; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
    const shotScrolled = path.join(OUT, "screenshots", `${vp}w`, pageKey, "02-after-scroll.png");
    await screenshot(page, shotScrolled);

    const overflowAfterScroll = await detectOverflow(page);
    if (overflowAfterScroll.overflowPx > overflow.overflowPx + 5) {
      addIssue({
        severity: "medium",
        category: "overflow",
        viewport: vp,
        page: urlPath,
        title: "Overflow يظهر بعد التمرير",
        detail: `${overflowAfterScroll.overflowPx}px`,
        screenshot: shotScrolled,
      });
    }

    await tryMobileMenu(page, ctx, vp, urlPath);
    await tryInteractions(page, ctx, vp, urlPath);

    const shotFinal = path.join(OUT, "screenshots", `${vp}w`, pageKey, "03-final.png");
    await screenshot(page, shotFinal);

    const uniqueConsole = [...new Set(consoleErrors)].filter(
      (e) => !e.includes("Download the React DevTools") && !e.includes("favicon")
    );
    if (uniqueConsole.length) {
      addIssue({
        severity: "high",
        category: "console",
        viewport: vp,
        page: urlPath,
        title: "Console Errors",
        detail: uniqueConsole.slice(0, 5).join(" | "),
        screenshot: shotFinal,
      });
    }

    if (pageErrors.length) {
      addIssue({
        severity: "critical",
        category: "javascript",
        viewport: vp,
        page: urlPath,
        title: "JavaScript Page Errors",
        detail: pageErrors.slice(0, 3).join(" | "),
        screenshot: shotFinal,
      });
    }

    const uniqueNet = networkErrors.filter((e, i, arr) => arr.findIndex((x) => x.url === e.url) === i);
    if (uniqueNet.length) {
      addIssue({
        severity: uniqueNet.some((e) => e.status >= 500) ? "critical" : "high",
        category: "network",
        viewport: vp,
        page: urlPath,
        title: "Network Errors",
        detail: JSON.stringify(uniqueNet.slice(0, 5)),
        screenshot: shotFinal,
      });
    }

    const t0 = Date.now();
    await page.evaluate(() => {
      document.querySelectorAll("[data-reveal], .animate-, [class*='transition']").forEach((el) => {
        el.getBoundingClientRect();
      });
    });
    await page.waitForTimeout(600);
    const animLag = Date.now() - t0;
    if (animLag > 800) {
      addIssue({
        severity: "low",
        category: "animation",
        viewport: vp,
        page: urlPath,
        title: "تأخير محتمل في الرسوم المتحركة",
        detail: `${animLag}ms`,
        screenshot: shotFinal,
      });
    }
  } catch (err) {
    const shot = path.join(OUT, "screenshots", `${vp}w`, pageKey, "crash.png");
    await screenshot(page, shot).catch(() => {});
    addIssue({
      severity: "critical",
      category: "crash",
      viewport: vp,
      page: urlPath,
      title: "فشل أثناء الفحص",
      detail: String(err).slice(0, 300),
      screenshot: shot,
    });
    result.ok = false;
  } finally {
    page.removeAllListeners();
  }

  return result;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const urls = await fetchUrls();
  console.log(`URLs: ${urls.length}, viewports: ${VIEWPORTS.length}`);

  const browser = await chromium.launch({ headless: true });
  const summary = { pages: urls.length, viewports: VIEWPORTS.length, tested: 0, failed: 0 };

  for (const vp of VIEWPORTS) {
    console.log(`\n=== Viewport ${vp}px ===`);
    const context = await browser.newContext({
      viewport: { width: vp, height: VIEWPORT_H },
      locale: "ar-EG",
      deviceScaleFactor: 2,
    });

    for (const url of urls) {
      const page = await context.newPage();
      process.stdout.write(`  ${vp}w ${url.replace(BASE, "") || "/"} ... `);
      const r = await auditPage(page, context, url, vp);
      summary.tested++;
      if (!r.ok) summary.failed++;
      console.log(r.ok ? "ok" : "FAIL");
      await page.close();
    }
    await context.close();
  }

  await browser.close();

  const deduped = [];
  const seen = new Set();
  for (const iss of issues) {
    const key = `${iss.category}|${iss.page}|${iss.title}|${iss.viewport}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(iss);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    summary,
    issueCount: deduped.length,
    bySeverity: {
      critical: deduped.filter((i) => i.severity === "critical").length,
      high: deduped.filter((i) => i.severity === "high").length,
      medium: deduped.filter((i) => i.severity === "medium").length,
      low: deduped.filter((i) => i.severity === "low").length,
    },
    byCategory: deduped.reduce((acc, i) => {
      acc[i.category] = (acc[i.category] || 0) + 1;
      return acc;
    }, {}),
    issues: deduped,
  };

  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(`\nDone. ${deduped.length} unique issues. Report: ${path.join(OUT, "report.json")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

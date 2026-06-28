import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "output-sample");
fs.mkdirSync(OUT, { recursive: true });

const xml = await (await fetch("http://localhost:3000/sitemap.xml")).text();
const urls = [...new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/https:\/\/www\.venesia-developments\.net/, "http://localhost:3000")))];

const browser = await chromium.launch();
const issues = [];
const viewports = [320, 360, 375, 390, 412, 430, 768];

for (const vp of viewports) {
  const ctx = await browser.newContext({ viewport: { width: vp, height: 844 }, locale: "ar-EG" });
  for (const url of urls) {
    const page = await ctx.newPage();
    const ce = []; const ne = [];
    page.on("console", (m) => { if (m.type() === "error") ce.push(m.text().slice(0, 150)); });
    page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("_next")) ne.push(`${r.status()} ${r.url().slice(0, 100)}`); });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const m = await page.evaluate(() => {
      const cw = document.documentElement.clientWidth;
      const sw = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
      const btn = document.querySelector('button[aria-label="فتح القائمة"]');
      const b = btn?.getBoundingClientRect();
      const cls = performance.getEntriesByType("layout-shift").reduce((s, e) => (e.hadRecentInput ? s : s + e.value), 0);
      return {
        overflow: sw - cw,
        menuOff: b ? b.right < 0 || b.left > cw : null,
        menuPartial: b ? b.left < 0 && b.right > 0 : null,
        menuLeft: b ? Math.round(b.left) : null,
        cls: Math.round(cls * 1000) / 1000,
        isMaintenance: document.body?.textContent?.includes("الموقع قيد الصيانة") ?? false,
      };
    });
    const pathOnly = url.replace("http://localhost:3000", "") || "/";
    if (m.isMaintenance) issues.push({ vp, path: pathOnly, type: "maintenance", sev: "critical" });
    if (m.menuOff) issues.push({ vp, path: pathOnly, type: "menu-offscreen", sev: "critical", menuLeft: m.menuLeft });
    else if (m.menuPartial) issues.push({ vp, path: pathOnly, type: "menu-partial", sev: "high", menuLeft: m.menuLeft });
    if (m.overflow > 1) issues.push({ vp, path: pathOnly, type: "overflow", sev: "medium", px: m.overflow });
    if (m.cls > 0.1) issues.push({ vp, path: pathOnly, type: "cls", sev: "medium", cls: m.cls });
    if (ce.length) issues.push({ vp, path: pathOnly, type: "console", sev: "high", msg: [...new Set(ce)][0] });
    if (ne.length) issues.push({ vp, path: pathOnly, type: "network", sev: "high", msg: ne[0] });
    await page.close();
  }
  await ctx.close();
  console.log(`done ${vp}px`);
}
await browser.close();

const summary = {
  totalUrls: urls.length,
  totalChecks: urls.length * viewports.length,
  byType: issues.reduce((a, i) => { a[i.type] = (a[i.type] || 0) + 1; return a; }, {}),
  issues,
};
fs.writeFileSync(path.join(OUT, "sample.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary.byType));

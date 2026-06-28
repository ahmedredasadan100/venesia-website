import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const VIEWPORTS = [320, 360, 375, 390, 412, 430, 768, 1280];
const BADGE = "من المخطط إلى التنفيذ... الحكاية بتتشاف على الأرض";

async function measure(page) {
  return page.evaluate((text) => {
    const badges = [...document.querySelectorAll("section .rounded-full.border-white\\/10")].filter((el) =>
      (el.textContent || "").includes("من المخطط")
    );
    const badge = badges[0];
    if (!badge) return { found: false };
    const r = badge.getBoundingClientRect();
    const cs = getComputedStyle(badge);
    const lines = badge.scrollHeight > parseFloat(cs.lineHeight) * 1.5 ? 2 : 1;
    return {
      found: true,
      lines: badge.scrollHeight / parseFloat(cs.lineHeight),
      lineCount: lines,
      width: Math.round(r.width),
      right: Math.round(r.right),
      cw: document.documentElement.clientWidth,
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth,
      fontSize: cs.fontSize,
      whiteSpace: cs.whiteSpace,
    };
  }, BADGE);
}

const browser = await chromium.launch();
const results = [];
for (const vp of VIEWPORTS) {
  const page = await (await browser.newContext({ viewport: { width: vp, height: 844 } })).newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
  results.push({ vp, ...(await measure(page)) });
  await page.context().close();
}
await browser.close();
console.log(JSON.stringify(results, null, 2));

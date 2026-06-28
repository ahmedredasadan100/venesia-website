import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const VIEWPORTS = [320, 360, 375, 390, 412, 430, 768, 1280];

async function measure(page) {
  return page.evaluate(() => {
    const container = [...document.querySelectorAll("section")].find((s) =>
      s.querySelector('img[src*="story-main"]')
    );
    if (!container) return { found: false };
    const main = container.querySelector('img[src*="story-main"]')?.parentElement;
    const sec = container.querySelector('img[src*="story-secondary"]')?.parentElement;
    const wrap = main?.parentElement;
    const mr = main?.getBoundingClientRect();
    const sr = sec?.getBoundingClientRect();
    const wr = wrap?.getBoundingClientRect();
    return {
      found: true,
      containerH: wr ? Math.round(wr.height) : null,
      main: mr ? { w: Math.round(mr.width), h: Math.round(mr.height), ratio: Math.round((mr.width / mr.height) * 100) / 100 } : null,
      sec: sr ? { w: Math.round(sr.width), h: Math.round(sr.height), ratio: Math.round((sr.width / sr.height) * 100) / 100 } : null,
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth,
    };
  });
}

const browser = await chromium.launch();
for (const vp of VIEWPORTS) {
  const page = await (await browser.newContext({ viewport: { width: vp, height: 844 } })).newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("section")].find((s) => s.querySelector('img[src*="story-main"]'));
    el?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(500);
  console.log(JSON.stringify({ vp, ...(await measure(page)) }));
  await page.context().close();
}
await browser.close();

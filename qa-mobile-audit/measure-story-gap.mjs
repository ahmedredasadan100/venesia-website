import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const VIEWPORTS = [320, 360, 375, 390, 412, 430, 768, 1280];

async function measure(page) {
  return page.evaluate(() => {
    const hero = document.querySelector("section.min-h-screen, section.relative.isolate.min-h-screen");
    const story = [...document.querySelectorAll("section")].find((s) => s.querySelector('img[src*="story-main"]'));
    const main = story?.querySelector('img[src*="story-main"]')?.parentElement;
    const sec = story?.querySelector('img[src*="story-secondary"]')?.parentElement;
    const wrap = main?.parentElement;
    const hr = hero?.getBoundingClientRect();
    const sr = story?.getBoundingClientRect();
    const mr = main?.getBoundingClientRect();
    const fr = sec?.getBoundingClientRect();
    const wr = wrap?.getBoundingClientRect();
    const gap = hr && sr ? Math.round(sr.top - hr.bottom) : null;
    return {
      heroToStoryGap: gap,
      sectionPy: story ? getComputedStyle(story).paddingTop : null,
      containerH: wr ? Math.round(wr.height) : null,
      main: mr ? { w: Math.round(mr.width), h: Math.round(mr.height), r: Math.round((mr.width / mr.height) * 100) / 100 } : null,
      sec: fr ? { w: Math.round(fr.width), h: Math.round(fr.height), r: Math.round((fr.width / fr.height) * 100) / 100 } : null,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

const browser = await chromium.launch();
for (const vp of VIEWPORTS) {
  const page = await (await browser.newContext({ viewport: { width: vp, height: 844 } })).newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
  console.log(JSON.stringify({ vp, ...(await measure(page)) }));
  await page.context().close();
}
await browser.close();

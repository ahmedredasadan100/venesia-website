import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 320, height: 844 } })).newPage();
await page.goto("http://localhost:3000/about", { waitUntil: "networkidle" });
const r = await page.evaluate(() => {
  const btn = document.querySelector('button[aria-label="فتح القائمة"]');
  const b = btn?.getBoundingClientRect();
  const header = document.querySelector("header");
  const h = header?.getBoundingClientRect();
  return {
    btn: b ? { top: b.top, left: b.left, right: b.right, bottom: b.bottom, w: b.width, h: b.height } : null,
    header: h ? { top: h.top, height: h.height, position: getComputedStyle(header).position } : null,
    innerHeight: innerHeight,
    scrollY: scrollY,
  };
});
console.log(JSON.stringify(r, null, 2));
await browser.close();

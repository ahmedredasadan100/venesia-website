import { chromium } from "playwright";

const browser = await chromium.launch();
const pages = ["/", "/about", "/contact", "/projects", "/topics"];
const widths = [320, 360, 375, 390, 412, 430, 768];
const results = [];

for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 844 } });
  for (const p of pages) {
    const page = await ctx.newPage();
    await page.goto(`http://localhost:3000${p}`, { waitUntil: "networkidle" });
    const r = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="فتح القائمة"]');
      const b = btn?.getBoundingClientRect();
      return b ? { left: Math.round(b.left), right: Math.round(b.right), w: Math.round(b.width), cw: document.documentElement.clientWidth, offScreen: b.right < 0 || b.left > document.documentElement.clientWidth } : { missing: true };
    });
    results.push({ w, p, ...r });
    await page.close();
  }
  await ctx.close();
}

console.log(JSON.stringify(results, null, 2));
await browser.close();

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "issue-shots");
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

async function capture(vp, pagePath, name) {
  const page = await (await browser.newContext({ viewport: { width: vp, height: 844 }, locale: "ar-EG", deviceScaleFactor: 2 })).newPage();
  await page.goto(`http://localhost:3000${pagePath}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, `${name}-${vp}w-full.png`), fullPage: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${vp}w-header.png`), fullPage: false });
  // highlight navbar area
  await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="فتح القائمة"]');
    if (btn) btn.style.outline = "3px solid red";
  });
  await page.screenshot({ path: path.join(OUT, `${name}-${vp}w-nav-highlight.png`), fullPage: false });
  await page.context().close();
}

for (const vp of [320, 360, 375]) await capture(vp, "/", "home");
for (const vp of [320, 375]) await capture(vp, "/contact", "contact");
for (const vp of [320, 375]) await capture(vp, "/projects", "projects");
for (const vp of [320, 375]) await capture(vp, "/topics", "topics");
for (const vp of [320]) await capture(vp, "/track-your-project", "track");

await browser.close();
console.log("captured to", OUT);

/**
 * Capture bottom CTA section screenshot for visual QA.
 * Usage: node scripts/capture-page-cta-shot.mjs [port] [path] [output]
 */
import { chromium } from "playwright";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const port = process.argv[2] || "3022";
const path = process.argv[3] || "/track-your-project";
const output = process.argv[4] || "track-cta-fixed.png";
const baseUrl = `http://127.0.0.1:${port}`;
const outPath = resolve(dirname(fileURLToPath(import.meta.url)), "screenshots", output);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const cta = page.locator("section").filter({ has: page.locator("a.rounded-xl") }).last();
await cta.scrollIntoViewIfNeeded();
await page.waitForTimeout(800);

const box = await cta.boundingBox();
if (box) {
  const pad = 24;
  await page.screenshot({
    path: outPath,
    clip: {
      x: Math.max(0, box.x - pad),
      y: Math.max(0, box.y - pad),
      width: Math.min(1440, box.width + pad * 2),
      height: Math.min(900, box.height + pad * 2),
    },
  });
  console.log(`Saved ${outPath}`);
} else {
  await page.screenshot({ path: outPath, fullPage: true });
  console.log(`Fallback full page: ${outPath}`);
}

await browser.close();

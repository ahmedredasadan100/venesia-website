/**
 * Capture hero + first section screenshot for visual QA.
 * Usage: node scripts/capture-page-hero-shot.mjs [port] [path] [output]
 */
import { chromium } from "playwright";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const port = process.argv[2] || "3021";
const path = process.argv[3] || "/track-your-project";
const output = process.argv[4] || "track-your-project-fixed.png";
const baseUrl = `http://127.0.0.1:${port}`;
const outPath = resolve(dirname(fileURLToPath(import.meta.url)), "screenshots", output);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

const hero = page.locator("section.relative.isolate").first();
const mainSlot = page.locator('[data-layout-slot="main"] section').first();
const heroBox = await hero.boundingBox();
const mainBox = await mainSlot.boundingBox();

if (heroBox && mainBox) {
  const clipY = Math.max(0, heroBox.y - 8);
  const clipHeight = Math.min(900 - clipY, mainBox.y + Math.min(mainBox.height, 280) - clipY + 16);
  await page.screenshot({
    path: outPath,
    clip: { x: 0, y: clipY, width: 1440, height: Math.max(clipHeight, 520) },
  });
  console.log(`Saved ${outPath}`);
  console.log(`Hero height: ${Math.round(heroBox.height)}px, gap to main: ${Math.round(mainBox.y - (heroBox.y + heroBox.height))}px`);
} else {
  await page.screenshot({ path: outPath, fullPage: false });
  console.log(`Fallback full viewport shot: ${outPath}`);
}

await browser.close();

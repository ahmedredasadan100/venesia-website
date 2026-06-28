import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "issue-shots");
const browser = await chromium.launch();

for (const vp of [375, 412, 768]) {
  const page = await (await browser.newContext({ viewport: { width: vp, height: 844 }, locale: "ar-EG" })).newPage();
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.querySelector('button[aria-label="فتح القائمة"]')?.click());
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, `menu-open-${vp}w.png`), fullPage: false });
  await page.context().close();
}

// contact form
const page = await (await browser.newContext({ viewport: { width: 320, height: 844 } })).newPage();
await page.goto("http://localhost:3000/contact", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.evaluate(async () => {
  const h = document.documentElement.scrollHeight;
  for (let y = 0; y < h; y += innerHeight * 0.7) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 100)); }
});
await page.screenshot({ path: path.join(OUT, "contact-320w-form-area.png"), fullPage: true });
const form = page.locator("form").first();
if (await form.count()) {
  for (const inp of await form.locator("input, textarea, select").all()) {
    const t = await inp.getAttribute("type");
    if (t !== "submit" && t !== "file") await inp.fill("اختبار QA").catch(() => {});
  }
  await page.screenshot({ path: path.join(OUT, "contact-320w-form-filled.png"), fullPage: false });
}
await page.context().close();

// topics pagination
const tp = await (await browser.newContext({ viewport: { width: 375, height: 844 } })).newPage();
await tp.goto("http://localhost:3000/topics", { waitUntil: "networkidle" });
await tp.waitForTimeout(1500);
await tp.evaluate(async () => { scrollTo(0, document.body.scrollHeight); await new Promise((r) => setTimeout(r, 500)); });
await tp.screenshot({ path: path.join(OUT, "topics-375w-pagination.png"), fullPage: false });
const next = tp.locator('a:has-text("التالي"), button:has-text("التالي")').first();
if (await next.isVisible().catch(() => false)) {
  await next.click();
  await tp.waitForTimeout(800);
  await tp.screenshot({ path: path.join(OUT, "topics-375w-page2.png"), fullPage: false });
}
await tp.context().close();

await browser.close();
console.log("done");

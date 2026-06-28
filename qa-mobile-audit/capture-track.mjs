import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "issue-shots");
const browser = await chromium.launch();

const page = await (await browser.newContext({ viewport: { width: 320, height: 844 } })).newPage();
await page.goto("http://localhost:3000/track-your-project", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(OUT, "track-320w-full.png"), fullPage: true });
const form = page.locator("form").first();
if (await form.count()) {
  for (const inp of await form.locator("input, textarea, select").all()) {
    const t = await inp.getAttribute("type");
    if (t !== "submit" && t !== "file") await inp.fill("اختبار").catch(() => {});
  }
  await page.screenshot({ path: path.join(OUT, "track-320w-form.png"), fullPage: false });
}
await page.context().close();
await browser.close();

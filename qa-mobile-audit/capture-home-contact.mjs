import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "issue-shots");
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 320, height: 844 } })).newPage();
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.evaluate(() => {
  const el = [...document.querySelectorAll("section,h2")].find((e) => (e.textContent || "").includes("تبحث عن وحدة"));
  el?.scrollIntoView({ block: "center" });
});
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, "home-320w-contact-section.png"), fullPage: false });
await browser.close();

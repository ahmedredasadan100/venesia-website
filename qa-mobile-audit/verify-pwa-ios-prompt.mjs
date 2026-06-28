import { chromium } from "playwright";

const BASE = process.env.PWA_TEST_URL || "http://localhost:3001";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});
const page = await ctx.newPage();
await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 120000 });

const before = await page.evaluate(
  () => !!document.querySelector('[aria-label="تثبيت التطبيق"]'),
);
await page.waitForTimeout(10_500);
const afterDelay = await page.evaluate(
  () => !!document.querySelector('[aria-label="تثبيت التطبيق"]'),
);
await page.mouse.click(20, 20);
await page.waitForTimeout(300);
const afterClick = await page.evaluate(
  () => !!document.querySelector('[aria-label="تثبيت التطبيق"]'),
);

const meta = await page.evaluate(() => ({
  appleCapable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.getAttribute("content"),
  appleTitle: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute("content"),
}));

console.log(JSON.stringify({ before, afterDelay, afterClick, meta }));
await browser.close();

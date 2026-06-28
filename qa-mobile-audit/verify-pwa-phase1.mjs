import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const BASE = process.env.PWA_TEST_URL || "http://localhost:3000";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "output-report");

async function verifyViewport(page, width) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 120000 });

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  const data = await page.evaluate(async () => {
    const manifestLink = document.querySelector('link[rel="manifest"]')?.getAttribute("href") ?? null;
    const themeColor =
      document.querySelector('meta[name="theme-color"]')?.getAttribute("content") ?? null;
    const appleCapable =
      document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.getAttribute("content") ??
      null;

    let manifest = null;
    if (manifestLink) {
      const res = await fetch(manifestLink);
      manifest = res.ok ? await res.json() : { error: res.status };
    }

    let swRegistered = false;
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration("/");
      swRegistered = Boolean(reg);
    }

    const prompt = document.querySelector('[aria-label="تثبيت التطبيق"]');
    return {
      manifestLink,
      themeColor,
      appleCapable,
      manifest,
      swRegistered,
      promptVisible: Boolean(prompt),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  return { width, ...data, consoleErrors: [...new Set(consoleErrors)] };
}

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

const mobileBefore = await verifyViewport(page, 390);
await page.waitForTimeout(10_500);
const mobileAfterDelay = await verifyViewport(page, 390);
await page.evaluate(() => window.scrollTo(0, 120));
await page.waitForTimeout(300);
const mobileAfterScroll = await verifyViewport(page, 390);
const desktop = await verifyViewport(page, 1280);

const assetChecks = [];
for (const asset of [
  "/manifest.webmanifest",
  "/sw.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/apple-touch-icon.png",
]) {
  const res = await page.goto(BASE + asset, { waitUntil: "networkidle" });
  assetChecks.push({ asset, status: res?.status() ?? 0 });
}

await browser.close();

const report = {
  baseUrl: BASE,
  assets: assetChecks,
  viewports: {
    mobileBeforeEngagement: mobileBefore,
    mobileAfterDelay: mobileAfterDelay,
    mobileAfterScroll: mobileAfterScroll,
    desktop: desktop,
  },
};

fs.writeFileSync(path.join(OUT, "pwa-phase1-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

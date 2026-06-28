import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "issue-shots");
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 320, height: 844 } })).newPage();
await page.goto("http://localhost:3000/topics", { waitUntil: "networkidle" });
await page.evaluate(async () => { scrollTo(0, document.body.scrollHeight); await new Promise((r) => setTimeout(r, 500)); });
await page.screenshot({ path: path.join(OUT, "topics-320w-pagination.png"), fullPage: false });
await browser.close();

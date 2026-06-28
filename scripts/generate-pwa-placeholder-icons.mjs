import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TARGETS = [
  { file: "public/icons/icon-32.png", size: 32 },
  { file: "public/icons/icon-192.png", size: 192 },
  { file: "public/icons/icon-512.png", size: 512 },
  { file: "public/apple-touch-icon.png", size: 180 },
];

function iconHtml(size) {
  const ring = Math.round(size * 0.58);
  const fontSize = Math.round(size * 0.3);
  const border = Math.max(2, Math.round(size * 0.03));

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        width: ${size}px;
        height: ${size}px;
        background: #0B0B0B;
        display: grid;
        place-items: center;
      }
      .mark {
        width: ${ring}px;
        height: ${ring}px;
        border-radius: 9999px;
        border: ${border}px solid #D8B87A;
        display: grid;
        place-items: center;
        color: #D8B87A;
        font: 700 ${fontSize}px/1 "Segoe UI", sans-serif;
      }
    </style>
  </head>
  <body>
    <div class="mark">V</div>
  </body>
</html>`;
}

fs.mkdirSync(path.join(ROOT, "public/icons"), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

for (const target of TARGETS) {
  await page.setViewportSize({ width: target.size, height: target.size });
  await page.setContent(iconHtml(target.size), { waitUntil: "load" });
  const output = path.join(ROOT, target.file);
  await page.screenshot({ path: output, type: "png", omitBackground: false });
  console.log("wrote", target.file);
}

await browser.close();

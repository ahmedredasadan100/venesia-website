import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "issue-shots", "qa106");
fs.mkdirSync(OUT, { recursive: true });

const BASE = "http://localhost:3000";
const MOBILE = [320, 360, 390];
const ALL = [320, 360, 375, 390, 412, 430, 768, 1280];

async function scrollToContact(page) {
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("a")].find((a) =>
      (a.textContent || "").includes("تحدث مع مستشار"),
    );
    el?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(500);
}

async function measure(page) {
  return page.evaluate(() => {
    const btn = [...document.querySelectorAll("a")].find((a) =>
      (a.textContent || "").includes("تحدث مع مستشار"),
    );
    const card = btn?.closest("[data-reveal].group.relative.overflow-hidden");
    const content = btn?.closest(".relative.z-10");
    const imgBand = content?.previousElementSibling;
    const br = btn?.getBoundingClientRect();
    const cr = card?.getBoundingClientRect();
    const wr = content?.getBoundingClientRect();
    const ir = imgBand?.getBoundingClientRect();
    const overflow =
      document.documentElement.scrollWidth - document.documentElement.clientWidth;
    return {
      btn: br ? { w: Math.round(br.width), h: Math.round(br.height) } : null,
      card: cr ? { w: Math.round(cr.width), h: Math.round(cr.height) } : null,
      content: wr ? { w: Math.round(wr.width), h: Math.round(wr.height) } : null,
      imgBand: ir ? { w: Math.round(ir.width), h: Math.round(ir.height), visible: ir.height > 0 } : null,
      textOverImage:
        wr && ir ? Math.round(Math.max(0, ir.bottom - wr.top)) : 0,
      pageOverflow: overflow,
    };
  });
}

const browser = await chromium.launch();

for (const vp of MOBILE) {
  const page = await (await browser.newContext({ viewport: { width: vp, height: 844 } })).newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
  await scrollToContact(page);
  await page.screenshot({ path: path.join(OUT, `contact-${vp}px.png`) });
  console.log(JSON.stringify({ vp, shot: `contact-${vp}px.png`, ...(await measure(page)) }));
  await page.context().close();
}

for (const vp of ALL.filter((v) => !MOBILE.includes(v))) {
  const page = await (await browser.newContext({ viewport: { width: vp, height: 844 } })).newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
  await scrollToContact(page);
  console.log(JSON.stringify({ vp, ...(await measure(page)) }));
  await page.context().close();
}

await browser.close();

import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const VIEWPORTS = [320, 360, 375, 390, 412, 430, 768, 1280];

async function measure(page) {
  return page.evaluate(() => {
    const btn = [...document.querySelectorAll("a")].find((a) =>
      (a.textContent || "").includes("تحدث مع مستشار"),
    );
    const card = btn?.closest("[data-reveal].group.relative.overflow-hidden");
    const content = btn?.closest(".relative.z-10");
    const br = btn?.getBoundingClientRect();
    const cr = card?.getBoundingClientRect();
    const wr = content?.getBoundingClientRect();
    const overflow =
      document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const btnOverflowCard =
      br && cr
        ? {
            left: Math.round(br.left - cr.left),
            right: Math.round(cr.right - br.right),
            top: Math.round(br.top - cr.top),
            bottom: Math.round(cr.bottom - br.bottom),
          }
        : null;
    const clipped =
      btnOverflowCard &&
      (btnOverflowCard.left < 0 ||
        btnOverflowCard.right < 0 ||
        btnOverflowCard.top < 0 ||
        btnOverflowCard.bottom < 0);
    return {
      btn: br
        ? { w: Math.round(br.width), h: Math.round(br.height), x: Math.round(br.left), y: Math.round(br.top) }
        : null,
      card: cr ? { w: Math.round(cr.width), h: Math.round(cr.height), x: Math.round(cr.left) } : null,
      content: wr ? { w: Math.round(wr.width), h: Math.round(wr.height) } : null,
      btnOverflowCard,
      clipped,
      pageOverflow: overflow,
    };
  });
}

const browser = await chromium.launch();
for (const vp of VIEWPORTS) {
  const page = await (await browser.newContext({ viewport: { width: vp, height: 844 } })).newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("a")].find((a) =>
      (a.textContent || "").includes("تحدث مع مستشار"),
    );
    el?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(400);
  console.log(JSON.stringify({ vp, ...(await measure(page)) }));
  await page.context().close();
}
await browser.close();

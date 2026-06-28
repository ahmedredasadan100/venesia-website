import { chromium } from "playwright";

const browser = await chromium.launch();
const checks = [];

async function check(vp, path) {
  const page = await (await browser.newContext({ viewport: { width: vp, height: 844 }, locale: "ar-EG" })).newPage();
  await page.goto(`http://localhost:3000${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const data = await page.evaluate(() => {
    const cw = document.documentElement.clientWidth;
    const contact = [...document.querySelectorAll("section")].find((s) => (s.textContent || "").includes("تواصل") || (s.textContent || "").includes("اتصل"));
    const cr = contact?.getBoundingClientRect();
    const contactChildren = contact ? [...contact.querySelectorAll("h2,p,div")].slice(0, 6).map((el) => {
      const r = el.getBoundingClientRect();
      return { tag: el.tagName, w: Math.round(r.width), text: (el.textContent || "").trim().slice(0, 40), clip: el.scrollWidth > el.clientWidth + 2 };
    }) : [];
    const hero = document.querySelector("section");
    const hr = hero?.getBoundingClientRect();
    const reveal = [...document.querySelectorAll("[data-reveal]")].filter((el) => getComputedStyle(el).opacity !== "1").length;
    const pag = [...document.querySelectorAll("a,button")].some((el) => (el.textContent || "").includes("التالي"));
    return {
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - cw,
      heroH: hr ? Math.round(hr.height) : 0,
      vh: innerHeight,
      contactW: cr ? Math.round(cr.width) : null,
      contactChildren,
      revealHidden: reveal,
      hasPagination: pag,
      forms: [...document.querySelectorAll("form")].map((f) => ({
        fields: f.querySelectorAll("input,textarea,select").length,
        action: f.getAttribute("action"),
      })),
    };
  });
  checks.push({ vp, path, ...data });
  await page.context().close();
}

for (const vp of [320, 360, 375, 390, 768]) {
  for (const p of ["/", "/contact", "/projects", "/topics", "/track-your-project"]) {
    await check(vp, p);
  }
}
await browser.close();
console.log(JSON.stringify(checks, null, 2));

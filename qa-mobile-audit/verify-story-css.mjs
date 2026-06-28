import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 60000 });
const data = await page.evaluate(() => {
  const mainWrap = document.querySelector('img[src*="story-main"]')?.parentElement;
  const secWrap = document.querySelector('img[src*="story-secondary"]')?.parentElement;
  const container = mainWrap?.parentElement;
  const story = container?.closest("section");
  return {
    sectionClasses: story?.className,
    containerClasses: container?.className,
    mainClasses: mainWrap?.className,
    secClasses: secWrap?.className,
    main: mainWrap ? { w: Math.round(mainWrap.getBoundingClientRect().width), h: Math.round(mainWrap.getBoundingClientRect().height) } : null,
    sec: secWrap ? { w: Math.round(secWrap.getBoundingClientRect().width), h: Math.round(secWrap.getBoundingClientRect().height) } : null,
  };
});
console.log(JSON.stringify(data, null, 2));
await browser.close();

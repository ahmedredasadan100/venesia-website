const res = await fetch("http://localhost:3000/topics", {
  headers: { "Cache-Control": "no-cache" },
});
console.log("HTTP", res.status);
const html = await res.text();

const checks = [
  ["Search panel", "ابحث في الموضوعات"],
  ["Categories feed", "مواضيع تهمك"],
  ["Latest feed", "أحدث الموضوعات"],
  ["Popular feed", "الأكثر قراءة"],
  ["Series feed", "سلاسل المحتوى"],
  ["Test feed title", "اختبار Feed — أحدث"],
  ["Test topic 1", "موضوع اختبار Feed 1"],
  ["Test topic 2", "موضوع اختبار Feed 2"],
  ["CMS layout sidebar slot", 'data-layout-slot="sidebar"'],
  ["Main sidebar grid", "page-layout--main-sidebar"],
];

let failed = 0;
for (const [label, needle] of checks) {
  const pass = html.includes(needle);
  console.log(`${pass ? "✓" : "✗"} ${label}`);
  if (!pass) failed++;
}

process.exit(failed ? 1 : 0);

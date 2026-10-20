import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createJiti } from "jiti";

const {
  markdownToRichTextHtml,
  normalizeArticleMarkdown,
  plainTextToMarkdown,
  renderRichTextHtml,
  renderArticleMarkdownHtml,
  richTextHtmlToMarkdown,
} = await createJiti(import.meta.url, { fsCache: false, moduleCache: false })
  .import<typeof import("../src/lib/rich-text/html-utils.ts")>("../src/lib/rich-text/html-utils.ts");

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

const markdown = [
  "# عنوان المقال",
  "فقرة فيها **نص عريض**",
  "سطر داخل نفس الفقرة",
  "",
  "## قسم رئيسي",
  "### قسم فرعي",
  "- عنصر أول",
  "- عنصر ثان",
  "",
  "1. خطوة أولى",
  "2. خطوة ثانية",
  "",
  "[رابط داخلي](/topics/example)",
].join("\n");

const rendered = renderArticleMarkdownHtml(markdown);
check("Markdown headings render as semantic headings", rendered.includes("<h1>") && rendered.includes("<h2>") && rendered.includes("<h3>"));
check("Markdown bold renders without visible literals", rendered.includes("<strong>نص عريض</strong>") && !rendered.includes("**"));
check("single newlines remain line breaks inside one paragraph", rendered.includes("</strong><br />سطر داخل نفس الفقرة"));
check("lists render with semantic owners", rendered.includes("<ul><li>عنصر أول</li><li>عنصر ثان</li></ul>") && rendered.includes("<ol><li>خطوة أولى</li><li>خطوة ثانية</li></ol>"));
check("safe links receive the shared safety attributes", rendered.includes('href="/topics/example"') && rendered.includes('rel="noopener noreferrer"') && rendered.includes('target="_blank"'));

const unsafe = renderArticleMarkdownHtml("[خطر](javascript:alert(1)) <script>alert(1)</script>");
check("unsafe links and raw scripts never become executable HTML", !unsafe.includes('href="javascript:') && !unsafe.includes("<script"));

const malformedExisting = [
  "****سؤال مهم؟**",
  "**## عنوان قسم",
  "**فقرة عريضة",
  "**",
].join("\n");
const recovered = renderArticleMarkdownHtml(malformedExisting);
check("legacy malformed markers recover without leaking Markdown literals", recovered.includes("<h2>عنوان قسم</h2>") && !recovered.includes("**"));

const editorHtml = markdownToRichTextHtml(markdown);
const roundTrip = richTextHtmlToMarkdown(editorHtml);
check("visual editor serialization retains the Markdown storage contract", roundTrip.includes("**نص عريض**") && roundTrip.includes("## قسم رئيسي") && roundTrip.includes("- عنصر أول") && roundTrip.includes("[رابط داخلي](/topics/example)"));
check("Enter and Shift+Enter storage semantics remain distinct", richTextHtmlToMarkdown("<p>فقرة أولى</p><p>فقرة ثانية<br />سطر داخلي</p>") === "فقرة أولى\n\nفقرة ثانية\nسطر داخلي");


// Regression: distinguish literal text nodes from marks through repeated saves.
const roundTripCases = [
  ["aligned line break", '<p style="text-align: center">الأول<br /><u>الثاني</u></p><p>فقرة مستقلة</p>', '<p style="text-align: center">الأول<br /><u>الثاني</u></p><p>فقرة مستقلة</p>'],
  ["aligned literal continuation", '<p style="text-align: left">الأول<br />*حرفي* &lt;tag&gt;</p>', '<p style="text-align: left">الأول<br />*حرفي* &lt;tag&gt;</p>'],
  ["underline", "<p><u>تحته خط</u></p>", "<p><u>تحته خط</u></p>"],
  ["literal stars", "<p>نص *حرفي* محفوظ</p>", "<p>نص *حرفي* محفوظ</p>"],
  ["literal angle brackets", "<p>نص &lt;tag&gt; محفوظ</p>", "<p>نص &lt;tag&gt; محفوظ</p>"],
  ["combined marks", "<p><strong><em><u>تنسيق</u></em></strong></p>", "<p><strong><em><u>تنسيق</u></em></strong></p>"],
  ["literal underline syntax", "<p>&lt;u&gt;حرفي&lt;/u&gt;</p>", "<p>&lt;u&gt;حرفي&lt;/u&gt;</p>"],
  ["literal entities", "<p>&amp;lt;tag&amp;gt; &amp;amp;</p>", "<p>&amp;lt;tag&amp;gt; &amp;amp;</p>"],
  ["numeric text entities", "<p>&#60;tag&#62; &#42;نص&#42;</p>", "<p>&lt;tag&gt; *نص*</p>"],
  ["escaped block syntax", "<p># عنوان حرفي<br />1. سطر حرفي<br />- شرطة<br />::left:: نص</p>", "<p># عنوان حرفي<br />1. سطر حرفي<br />- شرطة<br />::left:: نص</p>"],
] as const;
for (const [name, initialHtml, expectedHtml] of roundTripCases) {
  let current = initialHtml as string;
  for (let cycle = 0; cycle < 3; cycle += 1) {
    const stored = richTextHtmlToMarkdown(current);
    assert.equal(normalizeArticleMarkdown(stored), stored, name + " must not be mistaken for legacy HTML");
    assert.equal(renderArticleMarkdownHtml(stored), expectedHtml, name + " public cycle " + cycle);
    current = markdownToRichTextHtml(normalizeArticleMarkdown(stored));
    assert.equal(current, expectedHtml, name + " editor cycle " + cycle);
  }
  check(name + " preserves text and marks for three save/reload cycles", true);
}
check("ordinary punctuation retains existing Article serialization", richTextHtmlToMarkdown("<p>Authored core paragraph.</p>") === "Authored core paragraph.");
check("entity-decoded text cannot collide with serialization placeholders", renderArticleMarkdownHtml(richTextHtmlToMarkdown("<p>&#86;ENESIABLOCK0END VENESIAESCAPE0END</p><p><u>خط</u></p>")) === "<p>VENESIABLOCK0END VENESIAESCAPE0END</p><p><u>خط</u></p>");
const legacyPlain = "*حرفي* <tag> &lt;tag&gt; \\ _نص_ [رابط](/about)\n# عنوان حرفي";
const escapedLegacy = plainTextToMarkdown(legacyPlain);
check("legacy plain text is escaped at the shared boundary without interpreting it", renderArticleMarkdownHtml(escapedLegacy) === "<p>*حرفي* &lt;tag&gt; &amp;lt;tag&amp;gt; \\ _نص_ [رابط](/about)<br /># عنوان حرفي</p>");
check("escaped punctuation and actual formatting can coexist", renderArticleMarkdownHtml("**عريض** " + plainTextToMarkdown("*حرفي*")) === "<p><strong>عريض</strong> *حرفي*</p>");
check("HTML consumer semantics retain marks and literal text", renderRichTextHtml('<p><strong>عريض</strong> <em>مائل</em> <u>خط</u> &lt;tag&gt; *حرفي*</p>') === '<p><strong>عريض</strong> <em>مائل</em> <u>خط</u> &lt;tag&gt; *حرفي*</p>');
for (const input of ['<script>alert(1)</script><p onclick="alert(1)">نص</p>', '<p><a href="javascript:alert(1)">خطر</a></p>', '<p><img src=x onerror=alert(1)>نص</p>', '<u onclick="alert(1)">خط</u>']) {
  for (const html of [renderRichTextHtml(input), renderArticleMarkdownHtml(richTextHtmlToMarkdown(input))]) {
    assert.ok(!/<script|<img|\son\w+=|href="javascript:/i.test(html));
  }
}
check("HTML and Markdown remain inside the shared sanitization contract", true);

const sharedEditor = read("src/components/admin/AdminRichTextEditor.tsx");
const articleEditor = read("src/components/admin/content/editors/article/TopicMarkdownEditor.tsx");
const richTextOwner = read("src/components/content/RichTextContent.tsx");
const adminPreview = read("src/app/admin/content/topics/[id]/preview/page.tsx");
const publicPage = read("src/app/(site)/topics/[slug]/page.tsx");
const styles = read("src/app/globals.css");

check("Article adopts the existing visual editor exactly once", articleEditor.match(/<AdminRichTextEditor\b/g)?.length === 1 && articleEditor.includes('storageFormat="markdown"') && articleEditor.includes("enableArticleStructure"));
check("shared editor owns Article structure and RTL behavior", ["toggleHeading({ level: 2 })", "toggleHeading({ level: 3 })", "toggleBold()", "toggleBulletList()", "toggleOrderedList()", "setLink", 'dir: "rtl"'].every((token) => sharedEditor.includes(token)));
check("shared link editing uses an inline safe control instead of a browser prompt", !sharedEditor.includes("window.prompt") && sharedEditor.includes("data-admin-rich-text-link-editor") && sharedEditor.includes('aria-label="عنوان الرابط"'));
check("Block 25 HTML remains the default editor contract", sharedEditor.includes('storageFormat = "html"'));
check("Article rendering stays in the existing sanitized content owner", richTextOwner.includes('mode === "markdown"') && richTextOwner.includes("renderArticleMarkdownHtml"));
check("Admin Preview and public Article use the same Markdown renderer", [adminPreview, publicPage].every((source) => source.includes("<RichTextContent") && source.includes('mode="markdown"')));
check("Article vertical rhythm is shared and responsive", styles.includes(".rich-text-content.article-rich-text") && styles.includes("p + p") && styles.includes("@media (max-width: 640px)"));
check("retired line-by-line presentation owners are absent", !adminPreview.includes("function renderMarkdown") && !publicPage.includes("function renderContent"));

console.log(`verify:article-rich-content passed (${passed} assertions)`);

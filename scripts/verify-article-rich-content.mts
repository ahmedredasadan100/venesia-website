import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  markdownToRichTextHtml,
  renderArticleMarkdownHtml,
  richTextHtmlToMarkdown,
} from "../src/lib/rich-text/html-utils.ts";

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

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type TopicMarkdownEditorProps = {
  defaultValue?: string;
};

type ViewMode = "write" | "preview" | "split";

type EditorStats = {
  words: number;
  chars: number;
  paragraphs: number;
  readingMinutes: number;
  h1: number;
  h2: number;
  h3: number;
};

const STORAGE_PREFIX = "venesia-topic-editor-draft";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeBasicHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function normalizeInitialContent(value: string) {
  const source = value.replace(/\r\n/g, "\n");

  if (!/<\/?(p|h[1-6]|div|br|ul|ol|li|blockquote)\b/i.test(source)) {
    return source;
  }

  return decodeBasicHtmlEntities(source)
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, content) => `# ${stripHtml(content).trim()}\n\n`)
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, content) => `## ${stripHtml(content).trim()}\n\n`)
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, content) => `### ${stripHtml(content).trim()}\n\n`)
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
      const clean = stripHtml(content)
        .replace(/\s+/g, " ")
        .trim();
      return clean ? `> ${clean}\n\n` : "\n\n";
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/div>/gi, "\n\n")
    .replace(/<div[^>]*>/gi, "")
    .replace(/<\/?(ul|ol)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizePlainText(value: string) {
  return stripHtml(value)
    .replace(/\[[^\]]+\]\(([^)]+)\)/g, " ")
    .replace(/[#>*_`~\-[\]()]|\d+\.\s/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTextStats(value: string): EditorStats {
  const plainText = normalizePlainText(value);
  const words = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
  const paragraphs = value
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/g)
    .map((item) => normalizePlainText(item))
    .filter(Boolean).length;

  return {
    words,
    chars: plainText.length,
    paragraphs,
    readingMinutes: words > 0 ? Math.max(1, Math.ceil(words / 220)) : 0,
    h1: value.match(/^#\s+/gm)?.length ?? 0,
    h2: value.match(/^##\s+/gm)?.length ?? 0,
    h3: value.match(/^###\s+/gm)?.length ?? 0,
  };
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^(https?:\/\/|mailto:|\/)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function inlineMarkdownToHtml(value: string) {
  let output = escapeHtml(value);

  output = output.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+|mailto:[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  output = output.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/__(.+?)__/g, "<strong>$1</strong>");
  output = output.replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/g, "<u>$1</u>");
  output = output.replace(/\*(.+?)\*/g, "<em>$1</em>");
  output = output.replace(/_(.+?)_/g, "<em>$1</em>");

  return output;
}

function markdownToHtml(markdown: string) {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  if (!normalized) return '<p class="empty-preview">ابدأ كتابة المقال لتظهر المعاينة هنا.</p>';

  const lines = normalized.split("\n");
  const html: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let paragraphLines: string[] = [];

  function closeList() {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = null;
  }

  function closeParagraph() {
    if (!paragraphLines.length) return;
    html.push(`<p>${paragraphLines.map(inlineMarkdownToHtml).join("<br />")}</p>`);
    paragraphLines = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      closeParagraph();
      closeList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      closeParagraph();
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdownToHtml(heading[2])}</h${level}>`);
      continue;
    }

    const quote = /^>\s*(.+)$/.exec(line);
    if (quote) {
      closeParagraph();
      closeList();
      html.push(`<blockquote><p>${inlineMarkdownToHtml(quote[1])}</p></blockquote>`);
      continue;
    }

    const unordered = /^[-*]\s+(.+)$/.exec(line);
    if (unordered) {
      closeParagraph();
      if (listType !== "ul") {
        closeList();
        listType = "ul";
        html.push("<ul>");
      }
      html.push(`<li>${inlineMarkdownToHtml(unordered[1])}</li>`);
      continue;
    }

    const ordered = /^\d+\.\s+(.+)$/.exec(line);
    if (ordered) {
      closeParagraph();
      if (listType !== "ol") {
        closeList();
        listType = "ol";
        html.push("<ol>");
      }
      html.push(`<li>${inlineMarkdownToHtml(ordered[1])}</li>`);
      continue;
    }

    closeList();
    paragraphLines.push(line);
  }

  closeParagraph();
  closeList();
  return html.join("\n") || '<p class="empty-preview">ابدأ كتابة المقال لتظهر المعاينة هنا.</p>';
}

function getDraftKey() {
  if (typeof window === "undefined") return `${STORAGE_PREFIX}:default`;
  return `${STORAGE_PREFIX}:${window.location.pathname}`;
}

function replaceSelection(textarea: HTMLTextAreaElement, content: string, before: string, after = before) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = content.slice(start, end);
  const inserted = `${before}${selected || "نص"}${after}`;
  const next = `${content.slice(0, start)}${inserted}${content.slice(end)}`;
  const cursor = start + inserted.length;
  return { next, cursor };
}

function prefixSelection(textarea: HTMLTextAreaElement, content: string, prefix: string) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = content.slice(start, end) || "سطر جديد";
  const blockStart = content.lastIndexOf("\n", start - 1) + 1;
  const blockEndIndex = content.indexOf("\n", end);
  const blockEnd = blockEndIndex === -1 ? content.length : blockEndIndex;
  const block = content.slice(blockStart, blockEnd) || selected;
  const nextBlock = block
    .split("\n")
    .map((line) => `${prefix}${line.replace(/^#{1,3}\s+|^[-*]\s+|^\d+\.\s+|^>\s+/, "")}`)
    .join("\n");
  const next = `${content.slice(0, blockStart)}${nextBlock}${content.slice(blockEnd)}`;
  return { next, cursor: blockStart + nextBlock.length };
}

function MiniCounter({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-black/25 px-4 py-3 text-center">
      <p className="font-en text-2xl font-semibold text-[#D8B87A]">{value}</p>
      <p className="mt-1 text-xs text-white/40">{label}</p>
    </div>
  );
}

function SegmentButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl px-4 py-2 text-xs font-semibold transition",
        active
          ? "bg-[#D8B87A] text-[#080B10] shadow-[0_14px_34px_rgba(216,184,122,0.22)]"
          : "text-white/55 hover:bg-white/[0.06] hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function ToolButton({ label, title, onClick }: { label: string; title?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title ?? label}
      onClick={onClick}
      className="min-w-10 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-semibold text-white/72 transition hover:border-[#D8B87A]/35 hover:bg-[#D8B87A]/10 hover:text-[#F2D99B]"
    >
      {label}
    </button>
  );
}

function PreviewPane({ content }: { content: string }) {
  return (
    <article
      className="venesia-article-preview min-h-[620px] rounded-[24px] border border-white/10 bg-[#F4EFE5] px-7 py-7 text-[#111827] shadow-inner"
      dir="rtl"
      dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }}
    />
  );
}

function MarkdownEditor({ content, setContent }: { content: string; setContent: (value: string) => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function updateWithCursor(next: string, cursor?: number) {
    setContent(next);
    window.requestAnimationFrame(() => {
      if (cursor !== undefined && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(cursor, cursor);
      }
    });
  }

  function wrap(before: string, after = before) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const result = replaceSelection(textarea, content, before, after);
    updateWithCursor(result.next, result.cursor);
  }

  function prefix(prefixValue: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const result = prefixSelection(textarea, content, prefixValue);
    updateWithCursor(result.next, result.cursor);
  }

  function addLink() {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end).trim();
    const href = normalizeUrl(
      window.prompt("أدخل الرابط الداخلي أو الخارجي", selected ? "https://" : "/") ?? "",
    );

    if (!href) return;

    const linkText = selected || window.prompt("اكتب نص الرابط", "نص الرابط")?.trim() || "نص الرابط";
    const inserted = `[${linkText}](${href})`;
    updateWithCursor(`${content.slice(0, start)}${inserted}${content.slice(end)}`, start + inserted.length);
  }

  function addCta() {
    const trimmed = content.trimEnd();
    const cta = `${trimmed ? "\n\n" : ""}الثقة مش وعد… الثقة فعل.\n`;
    updateWithCursor(`${trimmed}${cta}`, `${trimmed}${cta}`.length);
  }

  function clearFormat() {
    const clean = content
      .replace(/^#{1,3}\s+/gm, "")
      .replace(/^[-*]\s+/gm, "")
      .replace(/^\d+\.\s+/gm, "")
      .replace(/^>\s+/gm, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/__(.*?)__/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/_(.*?)_/g, "$1")
      .replace(/<u>(.*?)<\/u>/g, "$1");
    updateWithCursor(clean, clean.length);
  }

  return (
    <div className="rounded-[26px] border border-[#D8B87A]/14 bg-[#070A0F]/80 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div className="sticky top-4 z-20 flex flex-wrap gap-2 rounded-t-[26px] border-b border-white/10 bg-[#070A0F]/95 p-3 backdrop-blur-xl">
        <ToolButton label="H1" title="عنوان رئيسي" onClick={() => prefix("# ")} />
        <ToolButton label="H2" title="عنوان فرعي" onClick={() => prefix("## ")} />
        <ToolButton label="H3" title="عنوان تفصيلي" onClick={() => prefix("### ")} />
        <span className="mx-1 h-9 w-px bg-white/10" />
        <ToolButton label="B" title="Bold" onClick={() => wrap("**")} />
        <ToolButton label="I" title="Italic" onClick={() => wrap("*")} />
        <ToolButton label="U" title="Underline" onClick={() => wrap("<u>", "</u>")} />
        <span className="mx-1 h-9 w-px bg-white/10" />
        <ToolButton label="• List" title="قائمة نقطية" onClick={() => prefix("- ")} />
        <ToolButton label="1. List" title="قائمة رقمية" onClick={() => prefix("1. ")} />
        <ToolButton label="Quote" title="اقتباس" onClick={() => prefix("> ")} />
        <ToolButton label="Link" title="رابط" onClick={addLink} />
        <ToolButton label="CTA" title="إضافة خاتمة فينيسيا" onClick={addCta} />
        <ToolButton label="Clear" title="إزالة التنسيق" onClick={clearFormat} />
      </div>

      <textarea
        ref={textareaRef}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        dir="rtl"
        spellCheck
        placeholder="ابدأ كتابة المقال هنا بصيغة Markdown... مثال: # عنوان المقال ثم الفقرات والعناوين الفرعية."
        className="min-h-[680px] w-full resize-y rounded-b-[26px] border-0 bg-[#0B0F14] px-7 py-7 text-[15px] leading-9 text-white/88 outline-none placeholder:text-white/25"
      />
    </div>
  );
}

function AnalysisCard({ stats }: { stats: EditorStats }) {
  return (
    <aside className="space-y-4">
      <div className="rounded-[22px] border border-white/10 bg-black/25 p-5">
        <p className="text-sm font-semibold text-[#D8B87A]">قراءة فنية سريعة</p>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-white/50">
          <li>استخدم H1 واحد فقط بصيغة # عنوان المقال.</li>
          <li>استخدم H2 للعناوين الرئيسية داخل المقال.</li>
          <li>اترك سطرًا فارغًا بين الفقرات الطويلة.</li>
          <li>المحتوى المثالي من 800 إلى 1800 كلمة.</li>
        </ul>
      </div>

      <div className="rounded-[22px] border border-white/10 bg-black/25 p-5">
        <p className="text-sm font-semibold text-white">تحليل مباشر</p>
        <div className="mt-4 space-y-3 text-sm">
          <CheckLine label="عنوان H1 في المحتوى" active={stats.h1 === 1} warning={stats.h1 > 1 ? "يوجد أكثر من H1. الأفضل عنوان رئيسي واحد فقط." : "اختياري — عنوان المقال موجود في حقل Title. أضف # عنوان داخل المحتوى فقط إن احتجت هيكلة Markdown."} />
          <CheckLine label="عناوين H2 كافية" active={stats.h2 >= 2} warning="ينصح بوجود عنوانين فرعيين على الأقل." />
          <CheckLine label="تفاصيل H3" active={stats.h3 >= 1} warning="اختياري لكنه مفيد للمقالات الطويلة." />
          <CheckLine label="طول المحتوى" active={stats.chars >= 300} warning="تحذير للنشر: الحد الأدنى المبدئي 300 حرف — لا يمنع حفظ المسودة." />
        </div>
      </div>
    </aside>
  );
}

function CheckLine({ label, active, warning }: { label: string; active: boolean; warning?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3">
      <p className={active ? "text-emerald-200" : "text-[#F2D99B]"}>
        {active ? "✓ " : "⚠ "}
        {label}
      </p>
      {!active && warning ? <p className="mt-1 text-xs leading-5 text-white/35">{warning}</p> : null}
    </div>
  );
}

export default function TopicMarkdownEditor({ defaultValue = "" }: TopicMarkdownEditorProps) {
  const normalizedDefaultValue = useMemo(() => normalizeInitialContent(defaultValue), [defaultValue]);
  const [content, setContent] = useState(normalizedDefaultValue);
  const [viewMode, setViewMode] = useState<ViewMode>("write");
  const [draftRestored, setDraftRestored] = useState(false);
  const draftKeyRef = useRef<string>("");

  useEffect(() => {
    draftKeyRef.current = getDraftKey();
    const savedDraft = window.localStorage.getItem(draftKeyRef.current);
    const normalizedSavedDraft = savedDraft ? normalizeInitialContent(savedDraft) : "";

    if (normalizedSavedDraft && normalizedSavedDraft !== normalizedDefaultValue) {
      setContent(normalizedSavedDraft);
      setDraftRestored(true);
      return;
    }

    setContent(normalizedDefaultValue);
  }, [normalizedDefaultValue]);

  useEffect(() => {
    if (!draftKeyRef.current) return;
    window.localStorage.setItem(draftKeyRef.current, content);
  }, [content]);

  const stats = useMemo(() => getTextStats(content), [content]);
  const showEditor = viewMode === "write" || viewMode === "split";
  const showPreview = viewMode === "preview" || viewMode === "split";

  const setCleanContent = useCallback((value: string) => {
    setContent(value.replace(/\r\n/g, "\n"));
  }, []);

  return (
    <section className="rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
      <style jsx global>{`
        .venesia-article-preview .empty-preview {
          color: rgba(17, 24, 39, 0.5);
        }
        .venesia-article-preview h1 {
          margin: 0 0 26px;
          font-size: 32px;
          line-height: 1.55;
          font-weight: 800;
          color: #111827;
        }
        .venesia-article-preview h2 {
          margin: 34px 0 16px;
          font-size: 25px;
          line-height: 1.65;
          font-weight: 750;
          color: #1b1b1b;
        }
        .venesia-article-preview h3 {
          margin: 28px 0 12px;
          font-size: 20px;
          line-height: 1.7;
          font-weight: 700;
          color: #242424;
        }
        .venesia-article-preview p {
          margin: 0 0 18px;
          font-size: 16px;
          line-height: 2.05;
          color: #27313f;
          white-space: normal;
        }
        .venesia-article-preview ul,
        .venesia-article-preview ol {
          margin: 0 0 22px;
          padding-right: 24px;
          color: #27313f;
          line-height: 2;
        }
        .venesia-article-preview blockquote {
          margin: 26px 0;
          border-right: 4px solid #d8b87a;
          border-left: 0;
          background: rgba(216, 184, 122, 0.12);
          border-radius: 18px;
          padding: 18px 22px;
          color: #1b1b1b;
        }
        .venesia-article-preview a {
          color: #8a6428;
          text-decoration: underline;
          text-underline-offset: 4px;
          font-weight: 700;
        }
      `}</style>

      <input type="hidden" name="content" value={content} />

      <div className="flex flex-col gap-5 border-b border-white/10 pb-6 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="font-en text-xs tracking-[0.34em] text-[#D8B87A]/70">ARTICLE BODY</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">محتوى المقال</h3>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-white/50">
            محرر Markdown ثابت ومتوافق مع المقالات القديمة وقواعد الحفظ الحالية. اكتب العنوان الرئيسي بصيغة # عنوان المقال.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniCounter label="كلمة" value={stats.words} />
          <MiniCounter label="حرف" value={stats.chars} />
          <MiniCounter label="دقيقة" value={stats.readingMinutes} />
          <MiniCounter label="فقرة" value={stats.paragraphs} />
        </div>
      </div>

      {draftRestored ? (
        <div className="mt-5 rounded-[20px] border border-[#D8B87A]/20 bg-[#D8B87A]/10 px-5 py-4 text-sm leading-7 text-[#F2D99B]">
          تم استرجاع آخر مسودة محفوظة محليًا لهذا المقال حتى لا تفقد ما كتبته بعد أخطاء الحفظ.
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-4 rounded-[24px] border border-white/10 bg-black/25 p-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="rounded-[20px] border border-[#D8B87A]/15 bg-[#05070B] px-4 py-3 text-sm font-semibold text-[#D8B87A]">
          محرر Markdown
        </div>

        <div className="flex flex-wrap gap-2 rounded-[20px] bg-[#05070B] p-1">
          <SegmentButton active={viewMode === "write"} onClick={() => setViewMode("write")}>كتابة</SegmentButton>
          <SegmentButton active={viewMode === "preview"} onClick={() => setViewMode("preview")}>معاينة</SegmentButton>
          <SegmentButton active={viewMode === "split"} onClick={() => setViewMode("split")}>كتابة + معاينة</SegmentButton>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(260px,3fr)] xl:items-start">
        <div className="min-w-0 space-y-5">
          <div className={["grid gap-5", viewMode === "split" ? "xl:grid-cols-2" : ""].join(" ")}>
            {showEditor ? <MarkdownEditor content={content} setContent={setCleanContent} /> : null}
            {showPreview ? <PreviewPane content={content} /> : null}
          </div>

          <div className="rounded-[22px] border border-white/10 bg-black/20 p-5 text-sm leading-7 text-white/45">
            الصورة الرئيسية للموضوع تظل من الحقل الحالي في الصفحة. الصور داخل المقال والروابط الداخلية الذكية يمكن إضافتها لاحقًا كمرحلة مستقلة بدون خلط HTML مع Markdown.
          </div>
        </div>

        <aside className="min-w-0 xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto">
          <AnalysisCard stats={stats} />
        </aside>
      </div>
    </section>
  );
}

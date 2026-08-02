"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminFormError } from "../../../ui/AdminFormRuntime";

export type AdminPublicRichContentEditorProps = {
  defaultValue?: string;
  variant?: "default" | "compact";
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
  internalLinks: number;
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
    .replace(/^::(?:right|center|left|justify)::\s*/gm, "")
    .replace(/[#>*_`~\-[\]()]|\d+\.\s/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTextStats(value: string): EditorStats {
  const plainText = normalizePlainText(value);
  const words = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
  const markdownInternalLinks = value.match(/(?<!!)\[[^\]]+\]\(\/(?!\/)[^)\s]+\)/g)?.length ?? 0;
  const htmlInternalLinks = value.match(/<a\b[^>]*\bhref=["']\/(?!\/)[^"']*["'][^>]*>/gi)?.length ?? 0;
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
    internalLinks: markdownInternalLinks + htmlInternalLinks,
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

    const aligned = /^::(right|center|left|justify)::\s*(.+)$/.exec(line);
    if (aligned) {
      closeParagraph();
      closeList();
      html.push(`<p style="text-align:${aligned[1]}">${inlineMarkdownToHtml(aligned[2])}</p>`);
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

function MiniCounter({ label, value, compact = false, warning = false }: { label: string; value: number | string; compact?: boolean; warning?: boolean }) {
  return (
    <div data-topic-stat={label} className={`${compact ? "rounded-lg px-2 py-1.5" : "rounded-[18px] px-4 py-3"} border bg-black/25 text-center ${warning ? "border-amber-400/30" : "border-white/10"}`}>
      <p className={`font-en font-semibold ${warning ? "text-amber-300" : "text-[#D8B87A]"} ${compact ? "text-sm" : "text-2xl"}`}>{value}</p>
      <p className={`${compact ? "text-[10px]" : "mt-1 text-xs"} text-white/40`}>{label}</p>
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

function PreviewPane({ content, compact = false }: { content: string; compact?: boolean }) {
  return (
    <article
      className={`venesia-article-preview rounded-xl border border-white/10 bg-[#F4EFE5] text-[#111827] shadow-inner ${compact ? "min-h-72 px-5 py-5" : "min-h-[620px] px-7 py-7"}`}
      dir="rtl"
      dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }}
    />
  );
}

function MarkdownEditor({ content, setContent, compact = false }: { content: string; setContent: (value: string) => void; compact?: boolean }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<string[]>([content]);
  const historyIndexRef = useRef(0);

  function updateWithCursor(next: string, cursor?: number, record = true) {
    if (record && historyRef.current[historyIndexRef.current] !== next) {
      historyRef.current = [...historyRef.current.slice(0, historyIndexRef.current + 1), next].slice(-80);
      historyIndexRef.current = historyRef.current.length - 1;
    }
    setContent(next);
    window.requestAnimationFrame(() => {
      if (cursor !== undefined && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(cursor, cursor);
      }
    });
  }

  function undo() {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    updateWithCursor(historyRef.current[historyIndexRef.current], undefined, false);
  }

  function redo() {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    updateWithCursor(historyRef.current[historyIndexRef.current], undefined, false);
  }

  function paragraph() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = content.lastIndexOf("\n", textarea.selectionStart - 1) + 1;
    const endIndex = content.indexOf("\n", textarea.selectionEnd);
    const end = endIndex < 0 ? content.length : endIndex;
    const block = content.slice(start, end).replace(/^::(?:right|center|left|justify)::\s*|^#{1,3}\s+|^[-*]\s+|^\d+\.\s+|^>\s+/gm, "");
    updateWithCursor(`${content.slice(0, start)}${block}${content.slice(end)}`, start + block.length);
  }

  function handleEditorKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter") return;
    const textarea = event.currentTarget;
    const lineStart = content.lastIndexOf("\n", textarea.selectionStart - 1) + 1;
    const line = content.slice(lineStart, textarea.selectionStart);
    const ordered = /^(\d+)\.\s+/.exec(line);
    const unordered = /^[-*]\s+/.exec(line);
    if (!ordered && !unordered) return;
    event.preventDefault();
    const prefixValue = ordered ? `${Number(ordered[1]) + 1}. ` : "- ";
    const next = `${content.slice(0, textarea.selectionStart)}\n${prefixValue}${content.slice(textarea.selectionEnd)}`;
    updateWithCursor(next, textarea.selectionStart + prefixValue.length + 1);
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
    <div className={`border border-[#D8B87A]/14 bg-[#070A0F]/80 ${compact ? "rounded-xl" : "rounded-[26px] shadow-[0_24px_70px_rgba(0,0,0,0.28)]"}`}>
      <div className={`z-20 flex flex-wrap border-b border-white/10 bg-[#070A0F]/95 backdrop-blur-xl ${compact ? "gap-1.5 rounded-t-xl p-2" : "sticky top-4 gap-2 rounded-t-[26px] p-3"}`}>
        <ToolButton label="فقرة" title="فقرة" onClick={paragraph} />
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
        <ToolButton label="Link" title="رابط" onClick={addLink} />
        <span className="mx-1 h-9 w-px bg-white/10" />
        <ToolButton label="يمين" title="محاذاة لليمين" onClick={() => prefix("::right:: ")} />
        <ToolButton label="وسط" title="محاذاة للوسط" onClick={() => prefix("::center:: ")} />
        <ToolButton label="يسار" title="محاذاة لليسار" onClick={() => prefix("::left:: ")} />
        <ToolButton label="ضبط" title="ضبط النص" onClick={() => prefix("::justify:: ")} />
        <ToolButton label="تراجع" title="Undo" onClick={undo} />
        <ToolButton label="إعادة" title="Redo" onClick={redo} />
        <ToolButton label="Clear" title="إزالة التنسيق" onClick={clearFormat} />
      </div>

      <textarea
        id="topic-content-markdown"
        ref={textareaRef}
        value={content}
        onChange={(event) => updateWithCursor(event.target.value)}
        onKeyDown={handleEditorKeyDown}
        dir="rtl"
        spellCheck
        placeholder="ابدأ كتابة المقال هنا بصيغة Markdown... مثال: # عنوان المقال ثم الفقرات والعناوين الفرعية."
        className={`w-full resize-y border-0 bg-[#0B0F14] text-sm text-white/88 outline-none placeholder:text-white/25 ${compact ? "min-h-72 rounded-b-xl px-4 py-4 leading-7" : "min-h-[680px] rounded-b-[26px] px-7 py-7 text-[15px] leading-9"}`}
      />
    </div>
  );
}

/** Canonical detailed Markdown owner for structured public content in the Admin. */
export function AdminPublicRichContentEditor({ defaultValue = "", variant = "default" }: AdminPublicRichContentEditorProps) {
  const normalizedDefaultValue = useMemo(() => normalizeInitialContent(defaultValue), [defaultValue]);
  const [content, setContent] = useState(normalizedDefaultValue);
  const [viewMode, setViewMode] = useState<ViewMode>("write");
  const [draftRestored, setDraftRestored] = useState(false);
  const draftKeyRef = useRef<string>("");
  const contentInputRef = useRef<HTMLInputElement>(null);

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
    contentInputRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [content]);

  useEffect(() => {
    const form = contentInputRef.current?.form;
    if (!form) return;

    function clearSavedDraft() {
      if (draftKeyRef.current) {
        window.localStorage.removeItem(draftKeyRef.current);
      }
      setDraftRestored(false);
    }

    form.addEventListener("admin-form-saved", clearSavedDraft);
    return () => form.removeEventListener("admin-form-saved", clearSavedDraft);
  }, []);

  const stats = useMemo(() => getTextStats(content), [content]);
  const showEditor = viewMode === "write" || viewMode === "split";
  const showPreview = viewMode === "preview" || viewMode === "split";
  const compact = variant === "compact";
  const setCleanContent = useCallback((value: string) => {
    setContent(value.replace(/\r\n/g, "\n"));
  }, []);

  return (
    <section id="topic-content-editor" className={`${compact ? "min-w-0" : "rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]"} scroll-mt-24`} data-topic-content-editor={variant}>
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

      <input ref={contentInputRef} type="hidden" name="content" value={content} />
      <AdminFormError name="content" />

      <div className={`flex flex-col border-b border-white/10 xl:flex-row xl:items-center xl:justify-between ${compact ? "gap-3 pb-3" : "gap-5 pb-6"}`}>
        <div>
          {compact ? null : <p className="font-en text-xs tracking-[0.34em] text-[#D8B87A]/70">ARTICLE BODY</p>}
          <h3 className={compact ? "text-sm font-semibold text-white" : "mt-3 text-2xl font-semibold text-white"}>المحتوى</h3>
          {compact ? null : <p className="mt-2 max-w-3xl text-sm leading-7 text-white/50">محرر Markdown ثابت ومتوافق مع المقالات القديمة وقواعد الحفظ الحالية. اكتب العنوان الرئيسي بصيغة # عنوان المقال.</p>}
        </div>

        <div className={`grid grid-cols-3 sm:grid-cols-6 ${compact ? "gap-1.5" : "gap-3"}`} data-topic-editor-stats>
          <MiniCounter label="كلمة" value={stats.words} compact={compact} />
          <MiniCounter label="حرف" value={stats.chars} compact={compact} />
          <MiniCounter label="H1" value={stats.h1} compact={compact} />
          <MiniCounter label="H2" value={stats.h2} compact={compact} />
          <MiniCounter label="H3" value={stats.h3} compact={compact} />
          <MiniCounter label="روابط داخلية" value={stats.internalLinks} compact={compact} warning={stats.internalLinks === 0} />
        </div>
      </div>

      {draftRestored ? (
        <div className={`${compact ? "mt-3 rounded-xl px-4 py-3" : "mt-5 rounded-[20px] px-5 py-4"} border border-[#D8B87A]/20 bg-[#D8B87A]/10 text-sm leading-7 text-[#F2D99B]`}>
          تم استرجاع آخر مسودة محفوظة محليًا لهذا المقال حتى لا تفقد ما كتبته بعد أخطاء الحفظ.
        </div>
      ) : null}

      <div className={`${compact ? "mt-3 gap-2 rounded-xl p-2" : "mt-5 gap-4 rounded-[24px] p-3"} flex flex-col border border-white/10 bg-black/25 xl:flex-row xl:items-center xl:justify-between`}>
        <div className={`${compact ? "rounded-lg px-3 py-2 text-xs" : "rounded-[20px] px-4 py-3 text-sm"} border border-[#D8B87A]/15 bg-[#05070B] font-semibold text-[#D8B87A]`}>
          محرر Markdown
        </div>

        <div className="flex flex-wrap gap-2 rounded-[20px] bg-[#05070B] p-1">
          <SegmentButton active={viewMode === "write"} onClick={() => setViewMode("write")}>كتابة</SegmentButton>
          <SegmentButton active={viewMode === "preview"} onClick={() => setViewMode("preview")}>معاينة</SegmentButton>
          <SegmentButton active={viewMode === "split"} onClick={() => setViewMode("split")}>كتابة + معاينة</SegmentButton>
        </div>
      </div>

      <div className={compact ? "mt-3" : "mt-6"}>
        <div className="min-w-0 space-y-5">
          <div className={["grid gap-5", viewMode === "split" ? "xl:grid-cols-2" : ""].join(" ")}>
            {showEditor ? <MarkdownEditor content={content} setContent={setCleanContent} compact={compact} /> : null}
            {showPreview ? <PreviewPane content={content} compact={compact} /> : null}
          </div>

          {compact ? null : <div className="rounded-[22px] border border-white/10 bg-black/20 p-5 text-sm leading-7 text-white/45">
            الصورة الرئيسية للموضوع تظل من الحقل الحالي في الصفحة. الصور داخل المقال والروابط الداخلية الذكية يمكن إضافتها لاحقًا كمرحلة مستقلة بدون خلط HTML مع Markdown.
          </div>}
        </div>
      </div>
    </section>
  );
}

export default AdminPublicRichContentEditor;

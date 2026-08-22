"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import AdminRichTextEditor from "../../../AdminRichTextEditor";
import {
  isHtmlContent,
  markdownToRichTextHtml,
  normalizeArticleMarkdown,
  stripHtml,
} from "../../../../../lib/rich-text/html-utils";
import {
  createTopicDraft,
  parseTopicDraft,
  topicRevisionMatches,
  type TopicDraftCandidate,
} from "../../../../../lib/admin/content/topic-revision";

export type AdminPublicRichContentEditorProps = {
  defaultValue?: string;
  variant?: "default" | "compact";
  draftIdentity: string;
  baselineRevision: string | null;
};

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

function getTextStats(value: string): EditorStats {
  const normalized = normalizeArticleMarkdown(value);
  const plainText = stripHtml(markdownToRichTextHtml(normalized))
    .replace(/[#>*_`~\-[\]()]|\d+\.\s/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
  const paragraphs = normalized
    .split(/\n{2,}/g)
    .map((item) => stripHtml(markdownToRichTextHtml(item)).trim())
    .filter(Boolean).length;
  const markdownInternalLinks = normalized.match(/(?<!!)\[[^\]]+\]\(\/(?!\/)[^)\s]+\)/g)?.length ?? 0;
  const htmlInternalLinks = normalized.match(/<a\b[^>]*\bhref=["']\/(?!\/)[^"']*["'][^>]*>/gi)?.length ?? 0;

  return {
    words,
    chars: plainText.length,
    paragraphs,
    readingMinutes: words > 0 ? Math.max(1, Math.ceil(words / 220)) : 0,
    h1: normalized.match(/^#\s+/gm)?.length ?? 0,
    h2: normalized.match(/^##\s+/gm)?.length ?? 0,
    h3: normalized.match(/^###\s+/gm)?.length ?? 0,
    internalLinks: markdownInternalLinks + htmlInternalLinks,
  };
}

function getDraftKey(draftIdentity: string) {
  return `${STORAGE_PREFIX}:${draftIdentity}`;
}

function MiniCounter({
  label,
  value,
  compact = false,
  warning = false,
}: {
  label: string;
  value: number | string;
  compact?: boolean;
  warning?: boolean;
}) {
  return (
    <div
      data-topic-stat={label}
      className={`${compact ? "rounded-lg px-2 py-1.5" : "rounded-[18px] px-4 py-3"} border bg-black/25 text-center ${warning ? "border-amber-400/30" : "border-white/10"}`}
    >
      <p className={`font-en font-semibold ${warning ? "text-amber-300" : "text-[#D8B87A]"} ${compact ? "text-sm" : "text-2xl"}`}>
        {value}
      </p>
      <p className={`${compact ? "text-[10px]" : "mt-1 text-xs"} text-white/40`}>{label}</p>
    </div>
  );
}

/**
 * Article-specific Markdown adapter over the shared visual AdminRichTextEditor.
 * The editor works with HTML internally while the submitted field remains Markdown.
 */
export function AdminPublicRichContentEditor({
  defaultValue = "",
  variant = "default",
  draftIdentity,
  baselineRevision,
}: AdminPublicRichContentEditorProps) {
  const storedDefaultValue = useMemo(
    () => isHtmlContent(defaultValue) ? normalizeArticleMarkdown(defaultValue) : defaultValue,
    [defaultValue],
  );
  const [initialEditorValue, setInitialEditorValue] = useState(storedDefaultValue);
  const [content, setContent] = useState(storedDefaultValue);
  const [draftRestored, setDraftRestored] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<TopicDraftCandidate | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const draftKeyRef = useRef("");
  const pendingDraftRef = useRef<TopicDraftCandidate | null>(null);
  const skipNextDraftPersistRef = useRef(false);
  const compact = variant === "compact";

  useEffect(() => {
    skipNextDraftPersistRef.current = true;
    draftKeyRef.current = getDraftKey(draftIdentity);
    const parsedDraft = parseTopicDraft(
      window.localStorage.getItem(draftKeyRef.current),
    );
    const savedDraft = parsedDraft
      ? { ...parsedDraft, content: normalizeArticleMarkdown(parsedDraft.content) }
      : null;
    const normalizedStoredDefault = normalizeArticleMarkdown(storedDefaultValue);

    if (!savedDraft || savedDraft.content === normalizedStoredDefault) {
      window.localStorage.removeItem(draftKeyRef.current);
      setInitialEditorValue(storedDefaultValue);
      setContent(storedDefaultValue);
      setDraftRestored(false);
      pendingDraftRef.current = null;
      setPendingDraft(null);
      setDraftReady(true);
      return;
    }

    if (
      !savedDraft.legacy &&
      topicRevisionMatches(savedDraft.baselineRevision, baselineRevision)
    ) {
      setInitialEditorValue(savedDraft.content);
      setContent(savedDraft.content);
      setDraftRestored(true);
      pendingDraftRef.current = null;
      setPendingDraft(null);
      setDraftReady(true);
      return;
    }

    setInitialEditorValue(storedDefaultValue);
    setContent(storedDefaultValue);
    setDraftRestored(false);
    pendingDraftRef.current = savedDraft;
    setPendingDraft(savedDraft);
    setDraftReady(true);
  }, [baselineRevision, draftIdentity, storedDefaultValue]);

  useEffect(() => {
    if (!draftReady || pendingDraft || !draftKeyRef.current) return;
    if (skipNextDraftPersistRef.current) {
      skipNextDraftPersistRef.current = false;
      return;
    }
    if (normalizeArticleMarkdown(content) === normalizeArticleMarkdown(storedDefaultValue)) {
      window.localStorage.removeItem(draftKeyRef.current);
      return;
    }
    window.localStorage.setItem(
      draftKeyRef.current,
      JSON.stringify(
        createTopicDraft(normalizeArticleMarkdown(content), baselineRevision),
      ),
    );
  }, [baselineRevision, content, draftReady, pendingDraft, storedDefaultValue]);

  useEffect(() => {
    const form = sectionRef.current?.closest("form");
    if (!form) return;

    function clearSavedDraft() {
      if (pendingDraftRef.current) return;
      if (draftKeyRef.current) {
        window.localStorage.removeItem(draftKeyRef.current);
      }
      setDraftRestored(false);
      pendingDraftRef.current = null;
      setPendingDraft(null);
    }

    form.addEventListener("admin-form-saved", clearSavedDraft);
    return () => form.removeEventListener("admin-form-saved", clearSavedDraft);
  }, []);

  useEffect(() => {
    const form = sectionRef.current?.closest("form");
    if (!form) return;

    function blockUnresolvedDraftSubmit(event: SubmitEvent) {
      if (!pendingDraftRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const prompt = sectionRef.current?.querySelector<HTMLElement>(
        "[data-topic-draft-conflict]",
      );
      prompt?.scrollIntoView({ block: "center", behavior: "smooth" });
      prompt
        ?.querySelector<HTMLButtonElement>("[data-topic-draft-restore]")
        ?.focus({ preventScroll: true });
    }

    form.addEventListener("submit", blockUnresolvedDraftSubmit, true);
    return () =>
      form.removeEventListener("submit", blockUnresolvedDraftSubmit, true);
  }, []);

  const handleValueChange = useCallback((value: string) => {
    setContent(value.replace(/\r\n/g, "\n"));
  }, []);
  const restorePendingDraft = useCallback(() => {
    if (!pendingDraft) return;
    const restoredContent = normalizeArticleMarkdown(pendingDraft.content);
    if (draftKeyRef.current) {
      window.localStorage.setItem(
        draftKeyRef.current,
        JSON.stringify(createTopicDraft(restoredContent, baselineRevision)),
      );
    }
    setInitialEditorValue(restoredContent);
    setContent(restoredContent);
    setDraftRestored(true);
    pendingDraftRef.current = null;
    setPendingDraft(null);
  }, [baselineRevision, pendingDraft]);
  const discardPendingDraft = useCallback(() => {
    if (draftKeyRef.current) {
      window.localStorage.removeItem(draftKeyRef.current);
    }
    setInitialEditorValue(storedDefaultValue);
    setContent(storedDefaultValue);
    setDraftRestored(false);
    pendingDraftRef.current = null;
    setPendingDraft(null);
  }, [storedDefaultValue]);
  const stats = useMemo(() => getTextStats(content), [content]);

  return (
    <section
      ref={sectionRef}
      id="topic-content-editor"
      className={`${compact ? "min-w-0" : "rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]"} scroll-mt-24`}
      data-topic-content-editor={variant}
      data-topic-content-storage="markdown"
    >
      <div className={`flex flex-col border-b border-white/10 xl:flex-row xl:items-center xl:justify-between ${compact ? "gap-3 pb-3" : "gap-5 pb-6"}`}>
        <div>
          {compact ? null : <p className="font-en text-xs tracking-[0.34em] text-[#D8B87A]/70">ARTICLE BODY</p>}
          <h3 className={compact ? "text-sm font-semibold text-white" : "mt-3 text-2xl font-semibold text-white"}>
            المحتوى
          </h3>
          {compact ? null : (
            <p className="mt-2 max-w-3xl text-sm leading-7 text-white/50">
              محرر بصري للمقالات يحفظ عقد Markdown الحالي دون تغيير.
            </p>
          )}
        </div>

        <div className={`grid grid-cols-3 sm:grid-cols-6 ${compact ? "gap-1.5" : "gap-3"}`} data-topic-editor-stats>
          <MiniCounter label="كلمة" value={stats.words} compact={compact} />
          <MiniCounter label="فقرة" value={stats.paragraphs} compact={compact} />
          <MiniCounter label="H2" value={stats.h2} compact={compact} />
          <MiniCounter label="H3" value={stats.h3} compact={compact} />
          <MiniCounter label="قراءة" value={`${stats.readingMinutes} د`} compact={compact} />
          <MiniCounter label="روابط داخلية" value={stats.internalLinks} compact={compact} warning={stats.internalLinks === 0} />
        </div>
      </div>

      {draftRestored ? (
        <div className={`${compact ? "mt-3 rounded-xl px-4 py-3" : "mt-5 rounded-[20px] px-5 py-4"} border border-[#D8B87A]/20 bg-[#D8B87A]/10 text-sm leading-7 text-[#F2D99B]`}>
          تم استرجاع آخر مسودة محفوظة محليًا لهذا المقال.
        </div>
      ) : null}

      {pendingDraft ? (
        <div
          className={`${compact ? "mt-3 rounded-xl px-4 py-3" : "mt-5 rounded-[20px] px-5 py-4"} border border-amber-400/30 bg-amber-400/10 text-sm leading-7 text-amber-100`}
          data-topic-draft-conflict
          role="status"
        >
          <p>
            توجد مسودة محلية من نسخة سابقة أو غير معروفة. لم يتم استبدال المحتوى الحالي بها.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl border border-amber-300/35 bg-amber-300/15 px-3 py-1.5 font-semibold text-amber-50 transition hover:bg-amber-300/25"
              onClick={restorePendingDraft}
              data-topic-draft-restore
            >
              استرجاع المسودة
            </button>
            <button
              type="button"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 font-semibold text-white/75 transition hover:bg-white/10"
              onClick={discardPendingDraft}
              data-topic-draft-discard
            >
              تجاهل المسودة
            </button>
          </div>
        </div>
      ) : null}

      <div className={compact ? "mt-3" : "mt-6"}>
        <AdminRichTextEditor
          name="content"
          label="نص المقال"
          defaultValue={initialEditorValue}
          placeholder="ابدأ كتابة المقال هنا..."
          minHeight={compact ? 440 : 620}
          toolbarMode="full"
          storageFormat="markdown"
          enableArticleStructure
          enableTextAlign
          readOnly={Boolean(pendingDraft)}
          helperText="Enter لإنشاء فقرة جديدة، وShift + Enter للنزول إلى سطر جديد داخل الفقرة."
          onValueChange={handleValueChange}
        />
      </div>
    </section>
  );
}

export default AdminPublicRichContentEditor;

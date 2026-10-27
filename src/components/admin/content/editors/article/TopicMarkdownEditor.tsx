"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import AdminRichTextEditor from "../../../AdminRichTextEditor";
import AdminNotice from "../../../AdminNotice";
import AdminActionButton from "../../../ui/AdminActionButton";
import AdminListboxSelect from "../../../ui/AdminListboxSelect";
import AdminCard from "../../../ui/AdminCard";
import { ADMIN_TIME_ZONE, formatAdminDateTime } from "../../../../../lib/content-dates";
import { ADMIN_FORM_STACK_CLASS_NAME } from "../../../ui/AdminForm";
import { AdminModuleSectionHeader } from "../../../ui/AdminModuleTabs";
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
  collectTopicFormDraftFields,
  createTopicFormDraft,
  createTopicDraftWriterId,
  getTopicFormDraftKey,
  getTopicFormDraftPrefix,
  getTopicFormDraftSessionPrefix,
  mergeTopicFormDraftFields,
  parseTopicFormDraft,
  removeTopicFormDraftIfUnchanged,
  getTopicDraftSessionEndKey,
  pruneTopicDraftSessionEndMarkers,
  TOPIC_DRAFT_SESSION_END_EVENT,
  TOPIC_DRAFT_LOGOUT_STORAGE_KEY,
  type TopicFormDraftFields,
  type TopicFormDraftRecord,
  type TopicFormDraftScope,
} from "../../../../../lib/admin/content/topic-revision";
import { useOptionalAdminFormRuntime } from "../../../ui/AdminFormRuntime";
import {
  ADMIN_FORM,
  adminFormHintClassName,
} from "../../../../../lib/admin/admin-ui-styles";

export type AdminPublicRichContentEditorProps = {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  variant?: "default" | "compact";
  presentation?: "default" | "panel";
  draftIdentity: string;
  baselineRevision: string | null;
  /** The existing form owner handles recovery instead of the Markdown-only path. */
  formDraftManaged?: boolean;
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
  value,
  onValueChange,
  variant = "default",
  presentation = "default",
  draftIdentity,
  baselineRevision,
  formDraftManaged = false,
}: AdminPublicRichContentEditorProps) {
  const storedDefaultValue = useMemo(
    () => isHtmlContent(defaultValue) ? normalizeArticleMarkdown(defaultValue) : defaultValue,
    [defaultValue],
  );
  const [uncontrolledContent, setUncontrolledContent] = useState(storedDefaultValue);
  const controlled = value !== undefined;
  const content = controlled
    ? normalizeArticleMarkdown(value)
    : uncontrolledContent;
  const [draftRestored, setDraftRestored] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<TopicDraftCandidate | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [dismissedPendingNotices, setDismissedPendingNotices] = useState<Record<string, TopicDraftCandidate>>({});
  const runtime = useOptionalAdminFormRuntime();
  const sectionRef = useRef<HTMLElement>(null);
  const draftKeyRef = useRef("");
  const pendingDraftRef = useRef<TopicDraftCandidate | null>(null);
  const skipNextDraftPersistRef = useRef(false);
  const focusPendingDraftNoticeRef = useRef(false);
  const controlledRef = useRef(controlled);
  const onValueChangeRef = useRef(onValueChange);
  const notifyProjectionChangeRef = useRef(runtime?.notifyProjectionChange);
  useLayoutEffect(() => {
    controlledRef.current = controlled;
    onValueChangeRef.current = onValueChange;
    notifyProjectionChangeRef.current = runtime?.notifyProjectionChange;
  }, [controlled, onValueChange, runtime?.notifyProjectionChange]);
  const panel = presentation === "panel";
  const compact = variant === "compact" || panel;
  useLayoutEffect(() => {
    if (!focusPendingDraftNoticeRef.current) return;
    focusPendingDraftNoticeRef.current = false;
    const prompt = sectionRef.current?.querySelector<HTMLElement>("[data-topic-draft-conflict]");
    prompt?.scrollIntoView({ block: "center", behavior: "smooth" });
    prompt?.querySelector<HTMLButtonElement>("[data-topic-draft-restore]")?.focus({ preventScroll: true });
  }, [dismissedPendingNotices]);

  const commitContent = useCallback((nextValue: string) => {
    const normalized = nextValue.replace(/\r\n/g, "\n");
    if (!controlledRef.current) setUncontrolledContent(normalized);
    onValueChangeRef.current?.(normalized);
  }, []);

  useEffect(() => {
    if (formDraftManaged) return;
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
      if (!controlledRef.current) setUncontrolledContent(storedDefaultValue);
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
      commitContent(savedDraft.content);
      notifyProjectionChangeRef.current?.();
      setDraftRestored(true);
      pendingDraftRef.current = null;
      setPendingDraft(null);
      setDraftReady(true);
      return;
    }

    if (!controlledRef.current) setUncontrolledContent(storedDefaultValue);
    setDraftRestored(false);
    pendingDraftRef.current = savedDraft;
    setPendingDraft(savedDraft);
    setDraftReady(true);
  }, [baselineRevision, commitContent, draftIdentity, formDraftManaged, storedDefaultValue]);

  useEffect(() => {
    if (formDraftManaged || !draftReady || pendingDraft || !draftKeyRef.current) return;
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
  }, [baselineRevision, content, draftReady, formDraftManaged, pendingDraft, storedDefaultValue]);

  useEffect(() => {
    if (formDraftManaged) return;
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
  }, [formDraftManaged]);

  useEffect(() => {
    if (formDraftManaged) return;
    const form = sectionRef.current?.closest("form");
    if (!form) return;

    function blockUnresolvedDraftSubmit(event: SubmitEvent) {
      if (!pendingDraftRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      focusPendingDraftNoticeRef.current = true;
      setDismissedPendingNotices({});
    }

    form.addEventListener("submit", blockUnresolvedDraftSubmit, true);
    return () =>
      form.removeEventListener("submit", blockUnresolvedDraftSubmit, true);
  }, [formDraftManaged]);

  const handleValueChange = useCallback(
    (nextValue: string) => commitContent(nextValue),
    [commitContent],
  );
  const dismissDraftRestoredNotice = useCallback(() => {
    setDraftRestored(false);
    sectionRef.current?.focus({ preventScroll: true });
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
    commitContent(restoredContent);
    notifyProjectionChangeRef.current?.();
    setDraftRestored(true);
    pendingDraftRef.current = null;
    setPendingDraft(null);
  }, [baselineRevision, commitContent, pendingDraft]);
  const discardPendingDraft = useCallback(() => {
    if (draftKeyRef.current) {
      window.localStorage.removeItem(draftKeyRef.current);
    }
    commitContent(storedDefaultValue);
    notifyProjectionChangeRef.current?.();
    setDraftRestored(false);
    pendingDraftRef.current = null;
    setPendingDraft(null);
  }, [commitContent, storedDefaultValue]);
  const stats = useMemo(() => getTextStats(content), [content]);

  const editorStats = (
    <div className={`grid grid-cols-3 sm:grid-cols-6 ${compact ? "gap-1.5" : "gap-3"}`} data-topic-editor-stats>
      <MiniCounter label="كلمة" value={stats.words} compact={compact} />
      <MiniCounter label="فقرة" value={stats.paragraphs} compact={compact} />
      <MiniCounter label="H2" value={stats.h2} compact={compact} />
      <MiniCounter label="H3" value={stats.h3} compact={compact} />
      <MiniCounter label="قراءة" value={`${stats.readingMinutes} د`} compact={compact} />
      <MiniCounter label="روابط داخلية" value={stats.internalLinks} compact={compact} warning={stats.internalLinks === 0} />
    </div>
  );
  const editorHeader = panel ? (
    <AdminModuleSectionHeader
      id="content-body"
      sectionHeading="المحتوى"
      sectionHeaderPresentation="premium"
      icon="content"
      sectionSummary={editorStats}
    />
  ) : (
      <div className={`flex flex-col border-b border-white/10 xl:flex-row xl:items-center xl:justify-between ${compact ? "gap-3 pb-3" : "gap-5 pb-6"}`}>
        {compact ? null : (
          <div>
            <p className="font-en text-xs tracking-[0.34em] text-[#D8B87A]/70">ARTICLE BODY</p>
            <h3 className="mt-3 text-2xl font-semibold text-white">
              المحتوى
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-white/50">
              محرر بصري للمقالات يحفظ عقد Markdown الحالي دون تغيير.
            </p>
          </div>
        )}

        {editorStats}
      </div>
  );
  const editorBody = (
    <>
      {draftRestored ? (
        <div className={panel ? undefined : compact ? "mt-3" : "mt-5"} data-topic-draft-restored="">
          <AdminNotice
            message="تم استرجاع آخر مسودة محفوظة محليًا لهذا المقال."
            variant="warning"
            presentation="compact"
            layout="stacked"
            dismissible
            lifecycle="manual"
            dismissSearchParams={[]}
            onDismiss={dismissDraftRestoredNotice}
          />
        </div>
      ) : null}

      {pendingDraft ? (
        <div
          className={panel ? undefined : compact ? "mt-3" : "mt-5"}
          data-topic-draft-conflict
          data-topic-draft-dismissed={dismissedPendingNotices[draftIdentity] === pendingDraft || undefined}
        >
          {dismissedPendingNotices[draftIdentity] === pendingDraft ? null : <AdminNotice
            variant="warning"
            presentation="compact"
            message="توجد مسودة محلية من نسخة سابقة أو غير معروفة. لم يتم استبدال المحتوى الحالي بها."
            dismissible
            lifecycle="manual"
            dismissSearchParams={[]}
            onDismiss={() => setDismissedPendingNotices(previous => ({ ...previous, [draftIdentity]: pendingDraft }))}
            actionContent={<>
            <AdminActionButton
              type="button"
              variant="gold"
              onClick={restorePendingDraft}
              data-topic-draft-restore
            >
              استرجاع المسودة
            </AdminActionButton>
            <AdminActionButton
              type="button"
              variant="dark"
              onClick={discardPendingDraft}
              data-topic-draft-discard
            >
              تجاهل المسودة
            </AdminActionButton>
            </>}
          />}
        </div>
      ) : null}

      <div className={panel ? undefined : compact ? "mt-3" : "mt-6"}>
        <AdminRichTextEditor
          name="content"
          label="نص المقال"
          className={panel ? ADMIN_FORM.labelStack : undefined}
          showLabel={!panel}
          defaultValue={storedDefaultValue}
          value={content}
          placeholder="ابدأ كتابة المقال هنا..."
          minHeight={panel ? 300 : compact ? 440 : 620}
          maxHeight={panel ? 300 : undefined}
          scrollbarSide={panel ? "right" : undefined}
          toolbarMode="full"
          storageFormat="markdown"
          enableArticleStructure
          enableTextAlign
          readOnly={Boolean(pendingDraft)}
          helperText="Enter لإنشاء فقرة جديدة، وShift + Enter للنزول إلى سطر جديد داخل الفقرة."
          helperTextClassName={panel ? adminFormHintClassName({ textInset: true }) : undefined}
          onValueChange={handleValueChange}
        />
      </div>
    </>
  );

  return (
    <section
      ref={sectionRef}
      id="topic-content-editor"
      tabIndex={panel ? -1 : undefined}
      className={`${compact ? "min-w-0" : "rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]"} scroll-mt-24`}
      data-topic-content-editor={variant}
      data-topic-content-presentation={panel ? "panel" : undefined}
      data-topic-content-storage="markdown"
    >
      {panel ? (
        <AdminCard presentation="premium" className="min-w-0 p-3">
          {editorHeader}
          <div className={ADMIN_FORM_STACK_CLASS_NAME}>{editorBody}</div>
        </AdminCard>
      ) : <>{editorHeader}{editorBody}</>}
    </section>
  );
}

type FormDraftSnapshot = { key: string; raw: string };
type FormDraftCandidate = FormDraftSnapshot & {
  draft: TopicFormDraftRecord;
  /** Equivalent validated snapshots share a decision without losing writer identity. */
  aliases?: FormDraftSnapshot[];
};

function topicFormDraftSnapshotSignature(draft: TopicFormDraftRecord) {
  const ordered = (value: Record<string, unknown>) =>
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify({
    version: draft.version,
    fieldVersion: draft.fieldVersion,
    scope: ordered(draft.scope),
    baselineRevision: draft.baselineRevision,
    fields: ordered(draft.fields),
    baselineFields: ordered(draft.baselineFields),
  });
}

function groupTopicFormDraftCandidates(candidates: readonly FormDraftCandidate[]) {
  const groups = new Map<string, FormDraftCandidate>();
  for (const candidate of candidates) {
    const signature = topicFormDraftSnapshotSignature(candidate.draft);
    const alias = { key: candidate.key, raw: candidate.raw };
    const group = groups.get(signature);
    if (group) group.aliases!.push(alias);
    else groups.set(signature, { ...candidate, aliases: [alias] });
  }
  return [...groups.values()];
}

/** Full-form mode of the existing Topic draft owner; storage stays local only. */
export function TopicFormDraftRecovery({
  scope,
  baselineRevision,
  onRestore,
  restoreVersion,
}: {
  scope: TopicFormDraftScope;
  baselineRevision: string | null;
  onRestore: (fields: TopicFormDraftFields) => void;
  restoreVersion: number;
}) {
  const runtime = useOptionalAdminFormRuntime();
  const rootRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(false);
  const baselineFieldsRef = useRef<TopicFormDraftFields>({});
  const baselineRevisionRef = useRef(baselineRevision);
  const writerRef = useRef("");
  const ownRawRef = useRef<string | null>(null);
  const adoptedRef = useRef(new Map<string, string>());
  const ignoredRef = useRef(new Map<string, string>());
  const candidatesRef = useRef<FormDraftCandidate[]>([]);
  const persistRef = useRef<() => void>(() => {});
  const [candidates, setCandidates] = useState<FormDraftCandidate[]>([]);
  const [opaqueDrafts, setOpaqueDrafts] = useState<Array<{ key: string; raw: string }>>([]);
  const [choices, setChoices] = useState<Record<string, Record<string, "saved" | "draft">>>({});
  const [unavailable, setUnavailable] = useState(false);
  const [expired, setExpired] = useState(false);
  const [restored, setRestored] = useState(false);
  const [retainedConflict, setRetainedConflict] = useState(false);
  const [restoreBlocked, setRestoreBlocked] = useState(false);
  const [excludedFields, setExcludedFields] = useState<string[]>([]);
  const [currentFields, setCurrentFields] = useState<TopicFormDraftFields>({});
  const [dismissedNotices, setDismissedNotices] = useState<Record<string, string>>({});
  const focusPendingNoticeRef = useRef(false);
  useLayoutEffect(() => {
    if (!focusPendingNoticeRef.current) return;
    focusPendingNoticeRef.current = false;
    const restoreButton = rootRef.current?.querySelector<HTMLButtonElement>("[data-topic-form-draft-restore]");
    restoreButton?.closest<HTMLElement>("[data-topic-form-draft]")?.scrollIntoView({ block: "center", behavior: "smooth" });
    restoreButton?.focus({ preventScroll: true });
  }, [dismissedNotices]);
  const notifyProjectionChange = runtime?.notifyProjectionChange;
  const captureFields = useCallback((form: HTMLFormElement) => {
    const captured = collectTopicFormDraftFields(new FormData(form), scope.contentType);
    // This date becomes server-owned after first publication.
    if (form.querySelector('[name="published_at"]:disabled')) delete captured.fields.published_at;
    return captured;
  }, [scope.contentType]);
  const prefix = getTopicFormDraftPrefix(scope);
  const currentScopeRef = useRef(scope);
  const pendingRef = useRef(runtime?.pending ?? false);
  useLayoutEffect(() => {
    currentScopeRef.current = scope;
    pendingRef.current = runtime?.pending ?? false;
  }, [scope, runtime?.pending]);
  useLayoutEffect(() => {
    const acceptedTime = Date.parse(baselineRevisionRef.current ?? "");
    const incomingTime = Date.parse(baselineRevision ?? "");
    if (!Number.isFinite(acceptedTime) || (Number.isFinite(incomingTime) && incomingTime >= acceptedTime)) baselineRevisionRef.current = baselineRevision;
  }, [baselineRevision]);

  useLayoutEffect(() => {
    if (!restoreVersion) return;
    notifyProjectionChange?.();
  }, [restoreVersion, notifyProjectionChange]);

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const activeScope = currentScopeRef.current;
    writerRef.current = createTopicDraftWriterId();
    ownRawRef.current = null;
    adoptedRef.current.clear();
    ignoredRef.current.clear();
    baselineFieldsRef.current = captureFields(form).fields;
    readyRef.current = false;
    let disposed = false;
    let sessionEnded = false;
    let logoutMarker: string | null = null;
    try {
      pruneTopicDraftSessionEndMarkers(window.localStorage);
      logoutMarker = window.localStorage.getItem(TOPIC_DRAFT_LOGOUT_STORAGE_KEY);
    } catch { queueMicrotask(() => { if (!disposed) setUnavailable(true); }); }

    const failStorage = () => { if (!disposed) setUnavailable(true); };
    const endSession = () => {
      sessionEnded = true;
      readyRef.current = false;
      try { window.localStorage.setItem(getTopicDraftSessionEndKey(activeScope), "1"); } catch { failStorage(); }
      if (!disposed) { setExpired(true); setCandidates([]); candidatesRef.current = []; setDismissedNotices({}); }
    };
    const expire = () => {
      if (sessionEnded) return true;
      try {
        if (window.localStorage.getItem(getTopicDraftSessionEndKey(activeScope)) !== null || window.localStorage.getItem(TOPIC_DRAFT_LOGOUT_STORAGE_KEY) !== logoutMarker) { endSession(); return true; }
      } catch { failStorage(); return true; }
      if (Date.now() < activeScope.expiresAt) return false;
      endSession();
      try {
        const storage = window.localStorage;
        for (const key of Object.keys(storage)) {
          if (!key.startsWith("venesia-topic-editor-draft:")) continue;
          if (key.startsWith(getTopicFormDraftSessionPrefix(activeScope)) || key.startsWith("venesia-topic-editor-draft:topic:")) {
            const raw = storage.getItem(key);
            if (raw) removeTopicFormDraftIfUnchanged(storage, key, raw);
            continue;
          }
          try {
            const record = JSON.parse(storage.getItem(key) ?? "null");
            if (typeof record?.scope?.expiresAt === "number" && record.scope.expiresAt <= Date.now()) storage.removeItem(key);
          } catch { /* Raw legacy Markdown is removed at this known session end. */ }
          const raw = storage.getItem(key);
          if (raw) {
            const parsed = parseTopicFormDraft(raw, activeScope);
            if (parsed.status === "legacy") removeTopicFormDraftIfUnchanged(storage, key, raw);
          }
        }
      } catch { failStorage(); }
      if (!disposed) { setExpired(true); setCandidates([]); candidatesRef.current = []; }
      return true;
    };

    const refresh = () => {
      if (disposed || expire()) return;
      try {
        const storage = window.localStorage;
        const next: FormDraftCandidate[] = [], opaque: Array<{ key: string; raw: string }> = [];
        const legacyKey = `venesia-topic-editor-draft:topic:${activeScope.contentType}:${activeScope.entity}`;
        for (const key of Object.keys(storage)) {
          if (!key.startsWith("venesia-topic-editor-draft:")) continue;
          const raw = storage.getItem(key);
          if (!raw) continue;
          // Expiry metadata is never used to expose another actor's payload.
          try {
            const metadata = JSON.parse(raw);
            if (typeof metadata?.scope?.expiresAt === "number" && metadata.scope.expiresAt <= Date.now()) {
              removeTopicFormDraftIfUnchanged(storage, key, raw);
              continue;
            }
          } catch { /* Old raw Markdown has no authenticated provenance. */ }
          if (key === legacyKey) { opaque.push({ key, raw }); continue; }
          if (!key.startsWith(prefix) || key === getTopicFormDraftKey(activeScope, writerRef.current)) continue;
          if (adoptedRef.current.get(key) === raw || ignoredRef.current.get(key) === raw) continue;
          const parsed = parseTopicFormDraft(raw, activeScope);
          if (parsed.status === "valid") {
            if (JSON.stringify(parsed.draft.fields) !== JSON.stringify(baselineFieldsRef.current)) next.push({ key, raw, draft: parsed.draft });
          } else if (parsed.status !== "expired" && parsed.status !== "scope_mismatch") opaque.push({ key, raw });
        }
        next.sort((a, b) => b.draft.savedAt.localeCompare(a.draft.savedAt));
        const captured = captureFields(form);
        setCurrentFields(captured.fields);
        setExcludedFields(captured.excludedFields);
        const grouped = groupTopicFormDraftCandidates(next);
        candidatesRef.current = grouped;
        setCandidates(grouped);
        setOpaqueDrafts(opaque);
        setUnavailable(false);
        readyRef.current = true;
      } catch { failStorage(); }
    };

    const persist = () => {
      if (disposed || !readyRef.current || pendingRef.current || expire()) return;
      try {
        const captured = captureFields(form);
        setExcludedFields(previous => JSON.stringify(previous) === JSON.stringify(captured.excludedFields) ? previous : captured.excludedFields);
        if (!ownRawRef.current && JSON.stringify(captured.fields) === JSON.stringify(baselineFieldsRef.current)) return;
        const record = createTopicFormDraft(activeScope, baselineRevisionRef.current, writerRef.current, captured.fields, undefined, baselineFieldsRef.current);
        if (!ownRawRef.current) {
          const signature = topicFormDraftSnapshotSignature(record);
          const protectedSnapshots = [
            ...candidatesRef.current.flatMap(candidate => candidate.aliases ?? [candidate]),
            ...[...adoptedRef.current].map(([key, raw]) => ({ key, raw })),
          ];
          const alreadyProtected = protectedSnapshots.some(snapshot => {
            if (window.localStorage.getItem(snapshot.key) !== snapshot.raw) return false;
            const parsed = parseTopicFormDraft(snapshot.raw, activeScope);
            return parsed.status === "valid" && topicFormDraftSnapshotSignature(parsed.draft) === signature;
          });
          if (alreadyProtected) { setUnavailable(false); return; }
        }
        const raw = JSON.stringify(record);
        window.localStorage.setItem(getTopicFormDraftKey(activeScope, writerRef.current), raw);
        ownRawRef.current = raw;
        setUnavailable(false);
      } catch { failStorage(); }
    };
    persistRef.current = persist;
    const schedulePersist = () => { queueMicrotask(() => {
      if (disposed) return;
      if (candidatesRef.current.length) setCurrentFields(captureFields(form).fields);
      persist();
    }); };
    const saved = (event: Event) => {
      try {
        if (event instanceof CustomEvent && typeof event.detail?.savedRevision === "string") baselineRevisionRef.current = event.detail.savedRevision;
        const storage = window.localStorage;
        if (ownRawRef.current) removeTopicFormDraftIfUnchanged(storage, getTopicFormDraftKey(activeScope, writerRef.current), ownRawRef.current);
        for (const [key, raw] of adoptedRef.current) removeTopicFormDraftIfUnchanged(storage, key, raw);
        ownRawRef.current = null;
        adoptedRef.current.clear();
        baselineFieldsRef.current = captureFields(form).fields;
        setRestored(false);
      } catch { failStorage(); }
    };
    const blockUnresolved = (event: SubmitEvent) => {
      if (!candidatesRef.current.length) return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      focusPendingNoticeRef.current = true;
      setDismissedNotices({});
    };
    const revisit = () => { if (!expire()) refresh(); };
    const storageChanged = (event: StorageEvent) => {
      if (event.key === TOPIC_DRAFT_LOGOUT_STORAGE_KEY || event.key === getTopicDraftSessionEndKey(activeScope)) { endSession(); return; }
      if (event.key === null || event.key.startsWith("venesia-topic-editor-draft:")) refresh();
    };
    refresh();
    let timer: number;
    const scheduleExpiry = () => {
      timer = window.setTimeout(() => { if (!expire()) scheduleExpiry(); }, Math.min(Math.max(activeScope.expiresAt - Date.now(), 0), 2_147_483_647));
    };
    scheduleExpiry();
    form.addEventListener("input", schedulePersist);
    form.addEventListener("change", schedulePersist);
    form.addEventListener("admin-form-saved", saved);
    form.addEventListener("submit", blockUnresolved, true);
    window.addEventListener("pagehide", persist);
    window.addEventListener("focus", revisit);
    window.addEventListener("pageshow", revisit);
    window.addEventListener("storage", storageChanged);
    window.addEventListener(TOPIC_DRAFT_SESSION_END_EVENT, endSession);
    document.addEventListener("visibilitychange", revisit);
    return () => {
      persist(); disposed = true; readyRef.current = false; persistRef.current = () => {};
      window.clearTimeout(timer);
      form.removeEventListener("input", schedulePersist); form.removeEventListener("change", schedulePersist);
      form.removeEventListener("admin-form-saved", saved); form.removeEventListener("submit", blockUnresolved, true);
      window.removeEventListener("pagehide", persist); window.removeEventListener("focus", revisit);
      window.removeEventListener("pageshow", revisit); window.removeEventListener("storage", storageChanged);
      window.removeEventListener(TOPIC_DRAFT_SESSION_END_EVENT, endSession);
      document.removeEventListener("visibilitychange", revisit);
    };
  }, [captureFields, prefix]);

  useEffect(() => { persistRef.current(); }, [restoreVersion, runtime?.isDirty]);

  const restore = (candidate: FormDraftCandidate) => {
    if (runtime?.pending || expired) return;
    const form = rootRef.current?.closest("form");
    if (!form) return;
    try {
      if (window.localStorage.getItem(candidate.key) !== candidate.raw) {
        setUnavailable(true);
        return;
      }
      const aliases = candidate.aliases ?? [candidate];
      if (aliases.some(snapshot => window.localStorage.getItem(snapshot.key) !== snapshot.raw)) {
        setUnavailable(true);
        return;
      }
      const captured = captureFields(form);
      const current = captured.fields;
      const merged = mergeTopicFormDraftFields(candidate.draft, current, choices[candidate.key]);
      // Keep unsupported live references in memory across the owner remount.
      // The canonical collector still excludes them from every stored snapshot.
      for (const name of captured.excludedFields) {
        const controls = Array.from(form.elements).filter((element): element is HTMLInputElement | HTMLTextAreaElement =>
          (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) && element.name === name && !element.disabled);
        if (controls.some(element => element instanceof HTMLInputElement && element.type === "file")) { setRestoreBlocked(true); return; }
        merged.fields[name] = controls.map(element => element.value);
      }
      const unapplied = Object.keys(candidate.draft.fields).filter(name =>
        JSON.stringify(candidate.draft.fields[name]) !== JSON.stringify(candidate.draft.baselineFields[name])
        && JSON.stringify(merged.fields[name]) !== JSON.stringify(candidate.draft.fields[name]));
      if (unapplied.length) ignoredRef.current.set(candidate.key, candidate.raw);
      else adoptedRef.current.set(candidate.key, candidate.raw);
      for (const alias of aliases) {
        if (alias.key === candidate.key) continue;
        if (unapplied.length) ignoredRef.current.set(alias.key, alias.raw);
        else adoptedRef.current.set(alias.key, alias.raw);
      }
      for (const other of candidatesRef.current) if (other.key !== candidate.key) {
        for (const alias of other.aliases ?? [other]) ignoredRef.current.set(alias.key, alias.raw);
      }
      candidatesRef.current = []; setCandidates([]);
      setRetainedConflict(unapplied.length > 0);
      setRestoreBlocked(false);
      setRestored(true);
      onRestore(merged.fields);
    } catch { setUnavailable(true); }
  };
  const discard = (key: string, expectedRaw: string) => {
    try {
      if (!removeTopicFormDraftIfUnchanged(window.localStorage, key, expectedRaw)) { setUnavailable(true); return; }
      const next = candidatesRef.current.filter(candidate => candidate.key !== key);
      candidatesRef.current = next; setCandidates(next);
      setOpaqueDrafts(drafts => drafts.filter(value => value.key !== key));
    } catch { setUnavailable(true); }
  };
  const discardCandidate = (candidate: FormDraftCandidate) => {
    try {
      const aliases = candidate.aliases ?? [candidate];
      if (aliases.some(snapshot => window.localStorage.getItem(snapshot.key) !== snapshot.raw)) { setUnavailable(true); return; }
      for (const snapshot of aliases) discard(snapshot.key, snapshot.raw);
    } catch { setUnavailable(true); }
  };
  const dismissNotice = (candidate: FormDraftSnapshot & { aliases?: FormDraftSnapshot[] }) => {
    setDismissedNotices(previous => ({ ...previous, [candidate.key]: candidate.raw }));
    if (candidate.aliases?.length) setDismissedNotices(previous => {
      const next = { ...previous };
      for (const alias of candidate.aliases!) next[alias.key] = alias.raw;
      return next;
    });
  };

  return (
    <div ref={rootRef} data-topic-form-draft-owner="" className="contents">
      {expired ? <div data-topic-form-draft="expired"><AdminNotice variant="warning" presentation="compact" dismissible lifecycle="manual" dismissSearchParams={[]} message="انتهت الجلسة. توقفت استعادة المسودات المحلية وحُذفت المسودات المنتهية عند تشغيل الصفحة." /></div> : null}
      {unavailable ? <div data-topic-form-draft="unavailable"><AdminNotice variant="warning" presentation="compact" dismissible lifecycle="manual" dismissSearchParams={[]} message="تعذّر الوصول إلى المسودة المحلية أو تغيرت من نافذة أخرى. بيانات النموذج الحالية لم تُستبدل. أعد تحميل الصفحة لمراجعة النسخ المتاحة." /></div> : null}
      {excludedFields.length ? <div data-topic-form-draft-excluded={excludedFields.join(",")}><AdminNotice variant="warning" presentation="compact" dismissible lifecycle="manual" dismissSearchParams={[]} message="بعض الحقول تحتوي مراجع مؤقتة أو بيانات وصول؛ لم تُخزّن في المسودة المحلية. تظل قيمها الحالية داخل النموذج." /></div> : null}
      {restoreBlocked ? <div data-topic-form-draft-restore-blocked=""><AdminNotice variant="warning" presentation="compact" dismissible lifecycle="manual" dismissSearchParams={[]} message="توجد ملفات محلية لا يمكن نقلها ضمن استعادة النموذج. لم تُغيّر البيانات الحالية أو المسودة؛ أكمل اختيار الملفات أو تجاهل المسودة قبل المتابعة." /></div> : null}
      {candidates.map(candidate => {
        const merge = mergeTopicFormDraftFields(candidate.draft, currentFields, choices[candidate.key]);
        const conflict = !topicRevisionMatches(candidate.draft.baselineRevision, baselineRevision) || merge.conflicts.length > 0;
        const message = conflict ? "توجد مسودة محلية مع تغييرات في النسخة المحفوظة. تبقى الحقول المتعارضة على النسخة المحفوظة حتى تختار غير ذلك." : "توجد مسودة محلية غير محفوظة لهذا النموذج. اختر استعادتها أو تجاهلها؛ لم تُستبدل البيانات المحفوظة.";
        const dismissed = dismissedNotices[candidate.key] === candidate.raw && (candidate.aliases ?? [candidate]).every(snapshot => dismissedNotices[snapshot.key] === snapshot.raw);
        return <div key={candidate.key} className="min-w-0" data-topic-form-draft={conflict ? "conflict" : "pending"} data-topic-form-draft-key={candidate.key} data-topic-form-draft-alias-count={candidate.aliases?.length ?? 1} data-topic-form-draft-dismissed={dismissed || undefined}>
          {dismissed ? null : <AdminNotice variant="warning" presentation="compact" message={message} dismissible lifecycle="manual" dismissSearchParams={[]} onDismiss={() => dismissNotice(candidate)} actionContent={<>
            <time className="shrink-0 whitespace-nowrap text-xs text-white/50" dateTime={candidate.draft.savedAt} title={`التوقيت: ${ADMIN_TIME_ZONE}`}>{formatAdminDateTime(candidate.draft.savedAt)}</time>
            <AdminActionButton type="button" variant="gold" disabled={runtime?.pending} data-topic-form-draft-restore="" onClick={() => restore(candidate)}>استعادة المسودة</AdminActionButton><AdminActionButton type="button" variant="dark" disabled={runtime?.pending} data-topic-form-draft-discard="" onClick={() => discardCandidate(candidate)}>تجاهل المسودة</AdminActionButton>
          </>}>
          {merge.conflicts.map(name => <div key={name} className="mt-3 block min-w-0 text-sm" data-topic-form-draft-field-conflict={name}>
            <span className="block font-en text-white/70">{name}</span>
            <AdminListboxSelect className="mt-2" sizing="full" ariaLabel={`اختيار نسخة الحقل ${name}`} value={choices[candidate.key]?.[name] ?? "saved"} options={[{ value: "saved", label: "الاحتفاظ بالبيانات الحالية" }, { value: "draft", label: "استعادة تعديل المسودة لهذا الحقل" }]} onChange={value => setChoices(previous => ({ ...previous, [candidate.key]: { ...previous[candidate.key], [name]: value as "saved" | "draft" } }))} />
            <details className="mt-2 text-xs text-white/55"><summary>مقارنة القيم</summary><pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words">{`المحفوظة: ${(currentFields[name] ?? []).join("\n")}\nالمسودة: ${(candidate.draft.fields[name] ?? []).join("\n")}`}</pre></details>
          </div>)}
          </AdminNotice>}
        </div>;
      })}
      {opaqueDrafts.map(({ key, raw }) => <div key={key} className="min-w-0" data-topic-form-draft-opaque="" data-topic-form-draft-dismissed={dismissedNotices[key] === raw || undefined}>
        {dismissedNotices[key] === raw ? null : <AdminNotice variant="warning" presentation="compact" message="توجد مسودة قديمة بلا هوية مستخدم مثبتة، أو بإصدار غير مدعوم. احتُفظ بها دون عرض محتواها أو استعادتها إلى هذا النموذج." dismissible lifecycle="manual" dismissSearchParams={[]} onDismiss={() => dismissNotice({ key, raw })} actionContent={<AdminActionButton type="button" variant="dark" data-topic-form-draft-discard="" onClick={() => discard(key, raw)}>تجاهل هذه المسودة</AdminActionButton>} />}
      </div>)}
      {restored ? <div data-topic-form-draft="restored"><AdminNotice variant="warning" presentation="compact" message={retainedConflict ? "استُعيدت التغييرات المختارة. احتُفظ بالنسخة المحفوظة للحقول المتعارضة وبالمسودة الأصلية محليًا دون حذفها." : "استُعيدت المسودة محليًا. راجع التغييرات ثم احفظها عند الاستعداد."} dismissible lifecycle="manual" dismissSearchParams={[]} onDismiss={() => setRestored(false)} /></div> : null}
    </div>
  );
}

export default AdminPublicRichContentEditor;

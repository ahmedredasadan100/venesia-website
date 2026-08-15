const TOPIC_NULL_REVISION_TOKEN = "__venesia_null_topic_revision__";
export const TOPIC_REVISION_CONFLICT_CODE = "content_revision_conflict";
export const TOPIC_REVISION_CONFLICT_MESSAGE =
  "تم تحديث هذا المحتوى من جلسة أخرى. لم يتم الحفظ فوق النسخة الأحدث. حدّث الصفحة ثم اختر استرجاع المسودة المحلية أو تجاهلها.";

type ParsedTopicRevision =
  | { provided: false }
  | { provided: true; value: string | null };

type TopicDraftRecord = {
  version: 1;
  content: string;
  baselineRevision: string | null;
  savedAt: string;
};

export type TopicDraftCandidate = TopicDraftRecord & { legacy: boolean };

export function parseTopicDraft(raw: string | null): TopicDraftCandidate | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.version === 1 &&
      typeof parsed.content === "string" &&
      (typeof parsed.baselineRevision === "string" || parsed.baselineRevision === null) &&
      typeof parsed.savedAt === "string"
    ) {
      return {
        version: 1,
        content: parsed.content,
        baselineRevision: parsed.baselineRevision,
        savedAt: parsed.savedAt,
        legacy: false,
      };
    }
  } catch {
    // Pre-revision drafts were raw text, including text that is not valid JSON.
  }

  return {
    version: 1,
    content: raw,
    baselineRevision: null,
    savedAt: "",
    legacy: true,
  };
}

export function createTopicDraft(
  content: string,
  baselineRevision: string | null,
): TopicDraftRecord {
  return {
    version: 1,
    content,
    baselineRevision,
    savedAt: new Date().toISOString(),
  };
}

export function encodeTopicRevision(value: string | null) {
  return value ?? TOPIC_NULL_REVISION_TOKEN;
}

export function parseTopicRevisionToken(value: unknown): ParsedTopicRevision {
  if (value === TOPIC_NULL_REVISION_TOKEN) {
    return { provided: true, value: null };
  }
  if (typeof value !== "string" || !value.trim()) {
    return { provided: false };
  }
  return { provided: true, value: value.trim() };
}

export function topicRevisionMatches(
  expected: string | null,
  current: string | null | undefined,
) {
  return expected === (current ?? null);
}

export class TopicRevisionConflictError extends Error {
  readonly code = TOPIC_REVISION_CONFLICT_CODE;

  constructor() {
    super(TOPIC_REVISION_CONFLICT_MESSAGE);
    this.name = "TopicRevisionConflictError";
  }
}

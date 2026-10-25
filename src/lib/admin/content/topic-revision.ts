import { isContentType, type ContentType } from "./content-types";

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

/** The existing Topic draft namespace; unrelated local preferences are never cleared. */
export const TOPIC_DRAFT_STORAGE_PREFIX = "venesia-topic-editor-draft";
export const TOPIC_DRAFT_SESSION_END_EVENT = "venesia-topic-draft-session-ended";
export const TOPIC_DRAFT_LOGOUT_STORAGE_KEY = "venesia-topic-editor-draft-session-logout";
export const TOPIC_DRAFT_SESSION_END_STORAGE_PREFIX = "venesia-topic-editor-draft-session-ended:";

/** 128-bit writer identity also works on the existing HTTP development boundary. */
export function createTopicDraftWriterId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, "0")).join("");
}

/** Credential-free session metadata, consumed from the existing verified Admin session. */
export type TopicDraftSession = {
  actorId: number;
  sessionVersion: number;
  /** Actual signed-cookie expiry, in milliseconds; never an inferred default TTL. */
  expiresAt: number;
};

export type TopicFormDraftScope = TopicDraftSession & {
  contentType: ContentType;
  entity: string;
};

export type TopicFormDraftFields = Record<string, string[]>;

export type TopicFormDraftRecord = {
  version: 2;
  fieldVersion: 1;
  scope: TopicFormDraftScope;
  baselineRevision: string | null;
  savedAt: string;
  writerId: string;
  fields: TopicFormDraftFields;
  baselineFields: TopicFormDraftFields;
};

export type TopicFormDraftParseResult =
  | { status: "valid"; draft: TopicFormDraftRecord }
  | { status: "missing" | "legacy" | "unsupported" | "invalid" | "scope_mismatch" | "expired" };

const SHARED_TOPIC_DRAFT_FIELDS = [
  "title", "slug", "excerpt", "content", "category_id", "series_id",
  "image", "image_alt", "seo_title", "seo_description", "seo_keywords",
  "focus_keyword", "canonical_url", "robots_index", "robots_follow",
  "og_image", "og_image_alt", "show_title_on_page", "show_image_on_page",
  "show_excerpt_on_page", "show_date_on_page", "show_category_on_page",
  "show_series_on_page", "show_intro_card_on_page", "status",
  "content_publication_toggle", "is_featured", "is_popular", "published_at", "date_label",
] as const;

const ARTICLE_TOPIC_DRAFT_FIELDS = [
  "faq_question", "faq_answer", "show_faq_on_page", "show_faq_title_on_page",
] as const;
const VIDEO_TOPIC_DRAFT_FIELDS = [
  "video_provider", "video_url", "video_start_seconds", "video_thumbnail", "video_duration",
] as const;
const GALLERY_TOPIC_DRAFT_FIELDS = [
  "gallery_image_url", "gallery_image_alt", "gallery_image_caption",
] as const;

/** Names belong to the six existing native form contracts, not a generic storage serializer. */
export function getTopicFormDraftFieldNames(contentType: ContentType): readonly string[] {
  return [
    ...SHARED_TOPIC_DRAFT_FIELDS,
    ...(contentType === "article" ? ARTICLE_TOPIC_DRAFT_FIELDS : []),
    ...(contentType === "video" ? VIDEO_TOPIC_DRAFT_FIELDS : []),
    ...(contentType === "gallery" ? GALLERY_TOPIC_DRAFT_FIELDS : []),
    ...(contentType === "news" || contentType === "site_update" ? ["media_project"] : []),
  ];
}

const TOPIC_DRAFT_URL_FIELDS = new Set([
  "image", "og_image", "canonical_url", "video_url", "video_thumbnail", "gallery_image_url",
]);
const SENSITIVE_URL_PARAMETER = /^(?:access[-_]?token|refresh[-_]?token|id[-_]?token|auth[-_]?token|session[-_]?token|jwt|token|auth|authorization|password|passwd|secret|client[-_]?secret|(?:x[-_])?api[-_]?key|x[-_]vercel[-_]protection[-_]bypass|signature|sig|x[-_]amz[-_](?:signature|credential|security[-_]token)|x[-_]goog[-_](?:signature|credential)|key[-_]pair[-_]id|policy)$/i;

function topicDraftUrlIsUnsupported(value: string) {
  if (!value.trim()) return false;
  // An unfinished or malformed authority can make URL parsing throw while
  // the user is still typing credentials. Exclude it before that parser path.
  if (/^(?:[a-z][a-z\d+.-]*:)?[\\/]{2}[^\\/?#]*@/i.test(value.trim())) return true;
  try {
    const url = new URL(value, "https://topic-draft.invalid");
    if (url.username || url.password || !["https:", "http:"].includes(url.protocol)) return true;
    const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
    return [...url.searchParams.keys(), ...fragment.keys()].some((key) => SENSITIVE_URL_PARAMETER.test(key));
  } catch {
    // A draft is allowed to contain an incomplete URL while the user types it.
    // Credential-like query names still must not be persisted in that draft.
    return value.split(/[?&#]/).slice(1).some(part => {
      const key = part.split("=", 1)[0];
      try { return SENSITIVE_URL_PARAMETER.test(decodeURIComponent(key.replace(/\+/g, " "))); }
      catch { return SENSITIVE_URL_PARAMETER.test(key); }
    });
  }
}

/** Preserve raw editable values and row order; exclude sensitive values instead of rewriting them. */
export function collectTopicFormDraftFields(
  data: FormData,
  contentType: ContentType,
): { fields: TopicFormDraftFields; excludedFields: string[] } {
  const names = getTopicFormDraftFieldNames(contentType);
  const fields: TopicFormDraftFields = Object.fromEntries(names.map((name) => [name, []]));
  const excluded = new Set<string>();
  for (const name of names) {
    const values = data.getAll(name);
    if (values.some((value) => typeof value !== "string" || (TOPIC_DRAFT_URL_FIELDS.has(name) && topicDraftUrlIsUnsupported(value)))) {
      excluded.add(name);
      delete fields[name];
      continue;
    }
    fields[name] = values as string[];
  }
  if (excluded.has("gallery_image_url")) {
    for (const name of GALLERY_TOPIC_DRAFT_FIELDS) {
      excluded.add(name);
      delete fields[name];
    }
  }
  return { fields, excludedFields: [...excluded] };
}

function isPlainTopicDraftObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isTopicDraftSession(value: unknown): value is TopicDraftSession {
  return isPlainTopicDraftObject(value)
    && Number.isSafeInteger(value.actorId) && Number(value.actorId) > 0
    && Number.isSafeInteger(value.sessionVersion) && Number(value.sessionVersion) >= 0
    && Number.isSafeInteger(value.expiresAt) && Number(value.expiresAt) > 0;
}

function isTopicFormDraftScope(value: unknown): value is TopicFormDraftScope {
  if (!isPlainTopicDraftObject(value)) return false;
  const { contentType, entity } = value;
  return isTopicDraftSession(value)
    && isContentType(contentType)
    && typeof entity === "string"
    && (entity === "create" || /^[1-9]\d*$/.test(entity));
}

export function getTopicFormDraftSessionPrefix(session: TopicDraftSession) {
  if (!isTopicDraftSession(session)) throw new Error("Invalid Topic draft session");
  return `${TOPIC_DRAFT_STORAGE_PREFIX}:form:v2:${session.actorId}:${session.sessionVersion}:${session.expiresAt}:`;
}

export function getTopicFormDraftPrefix(scope: TopicFormDraftScope) {
  if (!isTopicFormDraftScope(scope)) throw new Error("Invalid Topic draft scope");
  return `${getTopicFormDraftSessionPrefix(scope)}${scope.contentType}:${scope.entity}:`;
}

export function getTopicFormDraftKey(scope: TopicFormDraftScope, writerId: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(writerId)) throw new Error("Invalid Topic draft writer");
  return `${getTopicFormDraftPrefix(scope)}${writerId}`;
}

export function createTopicFormDraft(
  scope: TopicFormDraftScope,
  baselineRevision: string | null,
  writerId: string,
  fields: TopicFormDraftFields,
  savedAt = new Date().toISOString(),
  baselineFields: TopicFormDraftFields = fields,
): TopicFormDraftRecord {
  // Validate through the same parser used on recovery, including the field allowlist.
  getTopicFormDraftKey(scope, writerId);
  const record: TopicFormDraftRecord = {
    version: 2, fieldVersion: 1, scope: { ...scope }, baselineRevision,
    savedAt, writerId,
    fields: Object.fromEntries(Object.entries(fields).map(([name, values]) => [name, [...values]])),
    baselineFields: Object.fromEntries(Object.entries(baselineFields).map(([name, values]) => [name, [...values]])),
  };
  const result = parseTopicFormDraft(JSON.stringify(record), scope);
  if (result.status !== "valid") throw new Error(`Invalid Topic draft record: ${result.status}`);
  return result.draft;
}

/** Unowned legacy and unsupported records remain opaque: this parser never exposes their content. */
export function parseTopicFormDraft(
  raw: string | null,
  scope: TopicFormDraftScope,
  now = Date.now(),
): TopicFormDraftParseResult {
  if (raw === null) return { status: "missing" };
  if (!isTopicFormDraftScope(scope)) return { status: "invalid" };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { status: "legacy" }; }
  if (!isPlainTopicDraftObject(parsed) || parsed.version === 1 || parsed.version === undefined) return { status: "legacy" };
  if (parsed.version !== 2 || parsed.fieldVersion !== 1) return { status: "unsupported" };
  if (parsed.baselineFields === undefined) return { status: "unsupported" };
  if (!isTopicFormDraftScope(parsed.scope)
    || (typeof parsed.baselineRevision !== "string" && parsed.baselineRevision !== null)
    || typeof parsed.savedAt !== "string" || !Number.isFinite(Date.parse(parsed.savedAt))
    || typeof parsed.writerId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(parsed.writerId)
    || !isPlainTopicDraftObject(parsed.fields)
    || !isPlainTopicDraftObject(parsed.baselineFields)
    || Object.keys(parsed).some((key) => !["version", "fieldVersion", "scope", "baselineRevision", "savedAt", "writerId", "fields", "baselineFields"].includes(key))
    || Object.keys(parsed.scope).some((key) => !["actorId", "sessionVersion", "expiresAt", "contentType", "entity"].includes(key))) return { status: "invalid" };
  const parsedScope = parsed.scope;
  if ((Object.keys(scope) as Array<keyof TopicFormDraftScope>).some((key) => parsedScope[key] !== scope[key])) return { status: "scope_mismatch" };
  if (scope.expiresAt <= now) return { status: "expired" };
  const names = new Set(getTopicFormDraftFieldNames(scope.contentType));
  function parseFields(value: Record<string, unknown>): TopicFormDraftFields | null {
    const result: TopicFormDraftFields = {};
    for (const [name, values] of Object.entries(value)) {
      if (!names.has(name) || !Array.isArray(values)
        || values.some((entry) => typeof entry !== "string" || (TOPIC_DRAFT_URL_FIELDS.has(name) && topicDraftUrlIsUnsupported(entry)))) return null;
      result[name] = [...values];
    }
    return result;
  }
  const fields = parseFields(parsed.fields);
  const baselineFields = parseFields(parsed.baselineFields);
  if (!fields || !baselineFields) return { status: "invalid" };
  return { status: "valid", draft: {
    version: 2, fieldVersion: 1, scope: { ...scope }, baselineRevision: parsed.baselineRevision,
    savedAt: parsed.savedAt, writerId: parsed.writerId, fields, baselineFields,
  } };
}

/** A conflict is represented by the first name of its atomic field group. */
export function mergeTopicFormDraftFields(
  draft: TopicFormDraftRecord,
  current: TopicFormDraftFields,
  choices: Record<string, "saved" | "draft"> = {},
): { fields: TopicFormDraftFields; conflicts: string[]; retainedConflicts: string[] } {
  const fields = Object.fromEntries(Object.entries(current).map(([name, values]) => [name, [...values]]));
  const groups: string[][] = [
    [...GALLERY_TOPIC_DRAFT_FIELDS],
    ["faq_question", "faq_answer"],
    [...VIDEO_TOPIC_DRAFT_FIELDS],
    ["status", "content_publication_toggle"],
  ];
  const grouped = new Set(groups.flat());
  groups.push(...getTopicFormDraftFieldNames(draft.scope.contentType).filter((name) => !grouped.has(name)).map((name) => [name]));
  const conflicts: string[] = [];
  const retainedConflicts: string[] = [];
  const same = (left: string[], right: string[]) => JSON.stringify(left) === JSON.stringify(right);
  for (const group of groups) {
    // A removed/inapplicable, unsupported or newly server-owned field is not restored.
    if (group.some((name) => !Object.hasOwn(draft.fields, name) || !Object.hasOwn(draft.baselineFields, name) || !Object.hasOwn(current, name))) continue;
    if (!group.some((name) => !same(draft.fields[name], draft.baselineFields[name]))) continue;
    const conflict = group.some((name) => !same(current[name], draft.baselineFields[name]))
      && group.some((name) => !same(current[name], draft.fields[name]));
    if (conflict) {
      const representative = group[0];
      conflicts.push(representative);
      if (choices[representative] !== "draft") {
        retainedConflicts.push(representative);
        continue;
      }
    }
    for (const name of group) fields[name] = [...draft.fields[name]];
  }
  return { fields, conflicts, retainedConflicts };
}

type TopicDraftStorage = Pick<Storage, "length" | "key" | "getItem" | "removeItem"> & Partial<Pick<Storage, "setItem">>;

/** A metadata-only tombstone cannot collide with, contain or expose draft content. */
export function getTopicDraftSessionEndKey(session: TopicDraftSession) {
  if (!isTopicDraftSession(session)) throw new Error("Invalid Topic draft session");
  return `${TOPIC_DRAFT_SESSION_END_STORAGE_PREFIX}${session.actorId}:${session.sessionVersion}:${session.expiresAt}`;
}

export function pruneTopicDraftSessionEndMarkers(storage: TopicDraftStorage, now = Date.now()) {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
  let removed = 0;
  for (const key of keys) {
    if (!key?.startsWith(TOPIC_DRAFT_SESSION_END_STORAGE_PREFIX)) continue;
    const suffix = key.slice(TOPIC_DRAFT_SESSION_END_STORAGE_PREFIX.length);
    const parts = suffix.split(":");
    if (parts.length !== 3 || !/^[1-9]\d*$/.test(parts[0]) || !/^\d+$/.test(parts[1]) || !/^[1-9]\d*$/.test(parts[2])) continue;
    const expiresAt = Number(parts[2]);
    if (Number.isSafeInteger(expiresAt) && expiresAt <= now) { storage.removeItem(key); removed += 1; }
  }
  return removed;
}

export function removeTopicFormDraftIfUnchanged(storage: TopicDraftStorage, key: string, expectedRaw: string) {
  if (!key.startsWith(`${TOPIC_DRAFT_STORAGE_PREFIX}:`) || storage.getItem(key) !== expectedRaw) return false;
  storage.removeItem(key);
  return true;
}

/** Explicit logout cleanup; never calls localStorage.clear or removes other application storage. */
export function cleanupTopicDraftStorage(storage: TopicDraftStorage) {
  // Stop mounted writers before deletion: their pagehide/unmount cleanup must
  // not recreate the local content that successful logout just removed.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(TOPIC_DRAFT_SESSION_END_EVENT));
    try { storage.setItem?.(TOPIC_DRAFT_LOGOUT_STORAGE_KEY, createTopicDraftWriterId()); } catch { /* Content cleanup still proceeds if metadata storage is unavailable. */ }
  }
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .filter((key): key is string => key !== null && key.startsWith(`${TOPIC_DRAFT_STORAGE_PREFIX}:`));
  for (const key of keys) storage.removeItem(key);
  return keys.length;
}

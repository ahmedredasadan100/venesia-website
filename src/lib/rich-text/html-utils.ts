const ALLOWED_TAGS = new Set(["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "a"]);

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeHtmlAttr(value: string) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function decodeBasicEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'");
}

/** Detects stored TipTap / HTML fragments (not plain text). */
export function isHtmlContent(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /<[a-z][\s\S]*>/i.test(trimmed);
}

/** Converts legacy plain text (or existing HTML) into TipTap-friendly HTML. */
export function normalizeRichTextContent(value: string) {
  const source = value.replace(/\r\n/g, "\n").trim();
  if (!source) return "";

  if (isHtmlContent(source)) {
    return source;
  }

  return source
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

/** Strips HTML tags for plain-text fields (excerpt, short description, SEO). */
export function stripHtml(value: string) {
  if (!value) return "";

  return decodeBasicEntities(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n"),
  ).trim();
}

function sanitizeHref(href: string) {
  const trimmed = href.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) return trimmed;
  if (/^mailto:/i.test(trimmed) || /^tel:/i.test(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

function sanitizeAnchorTag(tag: string) {
  const hrefMatch = tag.match(/href=("([^"]*)"|'([^']*)'|([^\s>]+))/i);
  const href = hrefMatch ? (hrefMatch[2] ?? hrefMatch[3] ?? hrefMatch[4] ?? "") : "";
  const safeHref = sanitizeHref(href);
  return safeHref
    ? `<a href="${escapeHtmlAttr(safeHref)}" rel="noopener noreferrer" target="_blank">`
    : "<a>";
}

/** Allowlists TipTap output tags and removes unsafe attributes/content. */
export function sanitizeRichTextHtml(value: string) {
  const source = value.trim();
  if (!source) return "";

  const normalized = isHtmlContent(source) ? source : normalizeRichTextContent(source);

  let sanitized = normalized
    .replace(/<(script|style|iframe|object|embed|form|meta|link)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|iframe|object|embed|form|meta|link)[^>]*\/>/gi, "")
    .replace(/\s(on\w+|style)=(".*?"|'.*?'|[^\s>]+)/gi, "");

  sanitized = sanitized.replace(/<a\b[^>]*>/gi, (tag) => sanitizeAnchorTag(tag));

  sanitized = sanitized.replace(/<\/?([a-z0-9]+)\b[^>]*>/gi, (match, tagName) => {
    const tag = String(tagName).toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (match.startsWith("</")) return `</${tag}>`;
    if (tag === "br") return "<br />";
    if (tag === "a") return match;
    return `<${tag}>`;
  });

  return sanitized;
}

/** Returns sanitized HTML ready for dangerouslySetInnerHTML (single choke point). */
export function renderRichTextHtml(value: string) {
  return sanitizeRichTextHtml(value);
}

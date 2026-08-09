import { demoteArticleHeadingHierarchy } from "./article-heading-semantics";

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "h1",
  "h2",
  "h3",
  "blockquote",
  "ul",
  "ol",
  "li",
  "a",
]);

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

function renderMarkdownInline(value: string) {
  const links: string[] = [];
  const tokenized = value.replace(
    /\[([^\]\n]+)\]\(([^)\s]+)\)/g,
    (source, label: string, href: string) => {
      const safeHref = sanitizeHref(href);
      if (!safeHref) return source;

      const token = `\u0007VENESIALINK${links.length}\u0007`;
      links.push(
        `<a href="${escapeHtmlAttr(safeHref)}">${renderMarkdownInlineFormatting(label)}</a>`,
      );
      return token;
    },
  );

  let output = renderMarkdownInlineFormatting(tokenized);
  links.forEach((link, index) => {
    output = output.replace(`\u0007VENESIALINK${index}\u0007`, link);
  });
  return output;
}

function renderMarkdownInlineFormatting(value: string) {
  let output = escapeHtml(value);
  output = output.replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/__([\s\S]+?)__/g, "<strong>$1</strong>");
  output = output.replace(/&lt;u&gt;([\s\S]*?)&lt;\/u&gt;/g, "<u>$1</u>");
  output = output.replace(/\*([\s\S]+?)\*/g, "<em>$1</em>");
  output = output.replace(/_([\s\S]+?)_/g, "<em>$1</em>");
  return output;
}

/** Converts the existing Article Markdown contract into TipTap-compatible HTML. */
export function markdownToRichTextHtml(value: string) {
  const normalized = value.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";

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
    html.push(
      `<p>${renderMarkdownInline(paragraphLines.join("\n")).replace(/\n/g, "<br />")}</p>`,
    );
    paragraphLines = [];
  }

  for (const rawLine of lines) {
    const line = rawLine
      .trim()
      .replace(/^\*{4}(?=\S)/, "**")
      .replace(/^\*\*(#{1,3}\s+)/, "$1");

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
      html.push(`<h${level}>${renderMarkdownInline(heading[2])}</h${level}>`);
      continue;
    }

    const aligned = /^::(right|center|left|justify)::\s*(.+)$/.exec(line);
    if (aligned) {
      closeParagraph();
      closeList();
      html.push(
        `<p style="text-align: ${aligned[1]}">${renderMarkdownInline(aligned[2])}</p>`,
      );
      continue;
    }

    const quote = /^>\s*(.+)$/.exec(line);
    if (quote) {
      closeParagraph();
      closeList();
      html.push(`<blockquote><p>${renderMarkdownInline(quote[1])}</p></blockquote>`);
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
      html.push(`<li>${renderMarkdownInline(unordered[1])}</li>`);
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
      html.push(`<li>${renderMarkdownInline(ordered[1])}</li>`);
      continue;
    }

    closeList();
    paragraphLines.push(line);
  }

  closeParagraph();
  closeList();
  return html.join("");
}

function htmlInlineToMarkdown(value: string) {
  let output = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, "**$2**")
    .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, "*$2*")
    .replace(/<u>([\s\S]*?)<\/u>/gi, "<u>$1</u>")
    .replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (source, attributes: string, label: string) => {
      const hrefMatch = attributes.match(/href=("([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const href = hrefMatch ? (hrefMatch[2] ?? hrefMatch[3] ?? hrefMatch[4] ?? "") : "";
      const safeHref = sanitizeHref(decodeBasicEntities(href));
      return safeHref ? `[${label}](${safeHref})` : label;
    })
    .replace(/<[^>]+>/g, "");

  output = decodeBasicEntities(output).replace(/\u00a0/g, " ");
  return output.trim();
}

/** Serializes sanitized TipTap HTML back into the unchanged Article Markdown storage contract. */
export function richTextHtmlToMarkdown(value: string) {
  let html = sanitizeRichTextHtml(value).replace(/\r?\n/g, "");
  if (!html) return "";

  html = html.replace(/<(ul|ol)>([\s\S]*?)<\/\1>/gi, (_, type: "ul" | "ol", body: string) => {
    let index = 0;
    const items = Array.from(body.matchAll(/<li>([\s\S]*?)<\/li>/gi)).map((match) => {
      index += 1;
      const prefix = type.toLowerCase() === "ol" ? `${index}. ` : "- ";
      return `${prefix}${htmlInlineToMarkdown(match[1])}`;
    });
    return items.length ? `${items.join("\n")}\n\n` : "";
  });

  html = html
    .replace(/<h([1-3])>([\s\S]*?)<\/h\1>/gi, (_, level: string, content: string) => {
      return `${"#".repeat(Number(level))} ${htmlInlineToMarkdown(content)}\n`;
    })
    .replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, (_, content: string) => {
      const text = htmlInlineToMarkdown(content);
      return text ? `${text.split("\n").map((line) => `> ${line}`).join("\n")}\n\n` : "";
    })
    .replace(/<p([^>]*)>([\s\S]*?)<\/p>/gi, (_, attributes: string, content: string) => {
      const style = readSafeTextAlignFromTag(`<p${attributes}>`);
      const alignment = style?.replace("text-align: ", "");
      const text = htmlInlineToMarkdown(content);
      const prefix = alignment && alignment !== "right" ? `::${alignment}:: ` : "";
      return text ? `${prefix}${text}\n\n` : "";
    });

  return htmlInlineToMarkdown(html)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Normalizes legacy HTML Articles at the editor boundary without changing their storage schema. */
export function normalizeArticleMarkdown(value: string) {
  const source = value.replace(/\r\n/g, "\n").trim();
  if (!source) return "";
  return isHtmlContent(source) ? richTextHtmlToMarkdown(source) : source;
}

function sanitizeTextAlignStyle(styleValue: string) {
  const match = styleValue.match(/(?:^|;)\s*text-align\s*:\s*(right|center|left|justify)\s*(?:;|$)/i);
  if (!match) return null;
  return `text-align: ${match[1].toLowerCase()}`;
}

function readSafeTextAlignFromTag(tag: string) {
  const styleMatch = tag.match(/\sstyle=("([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (!styleMatch) return null;
  const styleValue = styleMatch[2] ?? styleMatch[3] ?? styleMatch[4] ?? "";
  return sanitizeTextAlignStyle(styleValue);
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
    .replace(/\s(on\w+)=(".*?"|'.*?'|[^\s>]+)/gi, "");

  sanitized = sanitized.replace(/<a\b[^>]*>/gi, (tag) => sanitizeAnchorTag(tag));

  sanitized = sanitized.replace(/<\/?([a-z0-9]+)\b[^>]*>/gi, (match, tagName) => {
    const tag = String(tagName).toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (match.startsWith("</")) return `</${tag}>`;
    if (tag === "br") return "<br />";
    if (tag === "a") return match;

    // Preserve TipTap paragraph text-align only; drop every other inline style/attr.
    if (tag === "p") {
      const textAlign = readSafeTextAlignFromTag(match);
      return textAlign ? `<p style="${textAlign}">` : "<p>";
    }

    return `<${tag}>`;
  });

  return sanitized;
}

/** Returns sanitized HTML ready for dangerouslySetInnerHTML (single choke point). */
export function renderRichTextHtml(value: string) {
  return sanitizeRichTextHtml(value);
}

/** Returns sanitized Article Markdown as HTML for Admin Preview and public presentation. */
export function renderArticleMarkdownHtml(
  value: string,
  options: { demoteHeadings?: boolean } = {},
) {
  const html = sanitizeRichTextHtml(markdownToRichTextHtml(normalizeArticleMarkdown(value)));
  return options.demoteHeadings ? demoteArticleHeadingHierarchy(html) : html;
}

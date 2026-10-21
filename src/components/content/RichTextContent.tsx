import {
  isHtmlContent,
  renderArticleMarkdownHtml,
  renderRichTextHtml,
  stripHtml,
} from "../../lib/rich-text/html-utils";

import { demoteArticleHeadingHierarchy } from "../../lib/rich-text/article-heading-semantics";

export type RichTextContentProps = {
  value?: string | null;
  className?: string;
  /** rich = stored HTML; markdown = Article Markdown; plain = strip tags; auto = detect HTML */
  mode?: "rich" | "markdown" | "plain" | "auto";
  /** Opt into the existing semantic heading hierarchy for stored rich content. */
  demoteHeadings?: boolean;
};

/**
 * Renders CMS rich text safely. Only this component (and JsonLd) should use dangerouslySetInnerHTML for content.
 */
export default function RichTextContent({
  value,
  className = "",
  mode = "auto",
  demoteHeadings = false,
}: RichTextContentProps) {
  const raw = value?.trim() ?? "";
  if (!raw) return null;

  if (mode === "markdown") {
    return (
      <div
        className={`rich-text-content ${className}`.trim()}
        dir="rtl"
        dangerouslySetInnerHTML={{
          __html: renderArticleMarkdownHtml(raw, { demoteHeadings }),
        }}
      />
    );
  }

  const useRichHtml = mode === "rich" || (mode === "auto" && isHtmlContent(raw));

  if (useRichHtml) {
    const html = renderRichTextHtml(raw);
    return (
      <div
        className={`rich-text-content ${className}`.trim()}
        dir="rtl"
        dangerouslySetInnerHTML={{ __html: demoteHeadings ? demoteArticleHeadingHierarchy(html) : html }}
      />
    );
  }

  return <span className={className}>{stripHtml(raw)}</span>;
}

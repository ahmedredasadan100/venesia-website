import {
  isHtmlContent,
  renderArticleMarkdownHtml,
  renderRichTextHtml,
  stripHtml,
} from "../../lib/rich-text/html-utils";

export type RichTextContentProps = {
  value?: string | null;
  className?: string;
  /** rich = stored HTML; markdown = Article Markdown; plain = strip tags; auto = detect HTML */
  mode?: "rich" | "markdown" | "plain" | "auto";
};

/**
 * Renders CMS rich text safely. Only this component (and JsonLd) should use dangerouslySetInnerHTML for content.
 */
export default function RichTextContent({
  value,
  className = "",
  mode = "auto",
}: RichTextContentProps) {
  const raw = value?.trim() ?? "";
  if (!raw) return null;

  if (mode === "markdown") {
    return (
      <div
        className={`rich-text-content ${className}`.trim()}
        dir="rtl"
        dangerouslySetInnerHTML={{ __html: renderArticleMarkdownHtml(raw) }}
      />
    );
  }

  const useRichHtml = mode === "rich" || (mode === "auto" && isHtmlContent(raw));

  if (useRichHtml) {
    return (
      <div
        className={`rich-text-content ${className}`.trim()}
        dir="rtl"
        dangerouslySetInnerHTML={{ __html: renderRichTextHtml(raw) }}
      />
    );
  }

  return <span className={className}>{stripHtml(raw)}</span>;
}

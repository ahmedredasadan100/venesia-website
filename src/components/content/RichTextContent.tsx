import { isHtmlContent, renderRichTextHtml, stripHtml } from "../../lib/rich-text/html-utils";

export type RichTextContentProps = {
  value?: string | null;
  className?: string;
  /** rich = always HTML; plain = always strip tags; auto = detect stored HTML */
  mode?: "rich" | "plain" | "auto";
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

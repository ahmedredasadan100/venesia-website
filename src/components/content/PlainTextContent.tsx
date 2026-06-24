import { stripHtml } from "../../lib/rich-text/html-utils";

type PlainTextContentProps = {
  value?: string | null;
  className?: string;
  as?: "span" | "p";
};

/** Plain-text fields: strips accidental HTML before display (excerpt, short description, etc.). */
export default function PlainTextContent({
  value,
  className = "",
  as: Tag = "span",
}: PlainTextContentProps) {
  const text = stripHtml(value ?? "");
  if (!text) return null;
  return <Tag className={className}>{text}</Tag>;
}

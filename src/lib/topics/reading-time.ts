/** Matches admin TopicMarkdownEditor: ~220 words per minute. */
const WORDS_PER_MINUTE = 220;

function plainTextWordCount(value: string): number {
  const plain = value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/[#>*_\-~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!plain) return 0;
  return plain.split(/\s+/).filter(Boolean).length;
}

/** Returns Arabic label like "٣ دقائق" or empty when content is missing. */
export function estimateReadingTimeLabel(content: string | null | undefined): string {
  const words = plainTextWordCount(content ?? "");
  if (words <= 0) return "";

  const minutes = Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
  return `${minutes} دقيقة`;
}

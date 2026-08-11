/** Matches the shared content editor estimate: approximately 220 words per minute. */
const WORDS_PER_MINUTE = 220;

function plainTextWordCount(value: string) {
  const plain = value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/[#>*_\-~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return plain ? plain.split(/\s+/).filter(Boolean).length : 0;
}

export function estimateReadingTimeLabel(content: string | null | undefined) {
  const words = plainTextWordCount(content ?? "");
  if (words <= 0) return "";
  return `${Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))} دقيقة`;
}

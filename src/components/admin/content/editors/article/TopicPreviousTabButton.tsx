"use client";

import { navigateTopicEditor } from "./topic-editor-navigation";

export default function TopicPreviousTabButton({
  tab = "seo",
  disabled = false,
}: {
  tab?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => navigateTopicEditor(tab)}
      disabled={disabled}
      className="inline-flex min-h-11 min-w-[7.5rem] flex-1 items-center justify-center rounded-full border border-white/15 px-3 py-2.5 text-sm font-medium text-white/65 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-45 sm:min-w-[8.5rem] sm:flex-none sm:px-4"
    >
      السابق
    </button>
  );
}

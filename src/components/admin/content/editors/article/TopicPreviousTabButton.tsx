"use client";

import { navigateTopicEditor } from "./topic-editor-navigation";

export default function TopicPreviousTabButton({ tab = "seo" }: { tab?: string }) {
  return <button type="button" onClick={() => navigateTopicEditor(tab)} className="rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white/65 transition hover:border-white/30 hover:text-white">السابق</button>;
}

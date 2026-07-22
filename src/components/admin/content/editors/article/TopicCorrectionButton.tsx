"use client";

import { navigateTopicEditor } from "./topic-editor-navigation";

type TopicCorrectionButtonProps = {
  tabId: string;
  targetId?: string;
  className?: string;
};

export default function TopicCorrectionButton({
  tabId,
  targetId,
  className = "",
}: TopicCorrectionButtonProps) {
  return (
    <button
      type="button"
      onClick={() => navigateTopicEditor(tabId, targetId)}
      className={`shrink-0 rounded-lg border border-[#D8B87A]/28 bg-[#D8B87A]/8 px-3 py-1.5 text-xs font-semibold text-[#F2D99B] transition hover:border-[#D8B87A]/50 hover:bg-[#D8B87A]/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]/55 ${className}`}
    >
      تصحيح
    </button>
  );
}

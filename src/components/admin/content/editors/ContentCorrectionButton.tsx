"use client";

import { navigateContentEditor } from "./content-editor-navigation";

export default function ContentCorrectionButton({
  tabId,
  targetId,
  className = "",
}: {
  tabId: string;
  targetId?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => navigateContentEditor({ tabId, targetId })}
      className={`shrink-0 rounded-lg border border-[#D8B87A]/28 bg-[#D8B87A]/8 px-3 py-1.5 text-xs font-semibold text-[#F2D99B] transition hover:border-[#D8B87A]/50 hover:bg-[#D8B87A]/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]/55 ${className}`}
    >
      إصلاح
    </button>
  );
}

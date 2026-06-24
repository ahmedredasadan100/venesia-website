"use client";

import { useState } from "react";

type CopySlugButtonProps = {
  slug: string;
};

export default function CopySlugButton({ slug }: CopySlugButtonProps) {
  const [copied, setCopied] = useState(false);
  const publicPath = `/topics/${slug}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(publicPath);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-lg border border-white/10 px-2 py-1 font-ar text-[11px] text-white/45 transition hover:border-[#D8B87A]/35 hover:text-[#D8B87A]"
      title="نسخ رابط الموضوع"
    >
      {copied ? "تم النسخ" : "نسخ"}
    </button>
  );
}

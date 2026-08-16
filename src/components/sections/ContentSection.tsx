import type { BlockRendererProps } from "./block-registry";
import type { ContentBlockConfig } from "../../lib/page-blocks";
import RichTextContent from "../content/RichTextContent";

export default function ContentSection({ block }: BlockRendererProps) {
  const config = block.template.config as ContentBlockConfig;
  const variant = block.template.variant ?? "default";
  const centered = config.alignment === "center";
  const alignmentClass = centered ? "text-center" : "text-right";
  const contentWidthClass = centered ? "mx-auto" : "ml-auto";

  return (
    <section
      className="relative py-10 md:py-12"
      data-block-variant={variant}
      dir="rtl"
    >
      <div className={`mx-auto max-w-7xl px-6 ${alignmentClass}`}>
        {config.eyebrow ? (
          <p className="font-en text-[10px] uppercase tracking-[0.22em] text-[#D8B87A]/55">{config.eyebrow}</p>
        ) : null}

        {config.title ? (
          <h2 className="mt-3 text-2xl font-bold leading-tight tracking-[-0.03em] text-white md:text-[2rem]">
            {config.title}
          </h2>
        ) : null}

        {config.subtitle ? (
          <RichTextContent
            value={config.subtitle}
            mode="auto"
            className={`mt-4 block max-w-3xl whitespace-pre-line text-[15px] leading-8 text-white/64 md:text-base md:leading-9 ${contentWidthClass}`}
          />
        ) : null}

        {config.body?.trim() ? (
          <RichTextContent
            value={config.body}
            mode="auto"
            className={`mt-5 block max-w-3xl whitespace-pre-line text-[15px] leading-8 text-white/68 md:text-base md:leading-9 ${contentWidthClass} [&_a]:text-[#E8D5A8] [&_a]:underline [&_blockquote]:my-4 [&_blockquote]:border-r-2 [&_blockquote]:border-[#D8B87A]/45 [&_blockquote]:pr-4 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:mb-1.5 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pr-5 [&_p]:mb-4 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_strong]:text-white/90 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pr-5`}
          />
        ) : null}
      </div>
    </section>
  );
}

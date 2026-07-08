import type { BlockRendererProps } from "./block-registry";
import type { ContentBlockConfig } from "../../lib/page-blocks";

export default function ContentSection({ block }: BlockRendererProps) {
  const config = block.template.config as ContentBlockConfig;
  const variant = block.template.variant ?? "default";
  const paragraphs = (config.body ?? "")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const alignmentClass = config.alignment === "center" ? "text-center mx-auto" : "text-right";

  return (
    <section className="relative py-16 md:py-20" data-block-variant={variant}>
      <div className={`mx-auto max-w-7xl px-6 ${alignmentClass}`}>
        {config.eyebrow ? (
          <p className="font-en text-[10px] uppercase tracking-[0.22em] text-[#D8B87A]/55">{config.eyebrow}</p>
        ) : null}

        {config.title ? (
          <h2 className="mt-3 text-2xl font-bold tracking-[-0.03em] text-white md:text-4xl">{config.title}</h2>
        ) : null}

        {config.subtitle ? (
          <p className="mt-4 max-w-3xl text-[15px] leading-8 text-white/60 md:text-base">{config.subtitle}</p>
        ) : null}

        {paragraphs.length ? (
          <div className="mt-6 space-y-4">
            {paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 40)} className="max-w-3xl text-[15px] leading-8 text-white/65 md:text-base">
                {paragraph}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

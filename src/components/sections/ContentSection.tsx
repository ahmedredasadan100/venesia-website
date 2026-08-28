import type { BlockRendererProps } from "./block-registry";
import {
  asContentConfig,
  pageBlockTextAlignClass,
  pageBlockTextPlacementClass,
  resolvePageBlockTextFormat,
  type ContentBlockConfig,
} from "../../lib/page-blocks/configs";
import RichTextContent from "../content/RichTextContent";

type ContentIntroPresentationProps = {
  config: ContentBlockConfig;
  className?: string;
};

/**
 * Generic, text-only Content Intro presentation. It owns only copy formatting
 * and spacing; datasets, media, and collection behavior stay outside it.
 */
export function ContentIntroPresentation({
  config: rawConfig,
  className = "",
}: ContentIntroPresentationProps) {
  const config = asContentConfig(rawConfig);
  const eyebrowFormat = resolvePageBlockTextFormat(config, "eyebrow");
  const titleFormat = resolvePageBlockTextFormat(config, "title", { bold: true });
  const subtitleFormat = resolvePageBlockTextFormat(config, "subtitle");
  const descriptionFormat = resolvePageBlockTextFormat(config, "description");
  const hasCopy = Boolean(
    (eyebrowFormat.visible && config.eyebrow?.trim()) ||
    (titleFormat.visible && config.title?.trim()) ||
    (subtitleFormat.visible && config.subtitle?.trim()) ||
    (descriptionFormat.visible && config.body?.trim()),
  );

  if (!hasCopy) return null;

  return (
    <div className={`min-w-0 space-y-2.5 ${className}`.trim()} data-content-intro-presentation="">
      {eyebrowFormat.visible && config.eyebrow?.trim() ? (
        <p className={`font-en text-[10px] uppercase tracking-[0.22em] text-[#D8B87A]/60 ${pageBlockTextAlignClass(eyebrowFormat.alignment)} ${eyebrowFormat.bold ? "font-bold" : "font-normal"}`}>
          {config.eyebrow}
        </p>
      ) : null}

      {titleFormat.visible && config.title?.trim() ? (
        <h2 className={`text-[1.75rem] leading-[1.3] tracking-[-0.025em] text-white @xl/slot-module:text-[2.25rem] ${pageBlockTextAlignClass(titleFormat.alignment)} ${titleFormat.bold ? "font-bold" : "font-normal"}`}>
          {config.title}
        </h2>
      ) : null}

      {subtitleFormat.visible && config.subtitle?.trim() ? (
        <RichTextContent
          value={config.subtitle}
          mode="auto"
          className={`block max-w-4xl whitespace-pre-line text-[15px] leading-7 text-white/68 @xl/slot-module:text-base @xl/slot-module:leading-8 ${pageBlockTextAlignClass(subtitleFormat.alignment)} ${pageBlockTextPlacementClass(subtitleFormat.alignment)} ${subtitleFormat.bold ? "font-bold" : "font-normal"} [&_p]:mb-1.5 [&_p:last-child]:mb-0`}
        />
      ) : null}

      {descriptionFormat.visible && config.body?.trim() ? (
        <RichTextContent
          value={config.body}
          mode="auto"
          className={`block max-w-4xl whitespace-pre-line text-[15px] leading-7 text-white/72 @xl/slot-module:text-base @xl/slot-module:leading-8 ${pageBlockTextAlignClass(descriptionFormat.alignment)} ${pageBlockTextPlacementClass(descriptionFormat.alignment)} ${descriptionFormat.bold ? "font-bold" : "font-normal"} [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_strong]:text-white/90`}
        />
      ) : null}
    </div>
  );
}

export default function ContentSection({ block }: BlockRendererProps) {
  const config = asContentConfig(block.template.config);
  const variant = block.template.variant ?? "default";

  if (variant === "intro") {
    return (
      <section className="relative py-7 @xl/slot-module:py-9" data-block-variant={variant} dir="rtl">
        <div className="mx-auto max-w-7xl px-6">
          <ContentIntroPresentation config={config} />
        </div>
      </section>
    );
  }

  const eyebrowFormat = resolvePageBlockTextFormat(config, "eyebrow");
  const titleFormat = resolvePageBlockTextFormat(config, "title", { bold: true });
  const subtitleFormat = resolvePageBlockTextFormat(config, "subtitle");
  const descriptionFormat = resolvePageBlockTextFormat(config, "description");
  const hasHeading = Boolean(
    (eyebrowFormat.visible && config.eyebrow?.trim()) ||
    (titleFormat.visible && config.title?.trim()),
  );
  const hasBody = Boolean(
    (subtitleFormat.visible && config.subtitle?.trim()) ||
    (descriptionFormat.visible && config.body?.trim()),
  );

  if (!hasHeading && !hasBody) return null;

  return (
    <section
      className="relative py-7 @xl/slot-module:py-9"
      data-block-variant={variant}
      dir="rtl"
    >
      <div className="mx-auto max-w-7xl px-6">
        {eyebrowFormat.visible && config.eyebrow ? (
          <p className={`font-en text-[10px] uppercase tracking-[0.22em] text-[#D8B87A]/55 ${pageBlockTextAlignClass(eyebrowFormat.alignment)} ${eyebrowFormat.bold ? "font-bold" : "font-normal"}`}>{config.eyebrow}</p>
        ) : null}

        {titleFormat.visible && config.title ? (
          <h2 className={`mt-3 text-[1.75rem] leading-[1.35] tracking-[-0.025em] text-white @xl/slot-module:text-[2.25rem] ${pageBlockTextAlignClass(titleFormat.alignment)} ${titleFormat.bold ? "font-bold" : "font-normal"}`}>
            {config.title}
          </h2>
        ) : null}

        {subtitleFormat.visible && config.subtitle ? (
          <RichTextContent
            value={config.subtitle}
            mode="auto"
            className={`mt-4 block max-w-4xl whitespace-pre-line text-[15px] leading-8 text-white/66 @xl/slot-module:text-base @xl/slot-module:leading-9 ${pageBlockTextAlignClass(subtitleFormat.alignment)} ${pageBlockTextPlacementClass(subtitleFormat.alignment)} ${subtitleFormat.bold ? "font-bold" : "font-normal"} [&_p]:mb-3 [&_p:last-child]:mb-0`}
          />
        ) : null}

        {descriptionFormat.visible && config.body?.trim() ? (
          <RichTextContent
            value={config.body}
            mode="auto"
            className={`mt-5 block max-w-4xl whitespace-pre-line text-[15px] leading-8 text-white/72 @xl/slot-module:text-base @xl/slot-module:leading-9 ${pageBlockTextAlignClass(descriptionFormat.alignment)} ${pageBlockTextPlacementClass(descriptionFormat.alignment)} ${descriptionFormat.bold ? "font-bold" : "font-normal"} [&_a]:text-[#E8D5A8] [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:my-5 [&_blockquote]:border-r-2 [&_blockquote]:border-[#D8B87A]/45 [&_blockquote]:py-1 [&_blockquote]:pr-5 [&_h1]:mb-3 [&_h1]:mt-7 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:mb-1.5 [&_ol]:my-5 [&_ol]:list-decimal [&_ol]:pr-6 [&_p]:mb-4 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_strong]:text-white/90 [&_ul]:my-5 [&_ul]:list-disc [&_ul]:pr-6`}
          />
        ) : null}
      </div>
    </section>
  );
}

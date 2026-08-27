import Link from "next/link";
import type { BlockRendererProps } from "./block-registry";
import {
  asCtaConfig,
  pageBlockTextAlignClass,
  pageBlockTextPlacementClass,
  resolvePageBlockTextFormat,
} from "../../lib/page-blocks/configs";

export default function CtaSection({ block }: BlockRendererProps) {
  const config = asCtaConfig(block.template.config);
  const eyebrowFormat = resolvePageBlockTextFormat(config, "eyebrow", { bold: true });
  const titleFormat = resolvePageBlockTextFormat(config, "title", { bold: true });
  const highlightFormat = resolvePageBlockTextFormat(config, "highlight", { bold: true });
  const descriptionFormat = resolvePageBlockTextFormat(config, "description");
  const ctaFormat = resolvePageBlockTextFormat(config, "cta");
  const variant = block.template.variant ?? "band";
  const backgroundClass =
    config.backgroundStyle === "gold"
      ? "border-[#D8B87A]/25 bg-[#D8B87A]/10"
      : config.backgroundStyle === "gradient"
        ? "border-white/10 bg-[radial-gradient(circle_at_top,rgba(216,184,122,0.12),rgba(5,7,11,0.95)_55%)]"
        : "border-white/10 bg-[#080B10]/86";

  return (
    <section className="px-4 py-10 @xl/slot-module:px-6 @xl/slot-module:py-12 @3xl/slot-module:py-16" data-block-variant={variant}>
      <div className={`mx-auto max-w-7xl overflow-hidden rounded-[2rem] border p-6 @xl/slot-module:p-8 @3xl/slot-module:p-12 ${backgroundClass}`}>
        {config.backgroundImage ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              backgroundImage: `url(${config.backgroundImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        ) : null}

        <div className="relative text-right" dir="rtl">
          {eyebrowFormat.visible && config.eyebrow ? (
            <p className={`text-xs uppercase tracking-[0.2em] text-[#D8B87A]/70 ${pageBlockTextAlignClass(eyebrowFormat.alignment)} ${eyebrowFormat.bold ? "font-bold" : "font-normal"}`}>{config.eyebrow}</p>
          ) : null}

          {titleFormat.visible && config.title ? (
            <h2 className={`mt-4 text-3xl leading-tight text-white @xl/slot-module:text-4xl ${pageBlockTextAlignClass(titleFormat.alignment)} ${titleFormat.bold ? "font-bold" : "font-normal"}`}>
              {config.title}
              {highlightFormat.visible && config.highlight ? <span className={`mt-2 block text-[#D8B87A] ${pageBlockTextAlignClass(highlightFormat.alignment)} ${highlightFormat.bold ? "font-bold" : "font-normal"}`}>{config.highlight}</span> : null}
            </h2>
          ) : null}

          {descriptionFormat.visible && config.description ? (
            <p className={`mt-5 max-w-2xl text-sm leading-7 text-white/58 @xl/slot-module:text-base ${pageBlockTextAlignClass(descriptionFormat.alignment)} ${pageBlockTextPlacementClass(descriptionFormat.alignment)} ${descriptionFormat.bold ? "font-bold" : "font-normal"}`}>{config.description}</p>
          ) : null}

          {ctaFormat.visible ? <div className={`mt-8 flex flex-wrap gap-3 ${ctaFormat.alignment === "center" ? "justify-center" : ctaFormat.alignment === "left" ? "justify-end" : "justify-start"}`}>
            {config.primaryCta?.label && config.primaryCta.href ? (
              <Link
                href={config.primaryCta.href}
                target={config.primaryCta.target === "_blank" ? "_blank" : undefined}
                rel={config.primaryCta.target === "_blank" ? "noreferrer" : undefined}
                className="inline-flex rounded-xl bg-[#D8B87A] px-6 py-3 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d]"
              >
                {config.primaryCta.label}
              </Link>
            ) : null}

            {config.secondaryCta?.label && config.secondaryCta.href ? (
              <Link
                href={config.secondaryCta.href}
                target={config.secondaryCta.target === "_blank" ? "_blank" : undefined}
                rel={config.secondaryCta.target === "_blank" ? "noreferrer" : undefined}
                className="inline-flex rounded-xl border border-white/15 px-6 py-3 text-sm font-semibold text-white/75 transition hover:border-[#D8B87A]/35 hover:text-[#D8B87A]"
              >
                {config.secondaryCta.label}
              </Link>
            ) : null}
          </div> : null}
        </div>
      </div>
    </section>
  );
}

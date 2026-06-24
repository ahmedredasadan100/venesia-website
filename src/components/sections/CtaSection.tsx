"use client";

import Link from "next/link";
import type { BlockRendererProps } from "./block-registry";
import type { CtaBlockConfig } from "../../lib/page-blocks";

export default function CtaSection({ block }: BlockRendererProps) {
  const config = block.template.config as CtaBlockConfig;
  const variant = block.template.variant ?? "band";
  const backgroundClass =
    config.backgroundStyle === "gold"
      ? "border-[#D8B87A]/25 bg-[#D8B87A]/10"
      : config.backgroundStyle === "gradient"
        ? "border-white/10 bg-[radial-gradient(circle_at_top,rgba(216,184,122,0.12),rgba(5,7,11,0.95)_55%)]"
        : "border-white/10 bg-[#080B10]/86";

  return (
    <section className="px-6 py-12 md:py-16" data-block-variant={variant}>
      <div className={`mx-auto max-w-7xl overflow-hidden rounded-[2rem] border p-8 md:p-12 ${backgroundClass}`}>
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
          {config.eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D8B87A]/70">{config.eyebrow}</p>
          ) : null}

          {config.title ? (
            <h2 className="mt-4 text-3xl font-semibold leading-tight text-white md:text-4xl">
              {config.title}
              {config.highlight ? <span className="mt-2 block text-[#D8B87A]">{config.highlight}</span> : null}
            </h2>
          ) : null}

          {config.description ? (
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/58 md:text-base">{config.description}</p>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
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
          </div>
        </div>
      </div>
    </section>
  );
}

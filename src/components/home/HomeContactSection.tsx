
"use client";

import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";

import { buildWhatsAppHref } from "../../lib/contact/build-whatsapp-href";
import { usePressFeedback } from "../../hooks/use-press-feedback";
import type { HomeContactContent } from "./home-contact-mappers";
import { renderContactIcon } from "../page-blocks/contact-icons";
import { usePublicBrand } from "../PublicBrandProvider";
import type { GlobalOrganizationIdentity } from "../../lib/seo/resolve-global-organization-identity";

function isExternalHref(href: string) {
  return /^(https?:|mailto:|tel:)/i.test(href);
}

function resolveHomeContactContent(
  content: HomeContactContent,
  identity: GlobalOrganizationIdentity,
) {
  const contacts = content.contacts.map((cms) => {
    const label = cms.label.trim();
    const value = cms.value.trim();
    const secondaryValue = cms.secondaryValue?.trim() || undefined;
    const href = cms.href?.trim() || null;

    return {
      icon: cms?.icon?.trim() || undefined,
      label,
      value,
      secondaryValue,
      href: href || null,
    };
  });

  return {
    eyebrow: content.eyebrow.trim() || identity.displayName,
    title: content.title.trim(),
    description: content.description.trim(),
    button: {
      label: content.button.label.trim(),
      href: content.button.href.trim(),
      target: content.button.target,
    },
    note: content.note.trim(),
    image: content.image.trim(),
    contacts,
  };
}

export type HomeContactSectionProps = {
  content: HomeContactContent;
};

function ContactPhoneLink({
  label,
  href,
}: {
  label: string;
  href: string | null;
}) {
  const { pressProps } = usePressFeedback();
  const className =
    "home-pressable home-pressable--text-link cursor-pointer whitespace-nowrap text-[12.5px] text-white/70 transition-colors duration-300 hover:text-[#D8B87A]";

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        {...pressProps}
        className={className}
      >
        {label}
      </a>
    );
  }

  return <span className="whitespace-nowrap text-[12.5px] text-white/70">{label}</span>;
}

function ContactValueRow({
  icon,
  value,
  secondaryValue,
  href,
}: {
  icon?: string;
  value: string;
  secondaryValue?: string;
  href: string | null;
}) {
  if (icon === "whatsapp") {
    const primaryHref = buildWhatsAppHref(value) ?? (href?.includes("wa.me") ? href : null);
    const secondaryHref = buildWhatsAppHref(secondaryValue);
    const hasSecondary = Boolean(secondaryValue?.trim());

    return (
      <div
        dir="ltr"
        className="mt-0.5 flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]"
      >
        {value.trim() ? <ContactPhoneLink label={value} href={primaryHref} /> : null}
        {hasSecondary ? (
          <>
            <span aria-hidden className="select-none text-white/25">
              |
            </span>
            <ContactPhoneLink label={secondaryValue!.trim()} href={secondaryHref} />
          </>
        ) : null}
      </div>
    );
  }

  if (href) {
    return (
      <ContactTextAnchor href={href} value={value} />
    );
  }

  return <p className="mt-0.5 text-[12.5px] text-white/70">{value}</p>;
}

function ContactTextAnchor({ href, value }: { href: string; value: string }) {
  const { pressProps } = usePressFeedback();
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      {...pressProps}
      className="home-pressable home-pressable--text-link mt-0.5 block cursor-pointer break-all text-[12.5px] text-white/70 transition-colors duration-300 hover:text-[#D8B87A]"
    >
      {value}
    </a>
  );
}

const CTA_CLASS_NAME =
  "home-pressable home-pressable--contact-cta flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-[#D8B87A] px-4 py-3 text-sm font-medium text-[#06101C] shadow-[0_8px_24px_rgba(216,184,122,0.20)] transition-[transform,box-shadow,background-color] duration-300 will-change-transform hover:-translate-y-0.5 hover:bg-[#c9a760] hover:shadow-[0_10px_30px_rgba(216,184,122,0.30)] active:scale-[0.97] @xl/slot-module:w-auto @xl/slot-module:px-5";

function HomeContactCtaButton({
  href,
  label,
  target,
}: {
  href: string;
  label: string;
  target?: "_self" | "_blank";
}) {
  const { pressProps } = usePressFeedback();
  const external = isExternalHref(href);
  const resolvedTarget = target ?? (external ? "_blank" : undefined);
  const content = (
    <>
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" />
        <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
      </svg>
      <span className="text-sm">{label}</span>
    </>
  );

  if (external) {
    return (
      <a
        href={href}
        target={resolvedTarget === "_blank" ? "_blank" : undefined}
        rel={resolvedTarget === "_blank" ? "noreferrer" : undefined}
        {...pressProps}
        className={CTA_CLASS_NAME}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={href} {...pressProps} className={CTA_CLASS_NAME}>
      {content}
    </Link>
  );
}

export default function HomeContactSection({ content }: HomeContactSectionProps) {
  const identity = usePublicBrand();
  const resolved = resolveHomeContactContent(content, identity);
  if (!resolved.image) return null;
  const titleLines = resolved.title.split("\n");

  return (
    <section className="relative mx-auto max-w-7xl overflow-hidden px-4 pb-4 pt-8 @xl/slot-module:px-6 @xl/slot-module:pt-10">
      {/* outer ambient glow — contained by section overflow-hidden */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_50%_at_50%_100%,rgba(192,143,62,0.06),transparent_70%)]"
      />

      {/* ── CTA panel ── */}
      <div
        data-reveal="fade-up"
        data-delay="0"
        className="group relative overflow-hidden rounded-[2.5rem] border border-[#D8B87A]/[0.11] bg-[#05070B] shadow-[0_0_0_1px_rgba(216,184,122,0.05),0_32px_80px_rgba(0,0,0,0.45)]"
      >
        {/* premium moving gold frame — sweeps full width on hover */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 z-10 h-px origin-right scale-x-0 bg-gradient-to-l from-transparent via-[#D8B87A]/55 to-transparent transition-[scale] duration-700 ease-out group-hover:scale-x-100"
        />

        {/* panel ambient — warm gold bloom biased toward the building side */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(ellipse_80%_60%_at_72%_50%,rgba(192,143,62,0.06),transparent_68%)] @4xl/slot-module:block"
        />

        {/*
          2-area layout
          DOM order: [MAIN AREA] [CONTACT STACK]
          RTL render: main → physical RIGHT (dominant)
                      contact → physical LEFT (sidebar)
        */}
        <div className="grid @4xl/slot-module:grid-cols-[1fr_288px]">
          {/* ══ MAIN AREA (DOM first → physical RIGHT in RTL) ══ */}
          <div className="relative flex min-h-[440px] flex-col overflow-hidden border-b border-white/[0.05] @4xl/slot-module:block @4xl/slot-module:min-h-0 @4xl/slot-module:border-b-0 @4xl/slot-module:border-l @4xl/slot-module:border-l-white/[0.06]">
            {/* mobile — full-bleed background image inside MAIN/CTA area */}
            <div aria-hidden className="absolute inset-0 overflow-hidden @4xl/slot-module:hidden">
              <Image
                src={resolved.image}
                alt=""
                fill
                sizes="100vw"
                className="object-cover object-[right_top] opacity-[1]"
                style={{ filter: "brightness(1) contrast(1.03)" }}
              />
              {/* readability — dark base at bottom for text, advisor stays clear at top; anchored to page bg so block end blends seamlessly */}
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,#05070B_0%,rgba(5,7,11,0.82)_30%,rgba(5,7,11,0.45)_58%,rgba(5,7,11,0.15)_80%,transparent_100%)]" />
            </div>

            {/* building image — full-bleed inside MAIN column, advisor anchored right */}
            <Image
              src={resolved.image}
              alt=""
              aria-hidden
              fill
              sizes="100vw"
              className="hidden object-cover object-[right_center] opacity-[1] @4xl/slot-module:block"
              style={{ filter: "brightness(1) contrast(1.03)" }}
            />
            {/* text legibility — single soft dissolve from the left, keeps image natural */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(to_right,#05070B_0%,rgba(5,7,11,0.62)_28%,rgba(5,7,11,0.12)_58%,transparent_82%)] @4xl/slot-module:block"
            />

            {/* content — headline, description, CTA */}
            <div className="relative z-10 flex flex-col justify-center px-6 pb-4 pr-6 pt-28 @4xl/slot-module:px-12 @4xl/slot-module:py-12 @4xl/slot-module:pr-[52%]">
              {/* micro label + gold rule */}
              <div className="mb-4 flex items-center gap-3">
                <div className="h-px w-7 shrink-0 bg-gradient-to-r from-[#D8B87A]/55 to-transparent" />
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D8B87A]/52">
                  {resolved.eyebrow}
                </p>
              </div>

              <h2 className="text-[1.72rem] font-bold leading-[1.42] tracking-[-0.02em] text-white @xl/slot-module:text-[1.8rem] @4xl/slot-module:whitespace-nowrap @4xl/slot-module:text-[1.68rem]">
                {titleLines.map((line, index) => (
                  <Fragment key={index}>
                    {line}
                    {index < titleLines.length - 1 ? <br /> : null}
                  </Fragment>
                ))}
              </h2>

              <p className="mt-4 text-[12.5px] leading-[1.9] text-white/55">{resolved.description}</p>

              <div className="mt-6 flex flex-col items-stretch gap-2.5 @xl/slot-module:items-center">
                <HomeContactCtaButton
                  href={resolved.button.href}
                  label={resolved.button.label}
                  target={resolved.button.target}
                />
                <p className="text-[11px] tracking-wide text-white/30">{resolved.note}</p>
              </div>
            </div>
          </div>

          {/* ══ CONTACT STACK (DOM second → physical LEFT in RTL) ══ */}
          <div
            data-reveal="fade-up"
            data-delay="80"
            className="flex flex-col justify-center divide-y divide-white/[0.05] border-t border-white/[0.05] @4xl/slot-module:border-t-0 @4xl/slot-module:border-r @4xl/slot-module:border-r-white/[0.06]"
          >
            {resolved.contacts.map(({ icon, label, value, secondaryValue, href }, idx) => (
              <div key={label || idx} className="flex items-center gap-3.5 px-6 py-[1.1rem]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#D8B87A]/22 bg-[#D8B87A]/[0.07] text-[#D8B87A]/75 transition-all duration-300 hover:border-[#D8B87A]/40 hover:bg-[#D8B87A]/[0.14] hover:text-[#D8B87A]">
                  {renderContactIcon(icon, idx)}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-[0.11em] text-[#D8B87A]/48">{label}</p>
                  <ContactValueRow
                    icon={icon}
                    value={value}
                    secondaryValue={secondaryValue}
                    href={href}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* end 2-area layout */}
      </div>
      {/* end CTA panel */}
    </section>
  );
}

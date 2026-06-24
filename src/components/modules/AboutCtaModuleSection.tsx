"use client";

import Link from "next/link";

import type { AboutCtaContact, AboutCtaModuleContent } from "./about-cta-mappers";

export type AboutCtaModuleSectionProps = {
  cmsContent: AboutCtaModuleContent | null;
};

const CONTACT_ICONS = ["◌", "◌", "◌", "◌"] as const;

function hasContactCopy(contact: AboutCtaContact) {
  return Boolean(contact.label.trim() || contact.value.trim());
}

function contactRowPadding(count: number) {
  if (count >= 4) return "py-2.5";
  if (count === 3) return "py-3.5";
  return "py-4";
}

function ContactValue({ contact }: { contact: AboutCtaContact }) {
  const className = "mt-1 break-words text-sm font-medium leading-7 text-white/72";

  if (contact.href?.trim()) {
    return (
      <a href={contact.href} className={`${className} transition-colors hover:text-[#D8B87A]`}>
        {contact.value}
      </a>
    );
  }

  return <p className={className}>{contact.value}</p>;
}

export default function AboutCtaModuleSection({ cmsContent }: AboutCtaModuleSectionProps) {
  if (!cmsContent) return null;

  const content = cmsContent;
  const contacts = content.contacts.filter(hasContactCopy);
  const rowPadding = contactRowPadding(contacts.length);
  const imageSrc = content.image?.trim();
  const showImage = Boolean(imageSrc);

  return (
    <section className="overflow-x-hidden pb-0 pt-0 md:pb-2">
      <div className="mx-auto max-w-7xl overflow-hidden px-6">
        <div
          data-reveal
          className="group relative max-w-full overflow-hidden rounded-[2rem] border border-[#D8B87A]/[0.12] bg-[#07090E] shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_65%_at_72%_52%,rgba(216,184,122,0.10),transparent_60%)]"
          />

          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-white/[0.055]"
          />

          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px origin-right scale-x-0 bg-gradient-to-l from-[#D8B87A]/70 via-[#D8B87A]/25 to-transparent transition-transform duration-700 ease-out group-hover:scale-x-100"
          />

          <div className="relative grid min-h-[320px] max-w-full overflow-hidden [direction:ltr] lg:grid-cols-[0.68fr_1fr_1.32fr]">
            <div className="relative z-20 order-3 min-w-0 bg-[#05070B]/72 p-7 [direction:rtl] backdrop-blur-sm lg:order-1 lg:p-8">
              <div
                aria-hidden
                className="absolute right-0 top-10 hidden h-[calc(100%-5rem)] w-px bg-gradient-to-b from-transparent via-[#D8B87A]/70 to-transparent lg:block"
              />

              {contacts.length ? (
                <div className="flex h-full flex-col justify-center divide-y divide-white/[0.06]">
                  {contacts.map((contact, index) => (
                    <div
                      key={`${contact.label}-${index}`}
                      className={`flex min-w-0 items-center justify-between gap-5 ${rowPadding} first:pt-0 last:pb-0`}
                    >
                      <div className="min-w-0 text-right">
                        <p className="text-[11px] leading-5 text-[#D8B87A]/55">{contact.label}</p>
                        <ContactValue contact={contact} />
                      </div>

                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#D8B87A]/25 bg-[#D8B87A]/[0.06] text-[#D8B87A]/80">
                        {CONTACT_ICONS[index] ?? "◌"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="relative z-20 order-2 flex min-h-[200px] min-w-0 items-center justify-center px-7 py-9 text-center [direction:rtl] lg:min-h-[320px] lg:px-10">
              <div className="max-w-xl">
                {content.eyebrow.trim() ? (
                  <p className="font-en text-[10px] uppercase tracking-[0.24em] text-[#D8B87A]/58">
                    {content.eyebrow}
                  </p>
                ) : null}

                {content.title.trim() ? (
                  <h2 className="mt-5 text-3xl font-bold leading-tight tracking-[-0.04em] text-white md:text-5xl">
                    {content.title}
                  </h2>
                ) : null}

                {content.description.trim() ? (
                  <p className="mt-5 text-[15px] leading-8 text-white/60 md:text-[16px]">{content.description}</p>
                ) : null}

                {content.button.label.trim() ? (
                  <Link
                    href={content.button.href || "#"}
                    className="mt-7 inline-flex h-12 items-center justify-center rounded-full bg-[#D8B87A] px-8 text-sm font-medium text-[#06101C] transition-[background-color,transform,box-shadow] duration-300 hover:-translate-y-px hover:bg-[#cca85a] hover:shadow-[0_10px_32px_rgba(216,184,122,0.18)] active:translate-y-px"
                  >
                    {content.button.label}
                  </Link>
                ) : null}

                {content.note.trim() ? <p className="mt-5 text-xs text-white/32">{content.note}</p> : null}
              </div>
            </div>

            <div className="relative order-1 min-h-[250px] min-w-0 overflow-hidden [direction:rtl] lg:order-3 lg:min-h-[220px]">
              {showImage ? (
                <img
                  src={imageSrc}
                  alt={content.imageAlt || content.title || ""}
                  className="absolute inset-0 h-full w-full scale-[1.04] object-cover object-center transition-transform duration-[1600ms] ease-out group-hover:scale-[1.07]"
                />
              ) : null}

              <div
                aria-hidden
                className="absolute inset-0 bg-[linear-gradient(to_left,rgba(5,7,11,0.02)_0%,rgba(5,7,11,0.08)_34%,rgba(5,7,11,0.38)_66%,#07090E_100%)]"
              />

              <div
                aria-hidden
                className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(5,7,11,0.14)_0%,transparent_38%,rgba(5,7,11,0.18)_100%)]"
              />

              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 w-[58%] bg-[linear-gradient(to_right,#07090E_0%,rgba(7,9,14,0.88)_22%,rgba(7,9,14,0.50)_52%,rgba(7,9,14,0.12)_78%,transparent_100%)]"
              />

              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/[0.04]"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

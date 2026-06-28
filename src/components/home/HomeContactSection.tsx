
import { Fragment, type ReactNode } from "react";

import { HOME_IMAGES } from "../../config/home-images";
import type { HomeContactContent } from "./home-contact-mappers";

const CONTACT_ICONS: ReactNode[] = [
  (
    <svg key="whatsapp" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  ),
  (
    <svg key="phone" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m22 16.92-.04 3.03a2 2 0 0 1-2.19 1.98 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.17 12 19.79 19.79 0 0 1 1.1 3.38a2 2 0 0 1 1.97-2.18l3.04-.04a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.14 8.74a16 16 0 0 0 6.12 6.12l1.13-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.03z" />
    </svg>
  ),
  (
    <svg key="mail" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  ),
  (
    <svg key="hours" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
];

const STATIC_DEFAULTS = {
  eyebrow: "Venesia Developments",
  title: "تبحث عن وحدة تناسب\nخطتك القادمة؟",
  description:
    "فريقنا الاستشاري جاهز لمساعدتك في اختيار المشروع الأنسب حسب موقعك، ميزانيتك، وهدفك الاستثماري.",
  button: {
    label: "تحدث مع مستشار الآن",
    href: "https://wa.me/201033766876",
  },
  note: "احجز استشارتك المجانية",
  image: HOME_IMAGES.contact,
  contacts: [
    {
      label: "تواصل عبر واتساب",
      value: "01033766876",
      href: "https://wa.me/201033766876",
    },
    {
      label: "الخط الساخن",
      value: "15875",
      href: "tel:15875",
    },
    {
      label: "البريد الإلكتروني",
      value: "info@venesia-developments.com",
      href: "mailto:info@venesia-developments.com",
    },
    {
      label: "ساعات العمل",
      value: "السبت – الخميس ٩ص – ٦م",
      href: undefined,
    },
  ],
} satisfies HomeContactContent;

function resolveHomeContactContent(content?: HomeContactContent | null) {
  if (!content) {
    return {
      ...STATIC_DEFAULTS,
      contacts: STATIC_DEFAULTS.contacts.map((item, index) => ({
        ...item,
        icon: CONTACT_ICONS[index],
        href: item.href ?? null,
      })),
    };
  }

  const contacts = Array.from({ length: 4 }, (_, index) => {
    const cms = content.contacts[index];
    const fallback = STATIC_DEFAULTS.contacts[index];
    const label = cms?.label?.trim() || fallback?.label || "";
    const value = cms?.value?.trim() || fallback?.value || "";
    const href = cms?.href?.trim() || fallback?.href || null;

    return {
      icon: CONTACT_ICONS[index],
      label,
      value,
      href: href || null,
    };
  });

  return {
    eyebrow: content.eyebrow?.trim() || STATIC_DEFAULTS.eyebrow,
    title: content.title?.trim() || STATIC_DEFAULTS.title,
    description: content.description?.trim() || STATIC_DEFAULTS.description,
    button: {
      label: content.button?.label?.trim() || STATIC_DEFAULTS.button.label,
      href: content.button?.href?.trim() || STATIC_DEFAULTS.button.href,
    },
    note: content.note?.trim() || STATIC_DEFAULTS.note,
    image: content.image?.trim() || STATIC_DEFAULTS.image,
    contacts,
  };
}

export type HomeContactSectionProps = {
  content?: HomeContactContent | null;
};

export default function HomeContactSection({ content }: HomeContactSectionProps) {
  const resolved = resolveHomeContactContent(content);
  const titleLines = resolved.title.split("\n");

  return (
	 <section className="relative mx-auto max-w-7xl overflow-hidden px-6 pb-14 pt-10">

          {/* outer ambient glow — contained by section overflow-hidden */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_50%_at_50%_100%,rgba(192,143,62,0.06),transparent_70%)]"
          />

          {/* ── CTA panel ── */}
          <div
            data-reveal
            className="group relative overflow-hidden rounded-[2.5rem] border border-[#D8B87A]/[0.11] bg-[#07090E] shadow-[0_0_0_1px_rgba(216,184,122,0.05),0_32px_80px_rgba(0,0,0,0.45)]"
          >
            {/* premium moving gold frame — sweeps full width on hover */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 z-10 h-px origin-right scale-x-0 bg-gradient-to-l from-transparent via-[#D8B87A]/55 to-transparent transition-transform duration-700 ease-out group-hover:scale-x-100"
            />

            {/* panel ambient — warm gold bloom biased toward the building side */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_72%_50%,rgba(192,143,62,0.06),transparent_68%)] max-md:hidden"
            />

            {/*
              2-area layout
              DOM order: [MAIN AREA] [CONTACT STACK]
              RTL render: main → physical RIGHT (dominant)
                          contact → physical LEFT (sidebar)
            */}
            <div className="grid lg:grid-cols-[1fr_288px]">

              {/* ══ MAIN AREA (DOM first → physical RIGHT in RTL) ══ */}
              <div className="relative overflow-hidden border-b border-white/[0.05] max-md:flex max-md:flex-col lg:border-b-0 lg:border-l lg:border-l-white/[0.06]">

                {/* mobile — image band on top, building anchored to the right */}
                <div
                  aria-hidden
                  className="relative h-40 w-full shrink-0 overflow-hidden max-md:block md:hidden"
                >
                  <img
                    src={resolved.image}
                    alt=""
                    className="h-full w-full object-cover object-[right_center] opacity-[1]"
                    style={{ filter: "brightness(1.08) contrast(1.12)" }}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(7,9,14,0.10)_0%,rgba(7,9,14,0.55)_58%,#07090E_100%)]" />
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_left,#07090E_0%,transparent_42%,transparent_100%)]" />
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_85%_at_88%_45%,rgba(216,184,122,0.14),transparent_62%)]" />
                </div>

                {/* building image — anchored far right, strong & clearly visible */}
                <img
                  src={resolved.image}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-y-0 right-0 h-full w-[55%] object-cover object-[right_center] opacity-[1] max-md:hidden"
                  style={{ filter: "brightness(1.08) contrast(1.12)" }}
                />
                {/* cinematic dissolve — text area protected left; fade begins near center, clears right */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#07090E_0%,rgba(7,9,14,0.82)_22%,rgba(7,9,14,0.35)_42%,rgba(7,9,14,0.08)_65%,rgba(7,9,14,0.02)_100%)] max-md:hidden"
                />
                {/* warm gold atmosphere — facade highlights and window glow */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_52%_70%_at_84%_50%,rgba(216,184,122,0.14),transparent_62%)] max-md:hidden"
                />
                {/* top + bottom edge softening */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(7,9,14,0.30)_0%,transparent_20%,transparent_80%,rgba(7,9,14,0.40)_100%)] max-md:hidden"
                />

                {/* content — headline, description, CTA */}
                <div
                  data-reveal
                  data-delay="60"
                  className="relative z-10 flex flex-col justify-center px-10 py-10 pr-[50%] max-md:px-6 max-md:py-6 max-md:pr-6 lg:px-12 lg:py-12 lg:pr-[52%]"
                >
                  {/* micro label + gold rule */}
                  <div className="mb-4 flex items-center gap-3">
                    <div className="h-px w-7 shrink-0 bg-gradient-to-r from-[#D8B87A]/55 to-transparent" />
                    <p className="text-[10px] font-medium uppercase tracking-[0.20em] text-[#D8B87A]/52">
                      {resolved.eyebrow}
                    </p>
                  </div>

                  <h2 className="text-[1.72rem] font-bold leading-[1.42] tracking-[-0.02em] text-white md:text-[1.88rem]">
                    {titleLines.map((line, index) => (
                      <Fragment key={index}>
                        {line}
                        {index < titleLines.length - 1 ? <br /> : null}
                      </Fragment>
                    ))}
                  </h2>

                  <p className="mt-4 text-[12.5px] leading-[1.9] text-white/55">
                    {resolved.description}
                  </p>

                  <div className="mt-6 flex flex-col items-center gap-2.5 max-md:items-stretch">
                    <a
                      href={resolved.button.href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-[#D8B87A] px-5 py-3 text-sm font-medium text-[#06101C] shadow-[0_8px_24px_rgba(216,184,122,0.20)] transition-[transform,box-shadow,background-color] duration-300 will-change-transform hover:-translate-y-0.5 hover:bg-[#c9a760] hover:shadow-[0_10px_30px_rgba(216,184,122,0.30)] active:scale-[0.97] max-md:w-full max-md:px-4"
                    >
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" />
                        <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                      </svg>
                      <span className="text-sm">{resolved.button.label}</span>
                    </a>
                    <p className="text-[11px] tracking-wide text-white/30">
                      {resolved.note}
                    </p>
                  </div>
                </div>
              </div>

              {/* ══ CONTACT STACK (DOM second → physical LEFT in RTL) ══ */}
              <div className="flex flex-col justify-center divide-y divide-white/[0.05] border-t border-white/[0.05] lg:border-t-0 lg:border-r lg:border-r-white/[0.06]">
                {resolved.contacts.map(({ icon, label, value, href }, idx) => (
                  <div
                    key={label || idx}
                    data-reveal
                    data-delay={String(idx * 80)}
                    className="flex items-center gap-3.5 px-6 py-[1.1rem]"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#D8B87A]/22 bg-[#D8B87A]/[0.07] text-[#D8B87A]/75 transition-all duration-300 hover:border-[#D8B87A]/40 hover:bg-[#D8B87A]/[0.14] hover:text-[#D8B87A]">
                      {icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-[0.11em] text-[#D8B87A]/48">
                        {label}
                      </p>
                      {href ? (
                        <a
                          href={href}
                          target={href.startsWith("http") ? "_blank" : undefined}
                          rel={href.startsWith("http") ? "noreferrer" : undefined}
                          className="mt-0.5 block cursor-pointer break-all text-[12.5px] text-white/70 transition-colors duration-300 hover:text-[#D8B87A]"
                        >
                          {value}
                        </a>
                      ) : (
                        <p className="mt-0.5 text-[12.5px] text-white/70">{value}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

            </div>{/* end 2-area layout */}
          </div>{/* end CTA panel */}

        </section>
		  );
}

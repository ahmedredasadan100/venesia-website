        /*
          SECTION: Why Trust
          PURPOSE: Four proof-point cards establishing engineering credibility.
                   Converts premium aesthetics into concrete trust signals.
          MOTION:  Left column (heading + body) fades up first.
                   Four cards stagger in at 80 ms intervals.
                   Icon container blooms on hover (gold bg + subtle glow).
          VISUAL RULES:
            · Preserve 2-column grid at lg breakpoint
            · Card lift on hover is −1 (translateY(−4px)) — keep minimal
            · Do not reduce proof card internal padding (p-6)
            · Gold reveal line sweeps in from right on hover — keep it
        */

import RichTextContent from "../content/RichTextContent";
import { isHtmlContent, stripHtml } from "../../lib/rich-text/html-utils";
import type { HomeTrustContent, HomeTrustTextAlignment } from "./home-trust-mappers";

const STATIC_DEFAULTS = {
  eyebrow: "لماذا يثق السوق العقارى في فينيسيا؟",
  title: "مش بنبيع كلام… التنفيذ بيتكلم.",
  description:
    "الموقع هنا لازم يشتغل كدليل ثقة بصري، مش بروشور. كل جزء فيه يقول إن الشركة موجودة، شغالة، وبتبني بجد.",
  eyebrowBold: false,
  eyebrowAlignment: "right" as const,
  titleBold: true,
  titleAlignment: "right" as const,
  items: [
    {
      title: "أراضي مملوكة",
      text: "بداية أي ثقة حقيقية تبدأ من أصل واضح ومدفوع.",
    },
    {
      title: "إدارة هندسية",
      text: "متابعة تنفيذ مش مجرد صور… ده نظام بيشتغل على الأرض.",
    },
    {
      title: "مراحل موثقة",
      text: "كل مرحلة ليها معنى، وكل خطوة بتثبت إن الوعد بيتحول لحقيقة.",
    },
    {
      title: "رسالة طمأنة",
      text: "العميل مش محتاج يسمع وعود كتير… محتاج يشوف تنفيذ حقيقي.",
    },
  ],
} satisfies HomeTrustContent;

const TEXT_ALIGN_CLASS: Record<HomeTrustTextAlignment, string> = {
  right: "text-right",
  center: "text-center",
  left: "text-left",
};

function hasRichTextValue(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return false;
  if (!isHtmlContent(trimmed)) return true;
  return Boolean(stripHtml(trimmed));
}

function resolveHomeTrustContent(content?: HomeTrustContent | null) {
  if (!content) return STATIC_DEFAULTS;

  const items = content.items.filter((item) => item.title.trim() || item.text.trim());
  const resolvedItems = items.length ? items : STATIC_DEFAULTS.items;

  return {
    eyebrow: content.eyebrow?.trim() || STATIC_DEFAULTS.eyebrow,
    title: content.title?.trim() || STATIC_DEFAULTS.title,
    description: hasRichTextValue(content.description)
      ? content.description.trim()
      : STATIC_DEFAULTS.description,
    eyebrowBold: content.eyebrowBold ?? STATIC_DEFAULTS.eyebrowBold,
    eyebrowAlignment: content.eyebrowAlignment ?? STATIC_DEFAULTS.eyebrowAlignment,
    titleBold: content.titleBold ?? STATIC_DEFAULTS.titleBold,
    titleAlignment: content.titleAlignment ?? STATIC_DEFAULTS.titleAlignment,
    items: resolvedItems.map((item, index) => ({
      title: item.title?.trim() || STATIC_DEFAULTS.items[index]?.title || "",
      text: item.text?.trim() || STATIC_DEFAULTS.items[index]?.text || "",
    })),
  };
}

export type HomeTrustSectionProps = {
  content?: HomeTrustContent | null;
};

export default function HomeTrustSection({ content }: HomeTrustSectionProps) {
  const resolved = resolveHomeTrustContent(content);

  return (
    <section className="mx-auto max-w-7xl px-6 py-7">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div data-reveal>
          <p
            className={`text-sm text-[#D8B87A] ${TEXT_ALIGN_CLASS[resolved.eyebrowAlignment]}`}
            style={{ fontWeight: resolved.eyebrowBold ? 700 : 400 }}
          >
            {resolved.eyebrow}
          </p>

          <h2
            className={`mt-3 text-4xl leading-tight ${TEXT_ALIGN_CLASS[resolved.titleAlignment]}`}
            style={{ fontWeight: resolved.titleBold ? 700 : 400 }}
          >
            {resolved.title}
          </h2>

          {/*
            Scoped Home Trust intro only via .home-trust-intro in globals.css:
            muted body matching prior plain paragraph. Does not change other rich text.
          */}
          <RichTextContent value={resolved.description} mode="rich" className="home-trust-intro" />
        </div>

        <div className="grid items-stretch gap-4 sm:grid-cols-2">
          {resolved.items.map((item, idx) => (
            <div
              key={`${item.title}-${idx}`}
              data-reveal
              data-delay={String(idx * 80)}
              className="home-trust-card group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 text-white backdrop-blur transition-all duration-500 hover:-translate-y-1 hover:border-white/[0.17] hover:shadow-[0_8px_40px_rgba(0,0,0,0.28)]"
            >
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 z-10 h-px origin-right scale-x-0 bg-gradient-to-l from-[#D8B87A]/60 via-[#D8B87A]/25 to-transparent transition-transform duration-500 ease-out group-hover:scale-x-100"
              />

              <div className="home-trust-card__body" dir="rtl">
                <div className="home-trust-card__icon" aria-hidden>
                  ◆
                </div>
                <h3 className="home-trust-card__title">{item.title}</h3>
                <p className="home-trust-card__text">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

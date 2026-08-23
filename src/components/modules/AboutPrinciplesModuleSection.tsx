import type { AboutPrinciplesModuleContent } from "./about-principles-mappers";
import { PrincipleIcon } from "./about-principles-icons";

export type AboutPrinciplesModuleSectionProps = {
  cmsContent: AboutPrinciplesModuleContent | null;
};

function showColumnDivider(index: number, total: number) {
  if (index >= total - 1) return false;
  return (index + 1) % 3 !== 0;
}

function gridColumnsClass(count: number) {
  if (count <= 1) return "@xl/slot-module:grid-cols-1";
  if (count === 2) return "@xl/slot-module:grid-cols-2";
  if (count === 4) return "@xl/slot-module:grid-cols-2 @5xl/slot-module:grid-cols-4";
  return "@3xl/slot-module:grid-cols-3";
}

function itemPaddingClass(count: number) {
  if (count >= 5) return "px-6 py-7";
  if (count === 4) return "px-7 py-8";
  return "px-8 py-10";
}

export default function AboutPrinciplesModuleSection({ cmsContent }: AboutPrinciplesModuleSectionProps) {
  if (!cmsContent) return null;

  const section = cmsContent;
  const principles = section.items;

  if (!section.eyebrow.trim() && !section.title.trim() && !principles.length) {
    return null;
  }

  const gridClass = gridColumnsClass(principles.length);
  const itemPad = itemPaddingClass(principles.length);

  return (
    <section className="relative py-12 @xl/slot-module:py-16 @4xl/slot-module:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div data-reveal className="mb-3 text-center">
          {section.eyebrow.trim() ? (
            <p className="font-en text-[10px] uppercase tracking-[0.22em] text-[#D8B87A]/55">{section.eyebrow}</p>
          ) : null}

          {section.title.trim() ? (
            <h2 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-white @xl/slot-module:text-3xl">{section.title}</h2>
          ) : null}

          <div className="mx-auto mt-3 h-[3px] w-20 rounded-full bg-white/80" />
        </div>

        {principles.length ? (
          <div className="overflow-hidden rounded-[1.75rem] border border-white/[0.06] bg-[#05070B]/80 backdrop-blur-sm">
            <div className={`grid ${gridClass}`}>
              {principles.map(({ icon, title, description }, index) => (
                <div
                  key={`${title}-${index}`}
                  data-reveal
                  data-delay={String(index * 70)}
                  className={`relative ${itemPad} text-center`}
                >
                  {showColumnDivider(index, principles.length) ? (
                    <div className="absolute left-0 top-1/2 hidden h-24 w-px -translate-y-1/2 bg-gradient-to-b from-transparent via-[#D8B87A]/45 to-transparent @xl/slot-module:block" />
                  ) : null}

                  <div className="mx-auto mb-5 flex justify-center text-[#D8B87A]">
                    <PrincipleIcon icon={icon} />
                  </div>

                  {title.trim() ? <h3 className="text-lg font-medium text-white">{title}</h3> : null}

                  {description.trim() ? (
                    <p className="mx-auto mt-3 max-w-[240px] text-[14px] leading-7 text-white/50">{description}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

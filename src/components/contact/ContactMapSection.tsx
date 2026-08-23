import type { ContactMapContent } from "./contact-cms-mappers";

type ContactMapSectionProps = {
  cmsContent: ContactMapContent | null;
};

export default function ContactMapSection({ cmsContent }: ContactMapSectionProps) {
  if (!cmsContent) return null;

  const map = cmsContent;
  const showCopy = Boolean(map.title.trim() || map.description.trim() || map.buttonLabel.trim());
  const showPoints = Boolean(map.points.length);

  if (!showCopy && !showPoints) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-8 @xl/slot-module:px-6 @4xl/slot-module:px-10">
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#070d12] p-7">
        <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:42px_42px]" />

        <div className="relative grid gap-8 @4xl/slot-module:grid-cols-[0.8fr_1.4fr]">
          <div className="rounded-3xl bg-black/35 p-7">
            {map.title.trim() ? (
              <h2 className="text-2xl font-semibold text-[#d2a75a]">
                {map.title}
              </h2>
            ) : null}

            {map.description.trim() ? (
              <p className="mt-4 leading-8 text-white/65">
                {map.description}
              </p>
            ) : null}

            {map.buttonLabel.trim() ? (
              <a
                href={map.buttonHref || "#"}
                className="mt-7 inline-flex rounded-xl border border-[#d2a75a]/35 px-5 py-3 text-sm text-[#d2a75a] transition hover:bg-[#d2a75a] hover:text-black"
              >
                {map.buttonLabel}
              </a>
            ) : null}
          </div>

          <div className="flex min-h-64 items-center justify-center">
            <div className="relative h-9 w-9 rounded-full bg-[#d2a75a] shadow-[0_0_45px_rgba(210,167,90,.75)]">
              <span className="absolute inset-0 rounded-full border border-[#d2a75a]/60" />
              <span className="absolute -inset-7 rounded-full border border-[#d2a75a]/20" />
              <span className="absolute -inset-14 rounded-full border border-[#d2a75a]/10" />
            </div>
          </div>
        </div>

        {showPoints ? (
          <div className="relative mt-7 grid gap-3 border-t border-white/10 pt-6 @3xl/slot-module:grid-cols-4">
            {map.points.map((point) => (
              <div key={point} className="text-center text-sm text-white/65">
                {point}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

import type { ContactReasonsContent } from "./contact-cms-mappers";

type ContactReasonsSectionProps = {
  cmsContent: ContactReasonsContent | null;
};

export default function ContactReasonsSection({ cmsContent }: ContactReasonsSectionProps) {
  if (!cmsContent || (!cmsContent.items.length && !cmsContent.title.trim())) return null;

  const reasons = cmsContent;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-8 @xl/slot-module:px-6 @4xl/slot-module:px-10">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-7">
        {reasons.title.trim() ? (
          <h2 className="text-center text-2xl font-semibold text-[#d2a75a]">
            {reasons.title}
          </h2>
        ) : null}

        <div className={`grid gap-4 @3xl/slot-module:grid-cols-3 ${reasons.title.trim() ? "mt-7" : ""}`}>
          {reasons.items.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/10 bg-black/20 p-6 transition duration-300 hover:-translate-y-1 hover:border-[#d2a75a]/35"
            >
              <h3 className="text-lg font-semibold">
                {item.title}
              </h3>

              <p className="mt-3 leading-7 text-white/60">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

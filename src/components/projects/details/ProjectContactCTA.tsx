import Link from "next/link";

import PlainTextContent from "../../content/PlainTextContent";

type ContactCta = {
  eyebrow?: string;
  title: string;
  body: string;
  buttonLabel: string;
  href?: string;
};

type ProjectContactCTAProps = {
  cta: ContactCta;
};

export default function ProjectContactCTA({ cta }: ProjectContactCTAProps) {
  return (
    <section id="contact" className="scroll-mt-24 px-6 pb-16 pt-6">
      <div className="mx-auto overflow-hidden rounded-[32px] border border-[#D8B87A]/20 bg-[#080B10]">
        <div className="relative p-8 md:p-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(216,184,122,0.13),transparent_34%),linear-gradient(135deg,rgba(216,184,122,0.06),transparent_42%)]" />

          <div className="relative z-10 grid items-center gap-8 lg:grid-cols-[1fr_0.35fr]">
            <div>
              {cta.eyebrow ? (
                <p className="mb-3 text-sm font-medium tracking-[0.28em] text-[#D8B87A]/70">
                  {cta.eyebrow}
                </p>
              ) : null}

              <h2 className="text-3xl font-semibold leading-tight text-[#D8B87A] md:text-4xl">
                {cta.title}
              </h2>

              <PlainTextContent value={cta.body} as="p" className="mt-5 max-w-3xl text-sm leading-8 text-white/62" />
            </div>

            <div className="flex lg:justify-end">
              <Link
                href={cta.href ?? "/contact"}
                className="inline-flex rounded-xl bg-[#D8B87A] px-8 py-4 text-sm font-medium text-[#111] transition hover:bg-[#e5c989]"
              >
                {cta.buttonLabel}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
import type { ContactTrustCard } from "./contact-cms-mappers";

type ContactCardType = ContactTrustCard["type"];

function ContactIcon({ type }: { type: ContactCardType }) {
  const className =
    "h-6 w-6 text-[#d2a75a] transition duration-300 group-hover:scale-110";

  if (type === "phone") {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M3 5.5C3 4.67 3.67 4 4.5 4h2.1c.7 0 1.31.49 1.46 1.17l.46 2.07a1.5 1.5 0 0 1-.4 1.38L6.98 9.76a13.5 13.5 0 0 0 7.26 7.26l1.14-1.14a1.5 1.5 0 0 1 1.38-.4l2.07.46c.68.15 1.17.76 1.17 1.46v2.1c0 .83-.67 1.5-1.5 1.5H17C9.27 21 3 14.73 3 7V5.5Z" />
      </svg>
    );
  }

  if (type === "whatsapp") {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M12 21a8.9 8.9 0 0 1-4.34-1.12L4 21l1.14-3.53A9 9 0 1 1 12 21Z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M9.2 8.7c.2-.46.38-.48.65-.48h.48c.15 0 .36.05.55.41.19.36.64 1.56.7 1.68.06.12.1.26.02.42-.08.16-.12.26-.24.4-.12.14-.25.31-.36.42-.12.12-.25.25-.11.49.14.24.62 1.02 1.34 1.65.92.82 1.7 1.08 1.94 1.2.24.12.38.1.52-.06.14-.16.6-.7.76-.94.16-.24.32-.2.55-.12.23.08 1.44.68 1.68.8.24.12.4.18.46.28.06.1.06.58-.14 1.14-.2.56-1.16 1.08-1.62 1.12-.42.04-.95.06-1.54-.1-.36-.1-.82-.26-1.41-.52-2.48-1.07-4.1-3.57-4.22-3.73-.12-.16-1.01-1.34-1.01-2.56 0-1.22.64-1.82.86-2.07Z" />
      </svg>
    );
  }

  if (type === "mail") {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M4 6.5h16v11H4v-11Z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="m4.8 7.2 7.2 5.3 7.2-5.3" />
      </svg>
    );
  }

  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
    </svg>
  );
}

export default function ContactFloatingTrustCards({
  cmsCards,
}: {
  cmsCards: ContactTrustCard[] | null;
}) {
  if (!cmsCards?.length) return null;

  return (
    <section className="relative z-20 mx-auto -mt-28 max-w-7xl px-5 sm:px-8 lg:px-10">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cmsCards.map((item) => {
          const isMail = item.type === "mail";

          return (
            <a
              key={`${item.type}-${item.label}`}
              href={item.href}
              className="group min-w-0 rounded-[28px] border border-white/10 bg-[#070d12]/95 p-6 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-[#d2a75a]/35 hover:shadow-[0_18px_45px_rgba(0,0,0,0.28)]"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#d2a75a]/20 bg-[#d2a75a]/10">
                  <ContactIcon type={item.type} />
                </span>

                <p className="min-w-0 text-sm font-medium text-white/68">{item.label}</p>
              </div>

              <p
                dir={isMail ? "ltr" : undefined}
                className={`mt-4 min-w-0 font-bold text-white ${
                  isMail
                    ? "whitespace-nowrap text-right text-[clamp(0.72rem,1.1vw,0.875rem)] tracking-[-0.02em]"
                    : "text-lg"
                }`}
              >
                {item.value}
              </p>

              {item.description ? (
                <p className="mt-2 text-sm leading-6 text-white/50">{item.description}</p>
              ) : null}
            </a>
          );
        })}
      </div>
    </section>
  );
}

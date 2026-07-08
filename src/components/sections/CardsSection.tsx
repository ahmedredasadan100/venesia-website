import Link from "next/link";
import type { BlockRendererProps } from "./block-registry";
import type { CardsBlockConfig } from "../../lib/page-blocks";

function columnsClass(columns?: number) {
  if (columns === 2) return "md:grid-cols-2";
  if (columns === 4) return "md:grid-cols-2 xl:grid-cols-4";
  return "md:grid-cols-3";
}

export default function CardsSection({ block }: BlockRendererProps) {
  const config = block.template.config as CardsBlockConfig;
  const variant = block.template.variant ?? "glass";
  const items = config.items ?? [];

  return (
    <section className="relative py-16 md:py-20" data-block-variant={variant}>
      <div className="mx-auto max-w-7xl px-6">
        {(config.eyebrow || config.title || config.description) && (
          <div className="mb-10 text-right">
            {config.eyebrow ? (
              <p className="font-en text-[10px] uppercase tracking-[0.22em] text-[#D8B87A]/55">{config.eyebrow}</p>
            ) : null}
            {config.title ? (
              <h2 className="mt-3 text-2xl font-bold tracking-[-0.03em] text-white md:text-3xl">{config.title}</h2>
            ) : null}
            {config.description ? (
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/55">{config.description}</p>
            ) : null}
          </div>
        )}

        <div className={`grid gap-4 ${columnsClass(config.columns)}`}>
          {items.map((item, index) => {
            const card = (
              <div
                key={`${item.title ?? "card"}-${index}`}
                className="rounded-[1.5rem] border border-white/[0.06] bg-white/[0.03] p-6 text-right backdrop-blur-sm transition hover:border-[#D8B87A]/20 hover:bg-white/[0.05]"
              >
                {item.icon ? (
                  <p className="mb-4 text-2xl text-[#D8B87A]/80">{item.icon}</p>
                ) : null}
                {item.title ? <h3 className="text-lg font-semibold text-white">{item.title}</h3> : null}
                {item.body ? <p className="mt-3 text-sm leading-7 text-white/58">{item.body}</p> : null}
              </div>
            );

            if (item.href) {
              return (
                <Link key={`${item.title ?? "card"}-${index}-link`} href={item.href} className="block">
                  {card}
                </Link>
              );
            }

            return card;
          })}
        </div>
      </div>
    </section>
  );
}

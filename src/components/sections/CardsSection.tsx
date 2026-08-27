import Link from "next/link";
import type { BlockRendererProps } from "./block-registry";
import {
  asCardsConfig,
  pageBlockTextAlignClass,
  pageBlockTextPlacementClass,
  resolvePageBlockTextFormat,
} from "../../lib/page-blocks/configs";

function columnsClass(columns?: number) {
  if (columns === 2) return "@xl/slot-module:grid-cols-2";
  if (columns === 4) return "@xl/slot-module:grid-cols-2 @5xl/slot-module:grid-cols-4";
  return "@3xl/slot-module:grid-cols-3";
}

export default function CardsSection({ block }: BlockRendererProps) {
  const config = asCardsConfig(block.template.config);
  const eyebrowFormat = resolvePageBlockTextFormat(config, "eyebrow");
  const titleFormat = resolvePageBlockTextFormat(config, "title", { bold: true });
  const descriptionFormat = resolvePageBlockTextFormat(config, "description");
  const variant = block.template.variant ?? "glass";
  const items = config.items ?? [];

  return (
    <section className="relative py-12 @xl/slot-module:py-16 @4xl/slot-module:py-20" data-block-variant={variant}>
      <div className="mx-auto max-w-7xl px-6">
        {((eyebrowFormat.visible && config.eyebrow) || (titleFormat.visible && config.title) || (descriptionFormat.visible && config.description)) && (
          <div className="mb-10">
            {eyebrowFormat.visible && config.eyebrow ? (
              <p className={`font-en text-[10px] uppercase tracking-[0.22em] text-[#D8B87A]/55 ${pageBlockTextAlignClass(eyebrowFormat.alignment)} ${eyebrowFormat.bold ? "font-bold" : "font-normal"}`}>{config.eyebrow}</p>
            ) : null}
            {titleFormat.visible && config.title ? (
              <h2 className={`mt-3 text-2xl tracking-[-0.03em] text-white @xl/slot-module:text-3xl ${pageBlockTextAlignClass(titleFormat.alignment)} ${titleFormat.bold ? "font-bold" : "font-normal"}`}>{config.title}</h2>
            ) : null}
            {descriptionFormat.visible && config.description ? (
              <p className={`mt-4 max-w-2xl text-sm leading-7 text-white/55 ${pageBlockTextAlignClass(descriptionFormat.alignment)} ${pageBlockTextPlacementClass(descriptionFormat.alignment)} ${descriptionFormat.bold ? "font-bold" : "font-normal"}`}>{config.description}</p>
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

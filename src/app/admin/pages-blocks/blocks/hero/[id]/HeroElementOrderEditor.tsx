"use client";

import { useState } from "react";

import {
  DEFAULT_HERO_ELEMENT_ORDER,
  HERO_ELEMENT_LABELS_AR,
  normalizeHeroElementOrder,
  type HeroElementKey,
} from "../../../../../../lib/hero/hero-content-controls";

type HeroElementOrderEditorProps = {
  defaultOrder?: unknown;
  allowedKeys?: readonly HeroElementKey[];
};

export default function HeroElementOrderEditor({ defaultOrder, allowedKeys }: HeroElementOrderEditorProps) {
  const [order, setOrder] = useState<HeroElementKey[]>(() =>
    normalizeHeroElementOrder(defaultOrder ?? allowedKeys ?? DEFAULT_HERO_ELEMENT_ORDER, allowedKeys),
  );

  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= order.length) return;
    setOrder((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  return (
    <div data-hero-element-order-editor="" className="space-y-4">
      <p className="rounded-2xl border border-white/10 bg-[#05070B]/72 px-4 py-3 text-xs leading-6 text-white/45">
        حرّك العناصر بالأسهم. العنصر المخفي يحتفظ بمكانه في الترتيب.
      </p>
      <input type="hidden" name="hero_element_order" value={JSON.stringify(order)} />
      <ul className="space-y-2">
        {order.map((key, index) => (
          <li
            key={key}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-white/10 bg-[#05070B]/72 p-3"
          >
            <span className="inline-flex size-8 items-center justify-center rounded-xl bg-white/[0.045] font-en text-[11px] font-semibold text-[#D8B87A]/70">
              {index + 1}
            </span>
            <span className="min-w-0 text-sm font-medium text-white/80">{HERO_ELEMENT_LABELS_AR[key]}</span>
            <div
              className="inline-flex shrink-0 gap-1 rounded-xl border border-white/10 bg-black/20 p-1"
              role="group"
              aria-label={`ترتيب ${HERO_ELEMENT_LABELS_AR[key]}`}
            >
              <button
                type="button"
                title="تحريك لأعلى"
                aria-label={`تحريك ${HERO_ELEMENT_LABELS_AR[key]} لأعلى`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
                className="inline-flex h-8 w-10 items-center justify-center rounded-lg text-sm text-white/65 transition enabled:hover:bg-white/[0.05] enabled:hover:text-[#F2D99B] disabled:cursor-not-allowed disabled:opacity-25"
              >
                ↑
              </button>
              <button
                type="button"
                title="تحريك لأسفل"
                aria-label={`تحريك ${HERO_ELEMENT_LABELS_AR[key]} لأسفل`}
                disabled={index === order.length - 1}
                onClick={() => move(index, 1)}
                className="inline-flex h-8 w-10 items-center justify-center rounded-lg text-sm text-white/65 transition enabled:hover:bg-white/[0.05] enabled:hover:text-[#F2D99B] disabled:cursor-not-allowed disabled:opacity-25"
              >
                ↓
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

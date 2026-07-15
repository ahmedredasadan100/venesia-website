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
};

export default function HeroElementOrderEditor({ defaultOrder }: HeroElementOrderEditorProps) {
  const [order, setOrder] = useState<HeroElementKey[]>(() =>
    normalizeHeroElementOrder(defaultOrder ?? DEFAULT_HERO_ELEMENT_ORDER),
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
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-white">ترتيب عناصر الهيرو</h3>
        <p className="mt-1 text-xs leading-6 text-white/45">
          حرّك العناصر بالأسهم. العنصر المخفي يحتفظ بمكانه في الترتيب.
        </p>
      </div>
      <input type="hidden" name="hero_element_order" value={JSON.stringify(order)} />
      <ul className="space-y-2">
        {order.map((key, index) => (
          <li
            key={key}
            className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#05070B] px-3 py-2.5"
          >
            <span className="text-sm text-white/80">
              <span className="ml-2 font-en text-[11px] text-white/35">{index + 1}</span>
              {HERO_ELEMENT_LABELS_AR[key]}
            </span>
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                title="تحريك لأعلى"
                aria-label={`تحريك ${HERO_ELEMENT_LABELS_AR[key]} لأعلى`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-sm text-white/70 transition enabled:hover:border-[#D8B87A]/35 enabled:hover:text-[#F2D99B] disabled:cursor-not-allowed disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                title="تحريك لأسفل"
                aria-label={`تحريك ${HERO_ELEMENT_LABELS_AR[key]} لأسفل`}
                disabled={index === order.length - 1}
                onClick={() => move(index, 1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-sm text-white/70 transition enabled:hover:border-[#D8B87A]/35 enabled:hover:text-[#F2D99B] disabled:cursor-not-allowed disabled:opacity-30"
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

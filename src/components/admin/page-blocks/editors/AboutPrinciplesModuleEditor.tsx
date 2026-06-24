"use client";

import { useState } from "react";

import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import {
  ABOUT_PRINCIPLES_ICON_KEYS,
  type AboutPrinciplesItemConfig,
  type AboutPrinciplesModuleConfig,
} from "../../../../lib/page-blocks/configs";

type AboutPrinciplesModuleEditorProps = {
  config: AboutPrinciplesModuleConfig;
  editorMode?: "about-principles" | "home-trust";
};

const ICON_LABELS: Record<(typeof ABOUT_PRINCIPLES_ICON_KEYS)[number], string> = {
  land: "أرض / مبنى",
  engineering: "هندسة",
  timeline: "مراحل / توثيق",
};

function normalizeItems(items: AboutPrinciplesItemConfig[] | undefined) {
  const rows = [...(items ?? [])].filter((item) => item.title?.trim() || item.description?.trim());
  return rows.length ? rows : [{ icon: "land" }];
}

function padTrustItems(items: AboutPrinciplesItemConfig[] | undefined) {
  const rows = [...(items ?? [])].slice(0, 4);
  while (rows.length < 4) rows.push({});
  return rows;
}

export default function AboutPrinciplesModuleEditor({
  config,
  editorMode = "about-principles",
}: AboutPrinciplesModuleEditorProps) {
  const isHomeTrust = editorMode === "home-trust";
  const [items, setItems] = useState<AboutPrinciplesItemConfig[]>(() =>
    isHomeTrust ? padTrustItems(config.items) : normalizeItems(config.items),
  );

  const moveItem = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return;
    const next = [...items];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setItems(next);
  };

  const updateItem = (index: number, patch: Partial<AboutPrinciplesItemConfig>) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((current) => current.filter((_, i) => i !== index));
  };

  const addItem = () => {
    if (items.length >= 6) return;
    setItems((current) => [...current, { icon: "land" }]);
  };

  return (
    <div className="space-y-6">
      <input type="hidden" name="config_schema" value="about-principles" />
      {isHomeTrust ? <input type="hidden" name="include_home_trust_intro" value="1" /> : null}
      <input type="hidden" name="principle_count" value={String(items.length)} />

      <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
        <h2 className="text-sm font-semibold text-white">العنوان</h2>
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">Eyebrow</span>
          <input name="eyebrow" defaultValue={config.eyebrow ?? ""} className={fieldClassName()} />
        </label>
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">Title</span>
          <input name="title" defaultValue={config.title ?? ""} className={fieldClassName()} />
        </label>
        {isHomeTrust ? (
          <label className="block space-y-2">
            <span className="text-xs font-semibold text-white/55">Intro — فقرة يسار القسم</span>
            <textarea
              name="principles_intro"
              defaultValue={config.description ?? ""}
              rows={4}
              className={fieldClassName("resize-y leading-7")}
            />
          </label>
        ) : null}
      </section>

      <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">
            {isHomeTrust ? "بطاقات الثقة (4)" : "المبادئ (حتى 6)"}
          </h2>
          {!isHomeTrust ? (
            <button
              type="button"
              onClick={addItem}
              disabled={items.length >= 6}
              className="cursor-pointer rounded-2xl border border-[#D8B87A]/35 bg-[#D8B87A]/10 px-4 py-2 text-sm font-semibold text-[#D8B87A] hover:bg-[#D8B87A]/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              إضافة عنصر
            </button>
          ) : null}
        </div>

        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={index} className="space-y-3 rounded-2xl border border-white/10 bg-[#05070B] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[#D8B87A]/70">
                  {isHomeTrust ? `بطاقة ${index + 1}` : `عنصر ${index + 1}`}
                </p>
                {!isHomeTrust ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => moveItem(index, -1)}
                      disabled={index === 0}
                      className="cursor-pointer rounded-xl border border-white/10 px-3 py-1 text-xs text-white/55 hover:bg-white/5 disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(index, 1)}
                      disabled={index === items.length - 1}
                      className="cursor-pointer rounded-xl border border-white/10 px-3 py-1 text-xs text-white/55 hover:bg-white/5 disabled:opacity-40"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={items.length <= 1}
                      className="cursor-pointer rounded-xl border border-white/10 px-3 py-1 text-xs text-white/55 hover:bg-white/5 disabled:opacity-40"
                    >
                      حذف
                    </button>
                  </div>
                ) : null}
              </div>

              <input type="hidden" name={`principle_${index}_icon`} value={item.icon ?? "land"} />
              <input type="hidden" name={`principle_${index}_title`} value={item.title ?? ""} />
              <input type="hidden" name={`principle_${index}_description`} value={item.description ?? ""} />

              {!isHomeTrust ? (
                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-white/55">Icon</span>
                  <select
                    value={item.icon ?? "land"}
                    onChange={(event) => updateItem(index, { icon: event.target.value })}
                    className={fieldClassName()}
                  >
                    {ABOUT_PRINCIPLES_ICON_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {ICON_LABELS[key]}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-white/55">Title</span>
                <input
                  value={item.title ?? ""}
                  onChange={(event) => updateItem(index, { title: event.target.value })}
                  className={fieldClassName()}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-white/55">Description</span>
                <textarea
                  value={item.description ?? ""}
                  onChange={(event) => updateItem(index, { description: event.target.value })}
                  rows={3}
                  className={fieldClassName("resize-y leading-7")}
                />
              </label>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

"use client";

import { useState } from "react";

import {
  getContentTemplatePresets,
  type ContentTemplateContext,
} from "../../../lib/admin/content-workflow/content-template-presets";
import AdminListboxSelect from "../ui/AdminListboxSelect";
import { useAdminFormRuntime } from "../ui/AdminFormRuntime";

type ContentTemplatePickerProps = {
  context: ContentTemplateContext;
  onApplyPreset: (presetKey: string) => boolean;
};

export default function ContentTemplatePicker({
  context,
  onApplyPreset,
}: ContentTemplatePickerProps) {
  const { pending, notifyProjectionChange } = useAdminFormRuntime();
  const presets = getContentTemplatePresets(context);
  const [selectedKey, setSelectedKey] = useState("");
  const selected = presets.find((preset) => preset.key === selectedKey) ?? null;

  function applySelected() {
    if (!selected || pending) return;
    if (onApplyPreset(selected.key)) notifyProjectionChange();
  }

  if (!presets.length) return null;

  return (
    <section className="rounded-[24px] border border-[#D8B87A]/14 bg-[#080B10]/88 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
      <p className="font-en text-[11px] tracking-[0.32em] text-[#D8B87A]/70">
        VENESIA TEMPLATES
      </p>
      <h3 className="mt-2 text-lg font-semibold text-white">
        قوالب المحتوى الرسمية
      </h3>
      <p className="mt-2 text-sm text-white/48">
        قوالب جاهزة بدون قاعدة بيانات — تملأ الحقول كبداية وتذكّرك بمعايير
        Venesia.
      </p>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1 space-y-2">
          <span
            id="content-template-picker-label"
            className="text-xs font-medium text-white/45"
          >
            اختر القالب
          </span>
          <AdminListboxSelect
            value={selectedKey}
            onChange={setSelectedKey}
            options={[
              { value: "", label: "— بدون قالب —" },
              ...presets.map((preset) => ({
                value: preset.key,
                label: preset.labelAr,
              })),
            ]}
            ariaLabelledBy="content-template-picker-label"
          />
        </div>
        <button
          type="button"
          onClick={applySelected}
          disabled={!selected || pending}
          data-content-template-apply
          className="h-11 rounded-full bg-[#D8B87A] px-5 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d] disabled:cursor-not-allowed disabled:opacity-40"
        >
          تطبيق القالب
        </button>
      </div>

      {selected ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <HintBlock
            title="الحقول المطلوبة"
            items={selected.requiredFieldHints}
          />
          <HintBlock title="تلميحات SEO" items={selected.seoHints} />
          <HintBlock title="متطلبات الوسائط" items={selected.mediaHints} />
          <HintBlock title="نبرة Venesia" items={selected.toneNotes} />
        </div>
      ) : null}
    </section>
  );
}

function HintBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[16px] border border-white/8 bg-black/20 p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <ul className="mt-3 space-y-2 text-xs leading-6 text-white/52">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

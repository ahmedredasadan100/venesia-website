"use client";

import { type ReactNode, useState } from "react";
import AdminMediaImageField from "../media/AdminMediaImageField";
import {
  normalizeFloorPlanSpecs,
  type FloorPlanSpec,
} from "../../../lib/projects/floor-plan-specs";
import type { ProjectFloorPlanRow } from "../../../lib/projects/types";

type FloorPlanDraft = {
  area: string;
  label: string;
  plan_image: string;
  featured: boolean;
  specs: FloorPlanSpec[];
};

type AdminFloorPlansEditorProps = {
  defaultPlans: ProjectFloorPlanRow[];
};

function toDraft(plan: ProjectFloorPlanRow): FloorPlanDraft {
  return {
    area: plan.area,
    label: plan.label ?? "",
    plan_image: plan.plan_image,
    featured: plan.featured,
    specs: normalizeFloorPlanSpecs(plan.specs),
  };
}

function emptyPlan(): FloorPlanDraft {
  return { area: "", label: "", plan_image: "", featured: false, specs: [] };
}

function compactInputClass(extra = "") {
  return [
    "w-full min-w-0 rounded-lg border border-white/10 bg-[#05070B] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#D8B87A]/45",
    extra,
  ].join(" ");
}

function CompactFieldRow({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="w-[5.75rem] shrink-0 text-[10px] font-semibold leading-tight text-white/55">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function SpecDeleteButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-red-400/15 bg-red-500/5 text-[11px] text-red-200/90 transition hover:border-red-400/30 hover:bg-red-500/15 hover:text-red-100"
    >
      ×
    </button>
  );
}

function FloorPlanSpecsEditor({
  planIndex,
  specs,
  onChange,
}: {
  planIndex: number;
  specs: FloorPlanSpec[];
  onChange: (next: FloorPlanSpec[]) => void;
}) {
  function updateSpec(specIndex: number, patch: Partial<FloorPlanSpec>) {
    onChange(specs.map((spec, index) => (index === specIndex ? { ...spec, ...patch } : spec)));
  }

  function removeSpec(specIndex: number) {
    onChange(specs.filter((_, index) => index !== specIndex));
  }

  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-white/50">المميزات</span>
        <button
          type="button"
          onClick={() => onChange([...specs, { label: "", value: "" }])}
          className="cursor-pointer rounded-lg border border-[#D8B87A]/30 px-2 py-0.5 text-[10px] font-semibold text-[#D8B87A] transition hover:bg-[#D8B87A]/10"
        >
          + ميزة
        </button>
      </div>

      {specs.length ? (
        <div className="grid grid-cols-1 gap-2">
          {specs.map((spec, specIndex) => (
            <div
              key={`plan-${planIndex}-spec-${specIndex}`}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 p-1.5"
            >
              <input
                name={`floor_plan_${planIndex}_spec_label`}
                value={spec.label}
                onChange={(event) => updateSpec(specIndex, { label: event.target.value })}
                placeholder="Label · غرف"
                aria-label="Label"
                className={compactInputClass()}
              />
              <input
                name={`floor_plan_${planIndex}_spec_value`}
                value={spec.value}
                onChange={(event) => updateSpec(specIndex, { value: event.target.value })}
                placeholder="Value · 3"
                aria-label="Value"
                className={compactInputClass("font-en")}
              />
              <SpecDeleteButton onClick={() => removeSpec(specIndex)} label="حذف الميزة" />
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-white/10 px-2.5 py-2 text-[11px] text-white/38">
          لا توجد مميزات
        </p>
      )}
    </div>
  );
}

export default function AdminFloorPlansEditor({ defaultPlans }: AdminFloorPlansEditorProps) {
  const [plans, setPlans] = useState<FloorPlanDraft[]>(
    defaultPlans.length ? defaultPlans.map(toDraft) : [],
  );

  function updatePlan(index: number, patch: Partial<FloorPlanDraft>) {
    setPlans((current) =>
      current.map((plan, planIndex) => (planIndex === index ? { ...plan, ...patch } : plan)),
    );
  }

  function removePlan(index: number) {
    setPlans((current) => current.filter((_, planIndex) => planIndex !== index));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">المساحات والمخططات</p>
          <p className="mt-1 text-sm text-white/45">اسم عربي، مساحة مركزية، صورة، ومميزات بصيغة Label + Value.</p>
        </div>
        <button
          type="button"
          onClick={() => setPlans((current) => [...current, emptyPlan()])}
          className="cursor-pointer rounded-full border border-[#D8B87A]/35 px-4 py-2 text-sm font-semibold text-[#D8B87A] transition hover:bg-[#D8B87A]/10"
        >
          + إضافة مخطط
        </button>
      </div>

      {plans.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <div
              key={`floor-plan-${index}`}
              className="relative flex flex-col rounded-2xl border border-white/10 bg-[#05070B]/60 p-3 pt-10"
            >
              <input type="hidden" name="floor_plan_featured" value={plan.featured ? "true" : "false"} />

              <button
                type="button"
                onClick={() => removePlan(index)}
                title="حذف المخطط"
                aria-label="حذف المخطط"
                className="absolute left-2.5 top-2.5 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-red-400/20 bg-red-500/5 text-sm text-red-200 transition hover:border-red-400/35 hover:bg-red-500/10"
              >
                ×
              </button>

              <AdminMediaImageField
                name="floor_plan_image"
                label="Plan Image"
                defaultValue={plan.plan_image}
                browseFolder="images/projects"
                variant="compact"
                showLabel={false}
                onValueChange={(planImage) => updatePlan(index, { plan_image: planImage })}
              />

              <CompactFieldRow label="Arabic Name" className="mt-3">
                <input
                  name="floor_plan_label"
                  value={plan.label}
                  onChange={(event) => updatePlan(index, { label: event.target.value })}
                  placeholder="أرضي بجاردن"
                  className={compactInputClass()}
                />
              </CompactFieldRow>

              <CompactFieldRow label="Center Label" className="mt-2">
                <input
                  name="floor_plan_area"
                  value={plan.area}
                  onChange={(event) => updatePlan(index, { area: event.target.value })}
                  placeholder="130m² + Garden 90m²"
                  className={compactInputClass("font-en")}
                />
              </CompactFieldRow>

              <FloorPlanSpecsEditor
                planIndex={index}
                specs={plan.specs}
                onChange={(specs) => updatePlan(index, { specs })}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-white/40">
          لا توجد مخططات بعد — اضغط «إضافة مخطط» للبدء.
        </p>
      )}
    </div>
  );
}

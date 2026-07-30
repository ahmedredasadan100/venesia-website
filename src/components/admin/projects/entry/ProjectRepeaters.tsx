"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";

import type {
  ProjectDeliveryItemEntry,
  ProjectFeatureEntry,
  ProjectFloorPlanDetailEntry,
  ProjectFloorPlanEntry,
  ProjectLocationPointEntry,
  ProjectLocationPointKind,
} from "../../../../lib/admin/projects/project-entry-contract";
import {
  adminFormFieldClassName,
  adminFormLabelClassName,
} from "../../../../lib/admin/admin-ui-styles";
import AdminMediaImageField from "../../media/AdminMediaImageField";
import AdminConfirmDialog from "../../ui/AdminConfirmDialog";
import { AdminFormSection } from "../../ui/AdminForm";
import { AdminFormError, useOptionalAdminFormRuntime } from "../../ui/AdminFormRuntime";
import AdminFormSwitch from "../../ui/AdminFormSwitch";

const fieldClass = adminFormFieldClassName();
const labelClass = adminFormLabelClassName();
const outlineButton =
  "inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[#D8B87A]/30 bg-[#D8B87A]/10 px-4 py-2.5 text-sm font-semibold text-[#D8B87A] transition hover:bg-[#D8B87A]/18 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto";
const iconButton =
  "inline-grid size-9 cursor-pointer place-items-center rounded-xl border border-white/10 bg-black/25 text-white/50 transition hover:border-[#D8B87A]/35 hover:text-[#D8B87A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70 disabled:cursor-not-allowed disabled:opacity-40";
const deleteButton =
  "inline-grid size-9 cursor-pointer place-items-center rounded-xl border border-red-400/25 bg-red-500/5 text-red-300 transition hover:border-red-400/40 hover:bg-red-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300/70 disabled:cursor-not-allowed disabled:opacity-40";
const nestedCardClass =
  "rounded-2xl border border-white/10 bg-[#05070B]/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]";
const itemSurfaceClass = "rounded-xl border border-white/8 bg-white/[0.025]";
const emptyStateClass =
  "rounded-xl border border-dashed border-white/12 bg-black/20 px-4 py-6 text-center text-sm text-white/35";

function newClientKey() {
  return crypto.randomUUID();
}

function moveItem<T>(items: T[], from: number, to: number) {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) {
    return items;
  }
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item === undefined) return items;
  next.splice(to, 0, item);
  return next;
}

function notifyForm(root: HTMLElement | null) {
  queueMicrotask(() => {
    root?.closest("form")?.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function OrderButtons({
  index,
  count,
  onMove,
}: {
  index: number;
  count: number;
  onMove: (nextIndex: number) => void;
}) {
  return (
    <div className="flex gap-1" aria-label="ترتيب العنصر">
      <button type="button" className={iconButton} disabled={index === 0} onClick={() => onMove(index - 1)} aria-label="تحريك لأعلى">↑</button>
      <button type="button" className={iconButton} disabled={index === count - 1} onClick={() => onMove(index + 1)} aria-label="تحريك لأسفل">↓</button>
    </div>
  );
}

function DragHandle() {
  return (
    <span className="cursor-grab select-none px-1 text-lg tracking-[-3px] text-white/35" aria-hidden title="اسحب لتغيير الترتيب">⠿</span>
  );
}

export function ProjectLocationPointsEditor({
  initialItems,
}: {
  initialItems: ProjectLocationPointEntry[];
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const runtime = useOptionalAdminFormRuntime();
  const hasLabelError = Boolean(runtime?.fieldErrors.location_point_label?.length);
  const [items, setItems] = useState(initialItems);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);

  const groups: { kind: ProjectLocationPointKind; title: string; label: string }[] = [
    { kind: "transport", title: "وسائل النقل القريبة", label: "الوسيلة" },
    { kind: "road", title: "المحاور الرئيسية", label: "المحور" },
    { kind: "landmark", title: "المعالم القريبة", label: "المعلم" },
  ];

  function update(clientKey: string, patch: Partial<ProjectLocationPointEntry>) {
    setItems((current) => current.map((item) => item.client_key === clientKey ? { ...item, ...patch } : item));
  }

  function add(kind: ProjectLocationPointKind) {
    setItems((current) => [
      ...current,
      { id: null, client_key: newClientKey(), kind, label: "", distance_text: "" },
    ]);
    notifyForm(rootRef.current);
  }

  function reorder(kind: ProjectLocationPointKind, from: number, to: number) {
    setItems((current) => {
      const positions = current
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.kind === kind);
      if (!positions[from] || !positions[to]) return current;
      const next = [...current];
      const sourceIndex = positions[from].index;
      const targetIndex = positions[to].index;
      const [item] = next.splice(sourceIndex, 1);
      if (!item) return current;
      next.splice(targetIndex, 0, item);
      return next;
    });
    notifyForm(rootRef.current);
  }

  return (
    <div id="location_point_label" ref={rootRef} className="grid scroll-mt-28 gap-4 xl:grid-cols-3" data-project-location-points>
      {deletedIds.map((id) => (
        <input key={id} type="hidden" name="deleted_location_point_id" value={id} />
      ))}
      {groups.map((group) => {
        const groupItems = items.filter((item) => item.kind === group.kind);
        return (
          <section key={group.kind} className={`${nestedCardClass} p-3`}>
            <h3 className="mb-3 text-sm font-bold text-white/85">{group.title}</h3>
            <div className="space-y-2">
              {groupItems.map((item, index) => (
                <div
                  key={item.client_key}
                  draggable={!runtime?.pending}
                  onDragStart={() => setDragKey(item.client_key)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const from = groupItems.findIndex((candidate) => candidate.client_key === dragKey);
                    reorder(group.kind, from, index);
                    setDragKey(null);
                  }}
                  className={`${itemSurfaceClass} p-2`}
                >
                  <input type="hidden" name="location_point_id" value={item.id ?? ""} />
                  <input type="hidden" name="location_point_client_key" value={item.client_key} />
                  <input type="hidden" name="location_point_kind" value={item.kind} />
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <DragHandle />
                    <div className="flex items-center gap-1">
                      <OrderButtons index={index} count={groupItems.length} onMove={(next) => reorder(group.kind, index, next)} />
                      <button type="button" className={deleteButton} onClick={() => setDeleteKey(item.client_key)} aria-label={`حذف ${item.label || group.label}`}>⌫</button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    <label className={labelClass}>
                      {group.label}
                      <input name="location_point_label" value={item.label} onChange={(event) => update(item.client_key, { label: event.target.value })} className={`${fieldClass} mt-1`} aria-invalid={hasLabelError || undefined} aria-describedby={hasLabelError ? "location_point_label-error" : undefined} />
                    </label>
                    <label className={labelClass}>
                      المسافة / الوقت
                      <input name="location_point_distance_text" value={item.distance_text} onChange={(event) => update(item.client_key, { distance_text: event.target.value })} className={`${fieldClass} mt-1`} placeholder="5 دقائق" />
                    </label>
                  </div>
                </div>
              ))}
              {!groupItems.length ? <p className={`${emptyStateClass} py-4 text-xs`}>لا توجد عناصر.</p> : null}
            </div>
            <button type="button" className={`${outlineButton} mt-3 w-full`} onClick={() => add(group.kind)}>+ إضافة</button>
          </section>
        );
      })}

      <AdminFormError name="location_point_label" className="xl:col-span-3" />

      <AdminConfirmDialog
        open={Boolean(deleteKey)}
        title="حذف عنصر الموقع؟"
        description="سيُحذف الارتباط عند الحفظ فقط. يمكنك إغلاق النموذج لإلغاء التغيير."
        confirmLabel="حذف العنصر"
        tone="danger"
        onCancel={() => setDeleteKey(null)}
        onConfirm={() => {
          const deleted = items.find((item) => item.client_key === deleteKey);
          if (deleted?.id) {
            setDeletedIds((current) =>
              current.includes(deleted.id!) ? current : [...current, deleted.id!],
            );
          }
          setItems((current) => current.filter((item) => item.client_key !== deleteKey));
          setDeleteKey(null);
          notifyForm(rootRef.current);
        }}
      />
    </div>
  );
}

function SimpleOrderedEditor<T extends { id: number | null; client_key: string }>({
  initialItems,
  name,
  valueOf,
  createItem,
  updateValue,
  label,
  addLabel,
  emptyLabel,
}: {
  initialItems: T[];
  name: string;
  valueOf: (item: T) => string;
  createItem: () => T;
  updateValue: (item: T, value: string) => T;
  label: string;
  addLabel: string;
  emptyLabel: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const runtime = useOptionalAdminFormRuntime();
  const fieldName = `${name}_body`;
  const hasBodyError = Boolean(runtime?.fieldErrors[fieldName]?.length);
  const [items, setItems] = useState(initialItems);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);

  function reorder(from: number, to: number) {
    setItems((current) => moveItem(current, from, to));
    notifyForm(rootRef.current);
  }

  return (
    <div ref={rootRef} className="space-y-2" data-project-ordered-repeater={name}>
      {deletedIds.map((id) => (
        <input key={id} type="hidden" name={`deleted_${name}_id`} value={id} />
      ))}
      {items.map((item, index) => (
        <div
          key={item.client_key}
          draggable={!runtime?.pending}
          onDragStart={() => setDragKey(item.client_key)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            reorder(items.findIndex((candidate) => candidate.client_key === dragKey), index);
            setDragKey(null);
          }}
          className={`${itemSurfaceClass} flex flex-col gap-2 p-2 sm:flex-row sm:items-center`}
        >
          <input type="hidden" name={`${name}_id`} value={item.id ?? ""} />
          <input type="hidden" name={`${name}_client_key`} value={item.client_key} />
          <div className="flex min-w-0 items-center gap-2 sm:flex-1">
            <DragHandle />
            <input
              id={index === 0 ? `${name}_body` : undefined}
              name={fieldName}
              value={valueOf(item)}
              onChange={(event) => setItems((current) => current.map((candidate) => candidate.client_key === item.client_key ? updateValue(candidate, event.target.value) : candidate))}
              className={`${fieldClass} min-w-0 flex-1`}
              aria-label={`${label} ${index + 1}`}
              aria-invalid={hasBodyError || undefined}
              aria-describedby={hasBodyError ? `${fieldName}-error` : undefined}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <OrderButtons index={index} count={items.length} onMove={(next) => reorder(index, next)} />
            <button type="button" className={deleteButton} onClick={() => setDeleteKey(item.client_key)} aria-label={`حذف ${label} ${index + 1}`}>⌫</button>
          </div>
        </div>
      ))}
      {!items.length ? <p className={emptyStateClass}>{emptyLabel}</p> : null}
      <AdminFormError name={fieldName} />
      <button type="button" className={outlineButton} onClick={() => { setItems((current) => [...current, createItem()]); notifyForm(rootRef.current); }}>+ {addLabel}</button>
      <AdminConfirmDialog
        open={Boolean(deleteKey)}
        title={`حذف ${label}؟`}
        description="سيُطبق الحذف عند الحفظ."
        confirmLabel="حذف"
        tone="danger"
        onCancel={() => setDeleteKey(null)}
        onConfirm={() => {
          const deleted = items.find((item) => item.client_key === deleteKey);
          if (deleted?.id) {
            setDeletedIds((current) =>
              current.includes(deleted.id!) ? current : [...current, deleted.id!],
            );
          }
          setItems((current) => current.filter((item) => item.client_key !== deleteKey));
          setDeleteKey(null);
          notifyForm(rootRef.current);
        }}
      />
    </div>
  );
}

export function ProjectFeaturesEditor({ initialItems }: { initialItems: ProjectFeatureEntry[] }) {
  return (
    <SimpleOrderedEditor
      initialItems={initialItems}
      name="feature"
      valueOf={(item) => item.body}
      createItem={() => ({ id: null, client_key: newClientKey(), body: "" })}
      updateValue={(item, value) => ({ ...item, body: value })}
      label="ميزة"
      addLabel="إضافة ميزة"
      emptyLabel="لا توجد مميزات بعد."
    />
  );
}

export function ProjectDeliveryItemsEditor({ initialItems }: { initialItems: ProjectDeliveryItemEntry[] }) {
  return (
    <SimpleOrderedEditor
      initialItems={initialItems}
      name="delivery_item"
      valueOf={(item) => item.body}
      createItem={() => ({ id: null, client_key: newClientKey(), body: "" })}
      updateValue={(item, value) => ({ ...item, body: value })}
      label="بند"
      addLabel="إضافة بند"
      emptyLabel="لا توجد بنود مواصفات بعد."
    />
  );
}

type PendingPlanDelete =
  | { type: "plan"; planKey: string }
  | { type: "detail"; planKey: string; detailKey: string };

export function ProjectFloorPlansEditor({ initialPlans }: { initialPlans: ProjectFloorPlanEntry[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const runtime = useOptionalAdminFormRuntime();
  const [plans, setPlans] = useState(initialPlans);
  const [deletedPlanIds, setDeletedPlanIds] = useState<number[]>([]);
  const [deletedDetailIds, setDeletedDetailIds] = useState<number[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(initialPlans.slice(0, 1).map((plan) => plan.client_key)));
  const [pendingDelete, setPendingDelete] = useState<PendingPlanDelete | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);

  const hasPlanValidationError = [
    "floor_plan_name",
    "floor_plan_detail_label",
    "floor_plan_detail_value",
    "floor_plan_architectural_image_alt",
    "floor_plan_furnishing_image_alt",
  ].some((field) => Boolean(runtime?.fieldErrors[field]?.length));
  const planFieldError = (field: string) => Boolean(runtime?.fieldErrors[field]?.length);

  function updatePlan(key: string, patch: Partial<ProjectFloorPlanEntry>) {
    setPlans((current) => current.map((plan) => plan.client_key === key ? { ...plan, ...patch } : plan));
  }

  function addPlan() {
    const clientKey = newClientKey();
    setPlans((current) => [
      ...current,
      {
        id: null,
        client_key: clientKey,
        name: "",
        area_text: "",
        featured: false,
        architectural_image: "",
        architectural_image_alt: "",
        furnishing_image: "",
        furnishing_image_alt: "",
        details: [],
      },
    ]);
    setExpanded((current) => new Set([...current, clientKey]));
    notifyForm(rootRef.current);
  }

  function duplicatePlan(plan: ProjectFloorPlanEntry) {
    const clientKey = newClientKey();
    const copy: ProjectFloorPlanEntry = {
      ...plan,
      id: null,
      client_key: clientKey,
      name: plan.name ? `${plan.name} — نسخة` : "نسخة مخطط",
      featured: false,
      details: plan.details.map((detail) => ({ ...detail, id: null, client_key: newClientKey() })),
    };
    setPlans((current) => {
      const index = current.findIndex((candidate) => candidate.client_key === plan.client_key);
      const next = [...current];
      next.splice(index + 1, 0, copy);
      return next;
    });
    setExpanded((current) => new Set([...current, clientKey]));
    notifyForm(rootRef.current);
  }

  function reorderPlans(from: number, to: number) {
    setPlans((current) => moveItem(current, from, to));
    notifyForm(rootRef.current);
  }

  function updateDetails(planKey: string, updater: (details: ProjectFloorPlanDetailEntry[]) => ProjectFloorPlanDetailEntry[]) {
    setPlans((current) => current.map((plan) => plan.client_key === planKey ? { ...plan, details: updater(plan.details) } : plan));
  }

  return (
    <div ref={rootRef} className="space-y-3" data-project-floor-plans>
      {deletedPlanIds.map((id) => (
        <input key={id} type="hidden" name="deleted_floor_plan_id" value={id} />
      ))}
      {deletedDetailIds.map((id) => (
        <input key={id} type="hidden" name="deleted_floor_plan_detail_id" value={id} />
      ))}
      <div className="flex justify-end">
        <button type="button" className={outlineButton} onClick={addPlan}>+ إضافة مخطط جديد</button>
      </div>

      {plans.map((plan, index) => {
        const isExpanded = hasPlanValidationError || expanded.has(plan.client_key);
        return (
          <article
            key={plan.client_key}
            draggable={!runtime?.pending}
            onDragStart={() => setDragKey(plan.client_key)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event: DragEvent<HTMLElement>) => {
              event.preventDefault();
              reorderPlans(plans.findIndex((candidate) => candidate.client_key === dragKey), index);
              setDragKey(null);
            }}
            className={`${nestedCardClass} overflow-hidden`}
          >
            <input type="hidden" name="floor_plan_id" value={plan.id ?? ""} />
            <input type="hidden" name="floor_plan_client_key" value={plan.client_key} />
            <input type="hidden" name="floor_plan_featured" value={plan.featured ? "true" : "false"} />
            <header className="border-b border-white/8 px-3 py-3 sm:px-4">
              <div className="flex min-w-0 items-center gap-3">
                <DragHandle />
                <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#D8B87A]/25 bg-[#D8B87A]/12 text-sm font-bold text-[#D8B87A]">{String(index + 1).padStart(2, "0")}</span>
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-sm text-white/85">{plan.name || "مخطط جديد"}</strong>
                  <span className="mt-1 block truncate text-xs text-white/40">{plan.area_text || "المساحة غير محددة"}</span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                <AdminFormSwitch
                  name="floor_plan_featured_control"
                  label="مخطط مميز"
                  value={plan.client_key}
                  checked={plan.featured}
                  surface
                  onChange={(event) => {
                    updatePlan(plan.client_key, { featured: event.target.checked });
                    notifyForm(rootRef.current);
                  }}
                />
                <OrderButtons index={index} count={plans.length} onMove={(next) => reorderPlans(index, next)} />
                <button type="button" className={iconButton} onClick={() => duplicatePlan(plan)} aria-label="نسخ المخطط">⧉</button>
                <button type="button" className={deleteButton} onClick={() => setPendingDelete({ type: "plan", planKey: plan.client_key })} aria-label="حذف المخطط">⌫</button>
                <button type="button" className={iconButton} onClick={() => setExpanded((current) => { const next = new Set(current); if (next.has(plan.client_key)) next.delete(plan.client_key); else next.add(plan.client_key); return next; })} aria-expanded={isExpanded} aria-label={isExpanded ? "طي المخطط" : "فتح المخطط"}>{isExpanded ? "⌃" : "⌄"}</button>
              </div>
            </header>

            <div
              aria-hidden={!isExpanded}
              className={`${isExpanded ? "grid" : "hidden"} gap-5 p-4 xl:grid-cols-2`}
            >
                <section className={`${itemSurfaceClass} space-y-4 p-4`}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className={labelClass}>
                      اسم المخطط
                      <input id={index === 0 ? "floor_plan_name" : undefined} name="floor_plan_name" value={plan.name} onChange={(event) => updatePlan(plan.client_key, { name: event.target.value })} className={`${fieldClass} mt-1`} aria-invalid={planFieldError("floor_plan_name") || undefined} aria-describedby={planFieldError("floor_plan_name") ? "floor_plan_name-error" : undefined} />
                    </label>
                    <label className={labelClass}>
                      المساحة
                      <input name="floor_plan_area_text" value={plan.area_text} onChange={(event) => updatePlan(plan.client_key, { area_text: event.target.value })} className={`${fieldClass} mt-1`} placeholder="130م² + حديقة 90م²" />
                    </label>
                  </div>

                  <div>
                    <h4 className="mb-2 text-sm font-bold text-white/80">تفاصيل المخطط</h4>
                    <div className="space-y-2">
                      {plan.details.map((detail, detailIndex) => (
                        <div key={detail.client_key} className="grid gap-2 rounded-xl border border-white/8 bg-black/20 p-2 sm:grid-cols-[1fr_1fr_auto]">
                          <input type="hidden" name="floor_plan_detail_id" value={detail.id ?? ""} />
                          <input type="hidden" name="floor_plan_detail_client_key" value={detail.client_key} />
                          <input type="hidden" name="floor_plan_detail_plan_key" value={plan.client_key} />
                          <input id={detailIndex === 0 && index === 0 ? "floor_plan_detail_label" : undefined} name="floor_plan_detail_label" value={detail.label} onChange={(event) => updateDetails(plan.client_key, (details) => details.map((item) => item.client_key === detail.client_key ? { ...item, label: event.target.value } : item))} className={fieldClass} placeholder="البيان" aria-invalid={planFieldError("floor_plan_detail_label") || undefined} aria-describedby={planFieldError("floor_plan_detail_label") ? "floor_plan_detail_label-error" : undefined} />
                          <input name="floor_plan_detail_value" value={detail.value} onChange={(event) => updateDetails(plan.client_key, (details) => details.map((item) => item.client_key === detail.client_key ? { ...item, value: event.target.value } : item))} className={fieldClass} placeholder="القيمة" aria-invalid={planFieldError("floor_plan_detail_value") || undefined} aria-describedby={planFieldError("floor_plan_detail_value") ? "floor_plan_detail_value-error" : undefined} />
                          <div className="flex gap-1">
                            <OrderButtons index={detailIndex} count={plan.details.length} onMove={(next) => { updateDetails(plan.client_key, (details) => moveItem(details, detailIndex, next)); notifyForm(rootRef.current); }} />
                            <button type="button" className={deleteButton} onClick={() => setPendingDelete({ type: "detail", planKey: plan.client_key, detailKey: detail.client_key })} aria-label="حذف التفصيلة">⌫</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button type="button" className={`${outlineButton} mt-3`} onClick={() => { updateDetails(plan.client_key, (details) => [...details, { id: null, client_key: newClientKey(), label: "", value: "" }]); notifyForm(rootRef.current); }}>+ إضافة تفصيلة</button>
                  </div>
                </section>

                <section className="grid gap-4 sm:grid-cols-2">
                  <div className={`${itemSurfaceClass} p-3`}>
                    <AdminMediaImageField name="floor_plan_architectural_image" label="المخطط المعماري" defaultValue={plan.architectural_image} browseFolder="images/projects/plans" appearance="dark" onValueChange={(value) => updatePlan(plan.client_key, { architectural_image: value })} />
                    <label className={`${labelClass} mt-3`}>النص البديل<input id={index === 0 ? "floor_plan_architectural_image_alt" : undefined} name="floor_plan_architectural_image_alt" value={plan.architectural_image_alt} onChange={(event) => updatePlan(plan.client_key, { architectural_image_alt: event.target.value })} className={`${fieldClass} mt-1`} aria-invalid={planFieldError("floor_plan_architectural_image_alt") || undefined} aria-describedby={planFieldError("floor_plan_architectural_image_alt") ? "floor_plan_architectural_image_alt-error" : undefined} /></label>
                  </div>
                  <div className={`${itemSurfaceClass} p-3`}>
                    <AdminMediaImageField name="floor_plan_furnishing_image" label="مخطط الفرش" defaultValue={plan.furnishing_image} browseFolder="images/projects/plans" appearance="dark" onValueChange={(value) => updatePlan(plan.client_key, { furnishing_image: value })} />
                    <label className={`${labelClass} mt-3`}>النص البديل<input id={index === 0 ? "floor_plan_furnishing_image_alt" : undefined} name="floor_plan_furnishing_image_alt" value={plan.furnishing_image_alt} onChange={(event) => updatePlan(plan.client_key, { furnishing_image_alt: event.target.value })} className={`${fieldClass} mt-1`} aria-invalid={planFieldError("floor_plan_furnishing_image_alt") || undefined} aria-describedby={planFieldError("floor_plan_furnishing_image_alt") ? "floor_plan_furnishing_image_alt-error" : undefined} /></label>
                  </div>
                </section>
            </div>
          </article>
        );
      })}

      {!plans.length ? <p className={`${emptyStateClass} py-10`}>لا توجد مخططات بعد.</p> : null}

      <div className="space-y-1">
        <AdminFormError name="floor_plan_name" />
        <AdminFormError name="floor_plan_detail_label" />
        <AdminFormError name="floor_plan_detail_value" />
        <AdminFormError name="floor_plan_architectural_image_alt" />
        <AdminFormError name="floor_plan_furnishing_image_alt" />
      </div>

      <AdminConfirmDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete?.type === "plan" ? "حذف المخطط؟" : "حذف التفصيلة؟"}
        description="سيُطبق الحذف داخل الحفظ الذري فقط."
        confirmLabel="حذف"
        tone="danger"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete?.type === "plan") {
            const deleted = plans.find((plan) => plan.client_key === pendingDelete.planKey);
            if (deleted?.id) {
              setDeletedPlanIds((current) =>
                current.includes(deleted.id!) ? current : [...current, deleted.id!],
              );
            }
            setPlans((current) => current.filter((plan) => plan.client_key !== pendingDelete.planKey));
          } else if (pendingDelete?.type === "detail") {
            const deleted = plans
              .find((plan) => plan.client_key === pendingDelete.planKey)
              ?.details.find((detail) => detail.client_key === pendingDelete.detailKey);
            if (deleted?.id) {
              setDeletedDetailIds((current) =>
                current.includes(deleted.id!) ? current : [...current, deleted.id!],
              );
            }
            updateDetails(pendingDelete.planKey, (details) => details.filter((detail) => detail.client_key !== pendingDelete.detailKey));
          }
          setPendingDelete(null);
          notifyForm(rootRef.current);
        }}
      />
    </div>
  );
}

export function RepeaterSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <AdminFormSection title={title} description={description} compactHeader className="min-w-0">
      {children}
    </AdminFormSection>
  );
}

"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { AdminFeedbackRegion } from "../../../../../components/admin/AdminFeedbackProvider";
import { AdminFormPendingFields } from "../../../../../components/admin/ui/AdminFormRuntime";
import AdminFormListboxSelect from "../../../../../components/admin/ui/AdminFormListboxSelect";
import AdminFormSwitch from "../../../../../components/admin/ui/AdminFormSwitch";
import type { PageLayoutDefinition } from "../../../../../lib/page-composition/load-page-regions";
import { savePageLayout, selectPageLayout } from "../actions";

type DraftRegion = {
  draftId: string;
  key: string;
  adminLabel: string;
  sortOrder: number;
};
type Feedback = { ok: boolean; message: string; warning?: string | null } | null;

const NEW_LAYOUT_VALUE = "new";

function layoutRegions(layout: PageLayoutDefinition | undefined): DraftRegion[] {
  return layout?.regions.map((region) => ({
    ...region,
    draftId: `layout-${layout.id}-${region.key}`,
  })) ?? [
    { draftId: "new-layout-main", key: "main", adminLabel: "المحتوى الرئيسي", sortOrder: 10 },
  ];
}

export default function PageLayoutManager({
  pageId,
  currentLayoutId,
  layouts,
}: {
  pageId: number;
  currentLayoutId: number;
  layouts: readonly PageLayoutDefinition[];
}) {
  const router = useRouter();
  const initialLayout = layouts.find((layout) => layout.id === currentLayoutId);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const [assignmentLayoutId, setAssignmentLayoutId] = useState(String(currentLayoutId));
  const [editorValue, setEditorValue] = useState(String(currentLayoutId));
  const [layoutKey, setLayoutKey] = useState(initialLayout?.key ?? "");
  const [adminLabel, setAdminLabel] = useState(initialLayout?.adminLabel ?? "");
  const [regions, setRegions] = useState<DraftRegion[]>(() => layoutRegions(initialLayout));
  const [assignAfterSave, setAssignAfterSave] = useState(true);

  const editedLayout = editorValue === NEW_LAYOUT_VALUE
    ? undefined
    : layouts.find((layout) => String(layout.id) === editorValue);
  const legacyProtected = editedLayout?.key === "venisia-legacy";

  function handleEditorChange(nextValue: string) {
    setEditorValue(nextValue);
    if (nextValue === NEW_LAYOUT_VALUE) {
      setLayoutKey("");
      setAdminLabel("");
      setRegions(layoutRegions(undefined));
      setAssignAfterSave(true);
      return;
    }
    const layout = layouts.find((candidate) => String(candidate.id) === nextValue);
    if (!layout) return;
    setLayoutKey(layout.key);
    setAdminLabel(layout.adminLabel);
    setRegions(layoutRegions(layout));
    setAssignAfterSave(layout.id === currentLayoutId);
  }

  function showFeedback(next: NonNullable<Feedback>) {
    setFeedback(next);
    requestAnimationFrame(() => feedbackRef.current?.focus());
  }

  function handleSelectLayout() {
    const layoutId = Number(assignmentLayoutId);
    startTransition(async () => {
      const result = await selectPageLayout(pageId, layoutId);
      showFeedback({ ok: result.ok, message: result.message, warning: result.warning });
      if (result.ok) router.refresh();
    });
  }

  function handleSaveLayout() {
    startTransition(async () => {
      const result = await savePageLayout({
        pageId,
      layoutId: editedLayout?.id ?? null,
      key: layoutKey,
      adminLabel,
      regions: regions.map(({ key, adminLabel: regionLabel, sortOrder }) => ({
        key,
        adminLabel: regionLabel,
        sortOrder,
      })),
        assignPage: assignAfterSave,
      });
      showFeedback({ ok: result.ok, message: result.message, warning: result.warning });
      if (result.ok && result.layoutId) {
        setEditorValue(String(result.layoutId));
        if (assignAfterSave) setAssignmentLayoutId(String(result.layoutId));
        router.refresh();
      }
    });
  }

  function moveRegion(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= regions.length) return;
    setRegions((current) => {
      const ordered = [...current];
      [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
      return ordered.map((region, regionIndex) => ({ ...region, sortOrder: (regionIndex + 1) * 10 }));
    });
  }

  const layoutOptions = layouts.map((layout) => ({
    value: String(layout.id),
    label: `${layout.adminLabel} (${layout.key})`,
  }));
  const editorOptions = [
    { value: NEW_LAYOUT_VALUE, label: "إنشاء تخطيط جديد" },
    ...layoutOptions,
  ];

  return (
    <section className="space-y-6 rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6" dir="rtl">
      <div
        ref={feedbackRef}
        tabIndex={-1}
        className="outline-none"
      >
        <AdminFeedbackRegion
          channel={`page-layout:${pageId}`}
          label="نتيجة إدارة تخطيط الصفحة"
          feedback={feedback ? {
            variant: feedback.ok ? (feedback.warning ? "warning" : "success") : "danger",
            title: feedback.ok ? (feedback.warning ? "تم الحفظ مع تنبيه" : "تم الحفظ") : "تعذر الحفظ",
            message: feedback.warning ?? feedback.message,
            layout: "inline",
            dismissible: true,
            lifecycle: "manual",
          } : null}
        />
      </div>

      <AdminFormPendingFields pending={isPending} className="space-y-6">
        <div className="grid gap-4 rounded-2xl border border-white/8 bg-white/[0.025] p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <AdminFormListboxSelect
            name="page_layout_id"
            label="التخطيط المختار للصفحة"
            value={assignmentLayoutId}
            onChange={setAssignmentLayoutId}
            options={layoutOptions}
            required
            sizing="full"
            hint="يُرفض الاختيار تلقائيًا إذا كانت أي Assignment تستخدم Region غير موجودة في التخطيط."
          />
          <button
            type="button"
            onClick={handleSelectLayout}
            disabled={isPending || assignmentLayoutId === String(currentLayoutId)}
            className="min-h-11 rounded-2xl bg-[#D8B87A] px-5 text-sm font-bold text-[#06101C] disabled:cursor-not-allowed disabled:opacity-50"
          >
            اختيار للصفحة
          </button>
        </div>

        <div className="space-y-5">
          <AdminFormListboxSelect
            name="layout_editor"
            label="إنشاء أو تحرير تخطيط"
            value={editorValue}
            onChange={handleEditorChange}
            options={editorOptions}
            sizing="full"
          />

          {legacyProtected ? (
            <AdminFeedbackRegion
              channel={`page-layout:${pageId}:legacy`}
              label="حماية التخطيط الحالي"
              feedback={{
                variant: "info",
                title: "التخطيط الحالي محمي",
                message: "للحفاظ على شكل الصفحات الحالية، أنشئ تخطيطًا جديدًا بدل تعديل venisia-legacy.",
                layout: "inline",
                dismissible: false,
                lifecycle: "persistent",
              }}
            />
          ) : (
            <div className="space-y-5 rounded-2xl border border-white/8 bg-white/[0.025] p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-white/70">
                  <span>المعرّف التقني</span>
                  <input
                    value={layoutKey}
                    onChange={(event) => setLayoutKey(event.currentTarget.value)}
                    disabled={Boolean(editedLayout)}
                    pattern="[a-z][a-z0-9-]{0,63}"
                    required
                    dir="ltr"
                    className="min-h-11 w-full rounded-2xl border border-white/12 bg-black/30 px-4 text-white disabled:opacity-55"
                  />
                </label>
                <label className="space-y-2 text-sm text-white/70">
                  <span>الاسم الإداري</span>
                  <input
                    value={adminLabel}
                    onChange={(event) => setAdminLabel(event.currentTarget.value)}
                    required
                    className="min-h-11 w-full rounded-2xl border border-white/12 bg-black/30 px-4 text-white"
                  />
                </label>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-white">المناطق وترتيبها</h3>
                  <button
                    type="button"
                    onClick={() => setRegions((current) => [
                      ...current,
                      {
                        draftId: crypto.randomUUID(),
                        key: `region-${current.length + 1}`,
                        adminLabel: `منطقة ${current.length + 1}`,
                        sortOrder: (current.length + 1) * 10,
                      },
                    ])}
                    className="min-h-10 rounded-xl border border-[#D8B87A]/40 px-4 text-xs font-bold text-[#E8C98B]"
                  >
                    إضافة Region
                  </button>
                </div>
                {regions.map((region, index) => (
                  <div key={region.draftId} className="grid gap-3 rounded-2xl border border-white/8 p-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                    <label className="space-y-1 text-xs text-white/60">
                      <span>المعرّف</span>
                      <input
                        value={region.key}
                        onChange={(event) => setRegions((current) => current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, key: event.currentTarget.value } : item,
                        ))}
                        dir="ltr"
                        required
                        className="min-h-10 w-full rounded-xl border border-white/12 bg-black/30 px-3 text-sm text-white"
                      />
                    </label>
                    <label className="space-y-1 text-xs text-white/60">
                      <span>الاسم الإداري</span>
                      <input
                        value={region.adminLabel}
                        onChange={(event) => setRegions((current) => current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, adminLabel: event.currentTarget.value } : item,
                        ))}
                        required
                        className="min-h-10 w-full rounded-xl border border-white/12 bg-black/30 px-3 text-sm text-white"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => moveRegion(index, -1)} disabled={index === 0} aria-label={`نقل ${region.adminLabel} لأعلى`} className="min-h-10 rounded-xl border border-white/12 px-3 disabled:opacity-35">↑</button>
                      <button type="button" onClick={() => moveRegion(index, 1)} disabled={index === regions.length - 1} aria-label={`نقل ${region.adminLabel} لأسفل`} className="min-h-10 rounded-xl border border-white/12 px-3 disabled:opacity-35">↓</button>
                      <button type="button" onClick={() => setRegions((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={regions.length === 1} className="min-h-10 rounded-xl border border-red-400/25 px-3 text-red-200 disabled:opacity-35">حذف</button>
                    </div>
                  </div>
                ))}
              </div>

              <AdminFormSwitch
                checked={assignAfterSave}
                onChange={(event) => setAssignAfterSave(event.currentTarget.checked)}
                label="احفظ واختر هذا التخطيط للصفحة في العملية الذرية نفسها"
                surface
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveLayout}
                  disabled={isPending || !layoutKey.trim() || !adminLabel.trim() || regions.length === 0}
                  className="min-h-11 rounded-2xl bg-[#D8B87A] px-6 text-sm font-bold text-[#06101C] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  حفظ التخطيط والمناطق
                </button>
              </div>
            </div>
          )}
        </div>
      </AdminFormPendingFields>
    </section>
  );
}

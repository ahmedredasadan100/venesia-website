"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { AdminFeedbackRegion } from "../../../../../components/admin/AdminFeedbackProvider";
import { ModuleEditorRepeaterCard } from "../../../../../components/admin/page-blocks/ModuleEditorPresentation";
import {
  AdminActionButton,
  AdminCard,
  AdminDataGridActionIcon,
  AdminFormControlHeader,
  AdminFormGrid,
  AdminFormField,
  AdminFormSection,
  AdminStickyFormBar,
  ADMIN_FORM_STACK_CLASS_NAME,
  adminFormFieldClassName,
  adminFormLabelClassName,
} from "../../../../../components/admin/ui";
import { AdminModuleSectionHeader, AdminModuleTabIcon } from "../../../../../components/admin/ui/AdminModuleTabs";
import { ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME } from "../../../../../lib/admin/admin-ui-styles";
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
    <section data-page-layout-manager="" className={ADMIN_FORM_STACK_CLASS_NAME} dir="rtl">
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

      <AdminFormPendingFields pending={isPending} className="min-w-0">
        <div className={ADMIN_FORM_STACK_CLASS_NAME}>
        <AdminFormSection presentation="panel" header={<AdminModuleSectionHeader id="page-layout-selection" sectionHeading="اختيار تخطيط الصفحة" icon="plans" sectionHeaderPresentation="premium" sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME} />}>
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end">
            <div className="min-w-0 flex-1">
              <AdminFormListboxSelect
                name="page_layout_id"
                label="التخطيط المختار للصفحة"
                presentation="panel"
                value={assignmentLayoutId}
                onChange={setAssignmentLayoutId}
                options={layoutOptions}
                required
                sizing="full"
                hint="يُرفض الاختيار تلقائيًا إذا كانت أي Assignment تستخدم Region غير موجودة في التخطيط."
              />
            </div>
            <AdminActionButton
              type="button"
              onClick={handleSelectLayout}
              disabled={isPending || assignmentLayoutId === String(currentLayoutId)}
              variant="primary"
            >
              اختيار للصفحة
            </AdminActionButton>
          </div>
        </AdminFormSection>

        <AdminFormSection presentation="panel" header={<AdminModuleSectionHeader id="page-layout-editor" sectionHeading="إنشاء أو تحرير تخطيط" icon="settings" sectionHeaderPresentation="premium" sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME} />}>
          <div className={ADMIN_FORM_STACK_CLASS_NAME}>
            <AdminFormListboxSelect
              name="layout_editor"
              label="إنشاء أو تحرير تخطيط"
              presentation="panel"
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
            <div className={ADMIN_FORM_STACK_CLASS_NAME}>
              <AdminFormGrid columns={2}>
                <AdminCard presentation="premium" className="p-3">
                  <AdminFormField label="المعرّف التقني" required presentation="panel">
                    <input
                      value={layoutKey}
                      onChange={(event) => setLayoutKey(event.currentTarget.value)}
                      disabled={Boolean(editedLayout)}
                      pattern="[a-z][a-z0-9-]{0,63}"
                      required
                      dir="ltr"
                      className={adminFormFieldClassName("disabled:opacity-55")}
                    />
                  </AdminFormField>
                </AdminCard>
                <AdminCard presentation="premium" className="p-3">
                  <AdminFormField label="الاسم الإداري" required presentation="panel">
                    <input
                      value={adminLabel}
                      onChange={(event) => setAdminLabel(event.currentTarget.value)}
                      required
                      className={adminFormFieldClassName()}
                    />
                  </AdminFormField>
                </AdminCard>
              </AdminFormGrid>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <AdminFormControlHeader title={<span role="heading" aria-level={3}>المناطق وترتيبها</span>} icon={<AdminModuleTabIcon name="section" />} presentation="leading-icon" />
                  <AdminActionButton
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
                    variant="gold"
                  >
                    إضافة Region
                  </AdminActionButton>
                </div>
                {regions.map((region, index) => (
                  <div key={region.draftId} data-page-layout-region="">
                    <ModuleEditorRepeaterCard
                      title={`منطقة ${index + 1}`}
                      icon={<AdminModuleTabIcon name="section" />}
                      actions={<>
                        <AdminActionButton type="button" onClick={() => moveRegion(index, -1)} disabled={index === 0} aria-label={`نقل ${region.adminLabel} لأعلى`} size="icon">↑</AdminActionButton>
                        <AdminActionButton type="button" onClick={() => moveRegion(index, 1)} disabled={index === regions.length - 1} aria-label={`نقل ${region.adminLabel} لأسفل`} size="icon">↓</AdminActionButton>
                        <AdminActionButton type="button" onClick={() => setRegions((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={regions.length === 1} variant="danger-ghost"><AdminDataGridActionIcon action="delete" />حذف</AdminActionButton>
                      </>}
                    >
                      <AdminFormGrid columns={2}>
                        <AdminFormField label="المعرّف" required presentation="panel">
                          <input
                            value={region.key}
                            onChange={(event) => {
                              const value = event.currentTarget.value;
                              setRegions((current) => current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, key: value } : item,
                              ));
                            }}
                            dir="ltr"
                            required
                            className={adminFormFieldClassName()}
                          />
                        </AdminFormField>
                        <AdminFormField label="الاسم الإداري" required presentation="panel">
                          <input
                            value={region.adminLabel}
                            onChange={(event) => {
                              const value = event.currentTarget.value;
                              setRegions((current) => current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, adminLabel: value } : item,
                              ));
                            }}
                            required
                            className={adminFormFieldClassName()}
                          />
                        </AdminFormField>
                      </AdminFormGrid>
                    </ModuleEditorRepeaterCard>
                  </div>
                ))}
              </div>

              <AdminCard presentation="premium" className="p-3">
                <AdminFormSwitch
                  checked={assignAfterSave}
                  onChange={(event) => setAssignAfterSave(event.currentTarget.checked)}
                  label={<span className={adminFormLabelClassName({ textInset: true })}><span data-admin-form-label-text>احفظ واختر هذا التخطيط للصفحة في العملية الذرية نفسها</span></span>}
                  embedded
                />
              </AdminCard>
            </div>
          )}
          </div>
        </AdminFormSection>
        {!legacyProtected ? (
              <AdminStickyFormBar title="إجراءات النموذج" description={null} icon={<AdminModuleTabIcon name="content" />}>
                <AdminActionButton
                  type="button"
                  onClick={handleSaveLayout}
                  disabled={isPending || !layoutKey.trim() || !adminLabel.trim() || regions.length === 0}
                  variant="primary"
                >
                  حفظ التخطيط والمناطق
                </AdminActionButton>
              </AdminStickyFormBar>
        ) : null}
        </div>
      </AdminFormPendingFields>
    </section>
  );
}

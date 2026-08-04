"use client";

import AdminModuleTabs from "../ui/AdminModuleTabs";
import BlockEditorContextHeader, { BlockEditorSaveFeedback } from "./BlockEditorContextHeader";
import ModuleCrossPageUsageBanner from "./ModuleCrossPageUsageBanner";
import ModuleDependencyHintsPanel from "./ModuleDependencyHintsPanel";
import ModulePageAssignmentsField from "./ModulePageAssignmentsField";
import BreadcrumbManualItemsField from "./editors/BreadcrumbManualItemsField";
import { fieldClassName } from "../../../lib/page-blocks/admin-utils";
import type { BreadcrumbBlockConfig } from "../../../lib/page-blocks/configs";
import type { ModuleAssignmentContext } from "../../../lib/page-blocks/module-assignments-query";
import { getSlotCompatibilityLabel } from "../../../lib/page-composition/slot-module-registry";

type BreadcrumbModuleEditClientProps = {
  block: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    variant: string;
    style_preset: string | null;
    status: string;
  };
  config: BreadcrumbBlockConfig;
  assignmentContext: ModuleAssignmentContext;
  saved?: boolean;
  updateAction: (formData: FormData) => void | Promise<void>;
};

export default function BreadcrumbModuleEditClient({
  block,
  config,
  assignmentContext,
  saved,
  updateAction,
}: BreadcrumbModuleEditClientProps) {
  const assignedPageIds = assignmentContext.assignments.map((row) => row.page_id);

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      <BlockEditorContextHeader
        backHref="/admin/pages-blocks/blocks/breadcrumb"
        backLabel="الرجوع لكل موديولات Breadcrumb"
        eyebrow="BREADCRUMB MODULE"
        title={block.name}
        description="موديول مسار تنقّل قابل لإعادة الاستخدام — يُفضّل في الفتحة الرئيسية أعلى المحتوى."
        status={block.status}
        saved={saved}
        slotContext={getSlotCompatibilityLabel("breadcrumb")}
      />

      <form action={updateAction}>
        <input type="hidden" name="id" value={block.id} />
        <input type="hidden" name="style_preset" value={block.style_preset ?? "premium-dark"} />

        <AdminModuleTabs
          activePanelContext={<BlockEditorSaveFeedback backHref="/admin/pages-blocks/blocks/breadcrumb" saved={saved} />}
          tabs={[
            {
              id: "content",
              navigationLabel: "المحتوى",
              sectionHeading: "محتوى مسار التنقل",
              sectionDescription: "حدّد مصدر المسار وتسميات عناصره وخيارات ظهوره.",
              icon: "content",
              content: (
                <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">مصدر المسار</span>
                    <select name="source" defaultValue={config.source ?? "navigation"} className={fieldClassName()}>
                      <option value="navigation">من قائمة التنقل (تلقائي)</option>
                      <option value="manual">يدوي</option>
                    </select>
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">تسمية الصفحة الحالية (اختياري)</span>
                    <input
                      name="current_label_override"
                      defaultValue={config.currentLabelOverride ?? ""}
                      placeholder="يستبدل آخر عنصر في المسار"
                      className={fieldClassName()}
                    />
                  </label>
                  <BreadcrumbManualItemsField items={config.manualItems ?? []} />
                  <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white/70">
                    <span>إظهار الرئيسية</span>
                    <input
                      type="checkbox"
                      name="show_home"
                      value="true"
                      defaultChecked={config.showHome !== false}
                    />
                  </label>
                </section>
              ),
            },
            {
              id: "settings",
              navigationLabel: "الإعدادات",
              sectionHeading: "إعدادات الموديول",
              sectionDescription: "أدر الهوية الداخلية ونمط العرض وحالة النشر.",
              icon: "settings",
              content: (
                <div className="space-y-5">
                  <ModuleDependencyHintsPanel moduleKind="breadcrumb" templateSlug={block.slug} />
                  <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                  <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
                    <h2 className="text-lg font-semibold text-white">بيانات الموديول</h2>
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">اسم الموديول</span>
                      <input name="name" defaultValue={block.name} required className={fieldClassName()} />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">Slug</span>
                      <input name="slug" defaultValue={block.slug} required dir="ltr" className={fieldClassName()} />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">وصف داخلي</span>
                      <input name="description" defaultValue={block.description ?? ""} className={fieldClassName()} />
                    </label>
                  </section>

                  <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
                    <h2 className="text-lg font-semibold text-white">إعدادات العرض</h2>
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">Variant</span>
                      <select name="variant" defaultValue={block.variant} className={fieldClassName()}>
                        <option value="hero-inline">Hero Inline — داخل الهيرو</option>
                        <option value="standalone">Standalone — موضع مستقل في الـ slot</option>
                      </select>
                    </label>
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">حالة الموديول</span>
                      <select name="status" defaultValue={block.status} className={fieldClassName()}>
                        <option value="draft">مسودة</option>
                        <option value="published">منشور</option>
                        <option value="unpublished">مخفي</option>
                        <option value="archived">أرشيف</option>
                      </select>
                    </label>
                    <p className="text-xs leading-6 text-white/42">
                      الموديول المخفي أو غير المنشور لا يظهر على الموقع حتى لو كان مربوطًا بصفحة.
                    </p>
                  </section>
                  </div>
                </div>
              ),
            },
            {
              id: "pages",
              navigationLabel: "الصفحات",
              sectionHeading: "الظهور في الصفحات",
              sectionDescription: "راجع مواضع استخدام الموديول وحدّد الصفحات المرتبطة به.",
              icon: "plans",
              content: (
                <div className="space-y-5">
                  <ModuleCrossPageUsageBanner moduleName={block.name} assignments={assignmentContext.assignments} />
                  <ModulePageAssignmentsField
                    pages={assignmentContext.pages}
                    assignedPageIds={assignedPageIds}
                  />
                </div>
              ),
            },
          ]}
        />

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            className="rounded-2xl bg-[#D8B87A] px-6 py-3 text-sm font-bold text-[#06101C] transition hover:bg-[#e5c98d]"
          >
            حفظ الموديول
          </button>
        </div>
      </form>
    </div>
  );
}

"use client";

import Link from "next/link";

import AdminModuleTabs from "./AdminModuleTabs";
import ModulePageAssignmentsField from "./ModulePageAssignmentsField";
import { fieldClassName, statusMeta } from "../../../lib/page-blocks/admin-utils";
import type { BreadcrumbBlockConfig } from "../../../lib/page-blocks/configs";
import type { ModuleAssignmentContext } from "../../../lib/page-blocks/module-assignments-query";

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
  manualItemsText: string;
  assignmentContext: ModuleAssignmentContext;
  saved?: boolean;
  updateAction: (formData: FormData) => void | Promise<void>;
};

export default function BreadcrumbModuleEditClient({
  block,
  config,
  manualItemsText,
  assignmentContext,
  saved,
  updateAction,
}: BreadcrumbModuleEditClientProps) {
  const status = statusMeta(block.status);
  const assignedPageIds = assignmentContext.assignments.map((row) => row.page_id);

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      <section className="rounded-[34px] border border-white/10 bg-[#080B10]/78 p-6 shadow-[0_30px_110px_rgba(0,0,0,0.26)] backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href="/admin/pages-blocks/blocks/breadcrumb"
              className="mb-4 inline-flex items-center gap-2 text-sm text-white/45 hover:text-[#D8B87A]"
            >
              <span aria-hidden="true">→</span>
              الرجوع لكل موديولات Breadcrumb
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D8B87A]/70">Breadcrumb Module</p>
            <h1 className="mt-3 text-2xl font-semibold text-white md:text-3xl">{block.name}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/56">
              موديول مسار تنقّل قابل لإعادة الاستخدام — عدّل المحتوى والإعدادات واختر الصفحات من تبويب «يظهر في الصفحات».
            </p>
            {saved ? <p className="mt-3 text-sm text-emerald-300">تم حفظ الموديول بنجاح.</p> : null}
          </div>

          <span
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              status.tone === "green"
                ? "bg-emerald-500/10 text-emerald-300"
                : status.tone === "gold"
                  ? "bg-[#D8B87A]/10 text-[#D8B87A]"
                  : "bg-white/10 text-white/45"
            }`}
          >
            {status.label}
          </span>
        </div>
      </section>

      <form action={updateAction}>
        <input type="hidden" name="id" value={block.id} />
        <input type="hidden" name="style_preset" value={block.style_preset ?? "premium-dark"} />

        <AdminModuleTabs
          tabs={[
            {
              id: "content",
              label: "المحتوى",
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
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">عناصر يدوية — سطر لكل عنصر: Label | /href</span>
                    <textarea
                      name="manual_items"
                      defaultValue={manualItemsText}
                      rows={6}
                      className={fieldClassName("resize-y font-mono leading-7")}
                    />
                  </label>
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
              label: "الإعدادات",
              content: (
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
              ),
            },
            {
              id: "pages",
              label: "يظهر في الصفحات",
              content: (
                <ModulePageAssignmentsField
                  pages={assignmentContext.pages}
                  assignedPageIds={assignedPageIds}
                />
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

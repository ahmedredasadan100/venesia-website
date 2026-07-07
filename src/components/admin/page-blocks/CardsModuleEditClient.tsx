"use client";

import AdminModuleTabs from "./AdminModuleTabs";
import BlockEditorContextHeader from "./BlockEditorContextHeader";
import ModuleCrossPageUsageBanner from "./ModuleCrossPageUsageBanner";
import ModuleDependencyHintsPanel from "./ModuleDependencyHintsPanel";
import ModulePageAssignmentsField from "./ModulePageAssignmentsField";
import AdminCardsItemsField from "./editors/AdminCardsItemsField";
import { fieldClassName } from "../../../lib/page-blocks/admin-utils";
import type { CardsBlockConfig } from "../../../lib/page-blocks/configs";
import type { ModuleAssignmentContext } from "../../../lib/page-blocks/module-assignments-query";
import { getSlotCompatibilityLabel } from "../../../lib/page-composition/slot-module-registry";

type CardsModuleEditClientProps = {
  block: {
    id: number;
    name: string;
    slug: string;
    variant: string;
    style_preset: string | null;
    status: string;
  };
  config: CardsBlockConfig;
  assignmentContext: ModuleAssignmentContext;
  saved?: boolean;
  updateAction: (formData: FormData) => void | Promise<void>;
};

export default function CardsModuleEditClient({
  block,
  config,
  assignmentContext,
  saved,
  updateAction,
}: CardsModuleEditClientProps) {
  const assignedPageIds = assignmentContext.assignments.map((row) => row.page_id);

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      <BlockEditorContextHeader
        backHref="/admin/pages-blocks/blocks/cards"
        backLabel="الرجوع لبلوكات الكروت"
        eyebrow="CARDS MODULE"
        title={block.name}
        description="شبكة بطاقات بعنوان ووصف وعناصر — مناسبة للفتحة الرئيسية أو السفلية."
        status={block.status}
        saved={saved}
        slotContext={getSlotCompatibilityLabel("cards")}
      />

      <ModuleCrossPageUsageBanner moduleName={block.name} assignments={assignmentContext.assignments} />
      <ModuleDependencyHintsPanel moduleKind="cards" templateSlug={block.slug} />

      <form action={updateAction}>
        <input type="hidden" name="id" value={block.id} />
        <input type="hidden" name="variant" value={block.variant ?? "glass"} />
        <input type="hidden" name="style_preset" value={block.style_preset ?? "premium-dark"} />

        <AdminModuleTabs
          tabs={[
            {
              id: "content",
              label: "المحتوى",
              content: (
                <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">Eyebrow</span>
                    <input name="eyebrow" defaultValue={config.eyebrow ?? ""} className={fieldClassName()} />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">عنوان القسم</span>
                    <input name="title" defaultValue={config.title ?? ""} className={fieldClassName()} />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">الوصف</span>
                    <textarea
                      name="description"
                      defaultValue={config.description ?? ""}
                      rows={3}
                      className={fieldClassName("resize-y leading-7")}
                    />
                  </label>
                  <AdminCardsItemsField items={config.items ?? []} minItems={1} showIcon showHref />
                </section>
              ),
            },
            {
              id: "meta",
              label: "الإعدادات",
              content: (
                <section className="max-w-xl space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">الاسم</span>
                    <input name="name" defaultValue={block.name} required className={fieldClassName()} />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">Slug</span>
                    <input name="slug" defaultValue={block.slug} required dir="ltr" className={fieldClassName()} />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">الحالة</span>
                    <select name="status" defaultValue={block.status} className={fieldClassName()}>
                      <option value="draft">مسودة</option>
                      <option value="published">منشور</option>
                      <option value="unpublished">مخفي</option>
                      <option value="archived">أرشيف</option>
                    </select>
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">Columns</span>
                    <select name="columns" defaultValue={String(config.columns ?? 3)} className={fieldClassName()}>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                    </select>
                  </label>
                </section>
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
          <button type="submit" className="rounded-2xl bg-[#D8B87A] px-6 py-3 text-sm font-bold text-[#06101C]">
            حفظ الموديول
          </button>
        </div>
      </form>
    </div>
  );
}

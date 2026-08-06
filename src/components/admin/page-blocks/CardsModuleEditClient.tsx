"use client";

import { AdminFormListboxSelect } from "../ui";
import ModuleDependencyHintsPanel from "./ModuleDependencyHintsPanel";
import {
  MODULE_EDITOR_STATUS_OPTIONS,
  ModuleEditorFeedback,
  ModuleEditorHeader,
  ModuleEditorPagesTab,
  ModuleEditorSaveArea,
  ModuleEditorSection,
  ModuleEditorSettingsComposition,
  ModuleEditorTabs,
  ModuleEditorTechnicalIdentity,
} from "./ModuleEditorPresentation";
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
  return (
    <div className="space-y-6 pb-10" dir="rtl">
      <ModuleEditorHeader
        moduleKind="cards"
        entityName={block.name}
        backHref="/admin/pages-blocks/blocks/cards"
        backLabel="الرجوع لبلوكات الكروت"
        status={block.status}
        saved={saved}
        slotContext={getSlotCompatibilityLabel("cards")}
      />

      <form action={updateAction}>
        <input type="hidden" name="id" value={block.id} />
        <input type="hidden" name="variant" value={block.variant ?? "glass"} />
        <input type="hidden" name="style_preset" value={block.style_preset ?? "premium-dark"} />

        <ModuleEditorTabs
          moduleKind="cards"
          activePanelContext={<ModuleEditorFeedback backHref="/admin/pages-blocks/blocks/cards" saved={saved} />}
          tabs={[
            {
              id: "content",
              content: (
                <ModuleEditorSection>
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
                </ModuleEditorSection>
              ),
            },
            {
              id: "meta",
              content: (
                <ModuleEditorSettingsComposition
                  context={<ModuleDependencyHintsPanel moduleKind="cards" templateSlug={block.slug} />}
                  primary={
                  <ModuleEditorSection className="max-w-xl">
                    <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">الاسم</span>
                    <input name="name" defaultValue={block.name} required className={fieldClassName()} />
                  </label>
                  <ModuleEditorTechnicalIdentity
                    mode="editable"
                    value={block.slug}
                    inputClassName={fieldClassName()}
                  />
                  <AdminFormListboxSelect
                    name="status"
                    label="الحالة"
                    defaultValue={block.status}
                    options={MODULE_EDITOR_STATUS_OPTIONS}
                  />
                  <AdminFormListboxSelect
                    name="columns"
                    label="Columns"
                    defaultValue={String(config.columns ?? 3)}
                    options={[
                      { value: "2", label: "2" },
                      { value: "3", label: "3" },
                      { value: "4", label: "4" },
                    ]}
                  />
                  </ModuleEditorSection>
                  }
                />
              ),
            },
            {
              id: "pages",
              content: <ModuleEditorPagesTab moduleName={block.name} assignmentContext={assignmentContext} />,
            },
          ]}
        />

        <ModuleEditorSaveArea />
      </form>
    </div>
  );
}

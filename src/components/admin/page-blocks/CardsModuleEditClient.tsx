"use client";

import { AdminFormListboxSelect } from "../ui";
import {
  ModuleEditorFeedback,
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorHeader,
  ModuleEditorPagesTab,
  ModuleEditorSaveArea,
  ModuleEditorSection,
  ModuleEditorSettingsComposition,
  ModuleEditorStatusSwitch,
  ModuleEditorTabs,
  ModuleEditorTechnicalIdentity,
} from "./ModuleEditorPresentation";
import AdminCardsItemsField from "./editors/AdminCardsItemsField";
import { fieldClassName } from "../../../lib/page-blocks/admin-utils";
import type { CardsBlockConfig } from "../../../lib/page-blocks/configs";
import type { ModuleAssignmentContext } from "../../../lib/page-blocks/module-assignments-query";
import { MODULE_EDITOR_TERMINOLOGY } from "../../../lib/page-blocks/module-editor-presentation-contract";

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
                  <ModuleEditorFieldGrid>
                    <ModuleEditorField nature="short-text" span={3}>
                      <label className="block space-y-2">
                        <span className="text-xs font-semibold text-white/55">{MODULE_EDITOR_TERMINOLOGY.eyebrow.labelAr}</span>
                        <input name="eyebrow" defaultValue={config.eyebrow ?? ""} className={fieldClassName()} />
                      </label>
                    </ModuleEditorField>
                    <ModuleEditorField nature="short-text" span={4}>
                      <label className="block space-y-2">
                        <span className="text-xs font-semibold text-white/55">{MODULE_EDITOR_TERMINOLOGY.sectionTitle.labelAr}</span>
                        <input name="title" defaultValue={config.title ?? ""} className={fieldClassName()} />
                      </label>
                    </ModuleEditorField>
                    <ModuleEditorField nature="short-description" span={5}>
                      <label className="block space-y-2">
                        <span className="text-xs font-semibold text-white/55">{MODULE_EDITOR_TERMINOLOGY.shortDescription.labelAr}</span>
                        <textarea
                          name="description"
                          defaultValue={config.description ?? ""}
                          rows={2}
                          className={fieldClassName("resize-y leading-7")}
                        />
                      </label>
                    </ModuleEditorField>
                  </ModuleEditorFieldGrid>
                  <AdminCardsItemsField items={config.items ?? []} minItems={1} showIcon showHref />
                </ModuleEditorSection>
              ),
            },
            {
              id: "meta",
              content: (
                <ModuleEditorSettingsComposition
                  primary={
                  <ModuleEditorSection>
                    <ModuleEditorFieldGrid>
                      <ModuleEditorField nature="standard" span={4}>
                        <label className="block space-y-2">
                          <span className="text-xs font-semibold text-white/55">الاسم</span>
                          <input name="name" defaultValue={block.name} required className={fieldClassName()} />
                        </label>
                      </ModuleEditorField>
                      <ModuleEditorField nature="technical" span={4}>
                        <ModuleEditorTechnicalIdentity mode="editable" value={block.slug} inputClassName={fieldClassName()} />
                      </ModuleEditorField>
                      <ModuleEditorField nature="binary-state" span={4}>
                        <ModuleEditorStatusSwitch status={block.status} />
                      </ModuleEditorField>
                      <ModuleEditorField nature="standard" span={4}>
                        <AdminFormListboxSelect
                          name="columns"
                          label="عدد الأعمدة"
                          defaultValue={String(config.columns ?? 3)}
                          options={[
                            { value: "2", label: "2" },
                            { value: "3", label: "3" },
                            { value: "4", label: "4" },
                          ]}
                        />
                      </ModuleEditorField>
                    </ModuleEditorFieldGrid>
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

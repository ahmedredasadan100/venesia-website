"use client";

import { AdminFormListboxSelect } from "../ui";
import {
  ModuleEditorFeedback,
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorHeader,
  ModuleEditorIdentitySection,
  ModuleEditorPagesTab,
  ModuleEditorSaveArea,
  ModuleEditorSection,
  ModuleEditorTabs,
  ModuleEditorVisibilityAlignRow,
} from "./ModuleEditorPresentation";
import AdminCardsItemsField from "./editors/AdminCardsItemsField";
import { fieldClassName } from "../../../lib/page-blocks/admin-utils";
import {
  resolvePageBlockTextFormat,
  type CardsBlockConfig,
} from "../../../lib/page-blocks/configs";
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
  const eyebrowFormat = resolvePageBlockTextFormat(config, "eyebrow");
  const titleFormat = resolvePageBlockTextFormat(config, "title", { bold: true });
  const descriptionFormat = resolvePageBlockTextFormat(config, "description");

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
        <input type="hidden" name="slug" value={block.slug} />
        <input type="hidden" name="variant" value={block.variant ?? "glass"} />
        <input type="hidden" name="style_preset" value={block.style_preset ?? "premium-dark"} />

        <ModuleEditorIdentitySection
          name={block.name}
          status={block.status}
          inputClassName={fieldClassName("h-11")}
        >
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
        </ModuleEditorIdentitySection>

        <ModuleEditorTabs
          moduleKind="cards"
          activePanelContext={<ModuleEditorFeedback backHref="/admin/pages-blocks/blocks/cards" saved={saved} />}
          tabs={[
            {
              id: "content",
              content: (
                <ModuleEditorSection>
                  <ModuleEditorFieldGrid>
                    <ModuleEditorField nature="short-text" span={6}>
                      <ModuleEditorVisibilityAlignRow
                        label={MODULE_EDITOR_TERMINOLOGY.eyebrow.labelAr}
                        showName="show_eyebrow"
                        boldName="eyebrow_bold"
                        alignmentName="eyebrow_alignment"
                        showDefault={eyebrowFormat.visible}
                        boldDefault={eyebrowFormat.bold}
                        alignmentDefault={eyebrowFormat.alignment}
                      >
                        <input name="eyebrow" defaultValue={config.eyebrow ?? ""} className={fieldClassName()} />
                      </ModuleEditorVisibilityAlignRow>
                    </ModuleEditorField>
                    <ModuleEditorField nature="short-text" span={6}>
                      <ModuleEditorVisibilityAlignRow
                        label={MODULE_EDITOR_TERMINOLOGY.sectionTitle.labelAr}
                        showName="show_title"
                        boldName="title_bold"
                        alignmentName="title_alignment"
                        showDefault={titleFormat.visible}
                        boldDefault={titleFormat.bold}
                        alignmentDefault={titleFormat.alignment}
                      >
                        <input name="title" defaultValue={config.title ?? ""} className={fieldClassName()} />
                      </ModuleEditorVisibilityAlignRow>
                    </ModuleEditorField>
                    <ModuleEditorField nature="long-content" span={12}>
                      <ModuleEditorVisibilityAlignRow
                        label={MODULE_EDITOR_TERMINOLOGY.shortDescription.labelAr}
                        showName="show_description"
                        boldName="description_bold"
                        alignmentName="description_alignment"
                        showDefault={descriptionFormat.visible}
                        boldDefault={descriptionFormat.bold}
                        alignmentDefault={descriptionFormat.alignment}
                      >
                        <textarea
                          name="description"
                          defaultValue={config.description ?? ""}
                          rows={2}
                          className={fieldClassName("h-[72px] resize-none overflow-hidden leading-6")}
                        />
                      </ModuleEditorVisibilityAlignRow>
                    </ModuleEditorField>
                  </ModuleEditorFieldGrid>
                  <AdminCardsItemsField items={config.items ?? []} minItems={1} showIcon showHref />
                </ModuleEditorSection>
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

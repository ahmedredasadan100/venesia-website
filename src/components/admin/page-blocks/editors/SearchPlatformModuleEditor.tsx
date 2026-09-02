import {
  CONTENT_TYPES,
  getContentTypeLabel,
} from "../../../../lib/admin/content/content-types";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import {
  SEARCH_PLATFORM_FILTERS,
  SEARCH_PLATFORM_PRESENTATIONS,
  SEARCH_PLATFORM_RESULT_LIMITS,
  SEARCH_PLATFORM_SCOPES,
  type SearchPlatformConfig,
  type SearchPlatformFilter,
  type SearchPlatformPresentation,
} from "../../../../lib/page-blocks/search-platform-config";
import { AdminCheckbox, AdminFormListboxSelect } from "../../ui";
import {
  MODULE_EDITOR_CONTROL_CARD_CLASS_NAME,
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorSection,
  ModuleEditorSectionHeading,
  ModuleEditorVisibilityAlignRow,
} from "../ModuleEditorPresentation";

const PRESENTATION_LABELS: Record<SearchPlatformPresentation, string> = {
  compact: "حقل بحث مدمج",
  "full-list": "صفحة نتائج — قائمة",
  "full-grid": "صفحة نتائج — شبكة",
};

const FILTER_LABELS: Record<SearchPlatformFilter, string> = {
  "content-type": "نوع المحتوى",
  category: "التصنيف",
  series: "السلسلة",
};

function TextField({
  label,
  name,
  defaultValue,
  surface = true,
  hideLabel = false,
}: {
  label: string;
  name: string;
  defaultValue: string;
  surface?: boolean;
  hideLabel?: boolean;
}) {
  return (
    <label
      className={`${surface ? MODULE_EDITOR_CONTROL_CARD_CLASS_NAME : ""} block h-full space-y-2`.trim()}
    >
      <span
        className={
          hideLabel ? "sr-only" : "block text-sm font-medium text-white/70"
        }
      >
        {label}
      </span>
      <input
        name={name}
        defaultValue={defaultValue}
        required
        className={fieldClassName("h-11")}
      />
    </label>
  );
}

export default function SearchPlatformModuleEditor({
  config,
}: {
  config: SearchPlatformConfig;
}) {
  return (
    <div className="space-y-5">
      <ModuleEditorSection>
        <ModuleEditorSectionHeading intent="domain">
          محتوى واجهة البحث
        </ModuleEditorSectionHeading>
        <div data-search-interface-display-formatting="">
          <ModuleEditorFieldGrid className="mt-4">
            <ModuleEditorField nature="short-text" span={4}>
              <ModuleEditorVisibilityAlignRow
                label="العنوان"
                showName="show_search_title"
                boldName="search_title_bold"
                alignmentName="search_title_alignment"
                showDefault={config.interfaceDisplay.title.visible}
                boldDefault={config.interfaceDisplay.title.bold}
                alignmentDefault={config.interfaceDisplay.title.alignment}
                className="h-full"
              >
                <TextField
                  label="نص العنوان"
                  name="title"
                  defaultValue={config.title}
                  surface={false}
                  hideLabel
                />
              </ModuleEditorVisibilityAlignRow>
            </ModuleEditorField>
            <ModuleEditorField nature="short-text" span={4}>
              <ModuleEditorVisibilityAlignRow
                label="الوصف"
                showName="show_search_description"
                boldName="search_description_bold"
                alignmentName="search_description_alignment"
                showDefault={config.interfaceDisplay.description.visible}
                boldDefault={config.interfaceDisplay.description.bold}
                alignmentDefault={config.interfaceDisplay.description.alignment}
                className="h-full"
              >
                <TextField
                  label="نص الوصف"
                  name="description"
                  defaultValue={config.description}
                  surface={false}
                  hideLabel
                />
              </ModuleEditorVisibilityAlignRow>
            </ModuleEditorField>
            <ModuleEditorField nature="short-text" span={4}>
              <ModuleEditorVisibilityAlignRow
                label="النص المساعد"
                showName="show_search_help_text"
                boldName="search_help_text_bold"
                alignmentName="search_help_text_alignment"
                showDefault={config.interfaceDisplay.helpText.visible}
                boldDefault={config.interfaceDisplay.helpText.bold}
                alignmentDefault={config.interfaceDisplay.helpText.alignment}
                className="h-full"
              >
                <TextField
                  label="نص المساعدة"
                  name="help_text"
                  defaultValue={config.helpText}
                  surface={false}
                  hideLabel
                />
              </ModuleEditorVisibilityAlignRow>
            </ModuleEditorField>
            <ModuleEditorField nature="short-text" span={4}>
              <TextField
                label="النص داخل حقل البحث"
                name="placeholder"
                defaultValue={config.placeholder}
              />
            </ModuleEditorField>
            <ModuleEditorField nature="standard" span={4}>
              <ModuleEditorVisibilityAlignRow
                label="أيقونة البحث"
                showName="show_search_action"
                controlMode="visibility-only"
                showDefault={config.interfaceDisplay.searchAction.visible}
                className="h-full"
              />
            </ModuleEditorField>
            <ModuleEditorField nature="standard" span={4}>
              <ModuleEditorVisibilityAlignRow
                label="عنوان النتائج"
                showName="show_search_results_title"
                boldName="search_results_title_bold"
                alignmentName="search_results_title_alignment"
                showDefault={config.interfaceDisplay.resultsTitle.visible}
                boldDefault={config.interfaceDisplay.resultsTitle.bold}
                alignmentDefault={config.interfaceDisplay.resultsTitle.alignment}
                className="h-full"
              >
                <p className="text-xs leading-5 text-white/40">
                  يعرض عدد النتائج وكلمة البحث الحالية تلقائيًا.
                </p>
              </ModuleEditorVisibilityAlignRow>
            </ModuleEditorField>
            <ModuleEditorField nature="short-text" span={4}>
              <TextField
                label="عنوان حالة عدم وجود نتائج"
                name="empty_results_title"
                defaultValue={config.interfaceDisplay.emptyResults.title}
              />
            </ModuleEditorField>
            <ModuleEditorField nature="short-text" span={4}>
              <TextField
                label="وصف حالة عدم وجود نتائج"
                name="empty_results_description"
                defaultValue={config.interfaceDisplay.emptyResults.description}
              />
            </ModuleEditorField>
          </ModuleEditorFieldGrid>
        </div>
      </ModuleEditorSection>

      <ModuleEditorSection>
        <ModuleEditorSectionHeading intent="settings">
          النطاق والعرض
        </ModuleEditorSectionHeading>
        <ModuleEditorFieldGrid className="mt-4">
          <ModuleEditorField nature="standard" span={3}>
            <div className={`${MODULE_EDITOR_CONTROL_CARD_CLASS_NAME} h-full`}>
              <AdminFormListboxSelect
                name="search_scope"
                label="نطاق البحث"
                defaultValue={config.scope}
                options={SEARCH_PLATFORM_SCOPES.map((scope) => ({
                  value: scope,
                  label: scope === "all" ? "كل المحتوى العام" : "أنواع محددة",
                }))}
                sizing="full"
              />
            </div>
          </ModuleEditorField>
          <ModuleEditorField nature="standard" span={3}>
            <div className={`${MODULE_EDITOR_CONTROL_CARD_CLASS_NAME} h-full`}>
              <AdminFormListboxSelect
                name="result_limit"
                label="عدد النتائج في الصفحة"
                defaultValue={String(config.resultLimit)}
                options={SEARCH_PLATFORM_RESULT_LIMITS.map((limit) => ({
                  value: String(limit),
                  label: String(limit),
                }))}
                sizing="full"
              />
            </div>
          </ModuleEditorField>
          <ModuleEditorField nature="standard" span={3}>
            <div className={`${MODULE_EDITOR_CONTROL_CARD_CLASS_NAME} h-full`}>
              <AdminFormListboxSelect
                name="search_presentation"
                label="طريقة العرض"
                defaultValue={config.presentation}
                options={SEARCH_PLATFORM_PRESENTATIONS.map((presentation) => ({
                  value: presentation,
                  label: PRESENTATION_LABELS[presentation],
                }))}
                sizing="full"
              />
            </div>
          </ModuleEditorField>
          <ModuleEditorField nature="standard" span={3}>
            <div className={`${MODULE_EDITOR_CONTROL_CARD_CLASS_NAME} h-full`}>
              <AdminFormListboxSelect
                name="default_sort"
                label="الترتيب الافتراضي"
                defaultValue={config.defaultSort}
                options={[
                  { value: "newest", label: "الأحدث" },
                  { value: "oldest", label: "الأقدم" },
                ]}
                sizing="full"
              />
            </div>
          </ModuleEditorField>
        </ModuleEditorFieldGrid>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <fieldset className="min-w-0">
            <legend className="sr-only">أنواع المحتوى</legend>
            <div
              data-search-platform-option-group="content-types"
              className={`${MODULE_EDITOR_CONTROL_CARD_CLASS_NAME} h-full space-y-3`}
            >
              <div className="text-sm font-semibold text-white">أنواع المحتوى</div>
              <p className="text-xs leading-5 text-white/40">
                تُستخدم عند اختيار نطاق «أنواع محددة» وتظل داخل المحتوى الموحّد فقط.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {CONTENT_TYPES.map((contentType) => (
                  <label key={contentType} className="flex items-center gap-3 text-sm text-white/65">
                    <AdminCheckbox
                      name="content_types"
                      value={contentType}
                      defaultChecked={config.contentTypes.includes(contentType)}
                      label={getContentTypeLabel(contentType)}
                    />
                    <span>{getContentTypeLabel(contentType)}</span>
                  </label>
                ))}
              </div>
            </div>
          </fieldset>

          <fieldset className="min-w-0">
            <legend className="sr-only">الفلاتر المتاحة</legend>
            <div
              data-search-platform-option-group="filters"
              className={`${MODULE_EDITOR_CONTROL_CARD_CLASS_NAME} h-full space-y-3`}
            >
              <div className="text-sm font-semibold text-white">الفلاتر المتاحة</div>
              <p className="text-xs leading-5 text-white/40">
                تُعرض الفلاتر المختارة داخل صفحة النتائج فقط.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {SEARCH_PLATFORM_FILTERS.map((filter) => (
                  <label key={filter} className="flex items-center gap-3 text-sm text-white/65">
                    <AdminCheckbox
                      name="search_filters"
                      value={filter}
                      defaultChecked={config.filters.includes(filter)}
                      label={FILTER_LABELS[filter]}
                    />
                    <span>{FILTER_LABELS[filter]}</span>
                  </label>
                ))}
              </div>
            </div>
          </fieldset>
        </div>
      </ModuleEditorSection>
    </div>
  );
}

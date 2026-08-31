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
  multiline = false,
}: {
  label: string;
  name: string;
  defaultValue: string;
  multiline?: boolean;
}) {
  return (
    <label className={`${MODULE_EDITOR_CONTROL_CARD_CLASS_NAME} block h-full space-y-2`}>
      <span className="block text-sm font-medium text-white/70">{label}</span>
      {multiline ? (
        <textarea
          name={name}
          defaultValue={defaultValue}
          rows={4}
          required
          className={fieldClassName("min-h-28 resize-y")}
        />
      ) : (
        <input
          name={name}
          defaultValue={defaultValue}
          required
          className={fieldClassName("h-11")}
        />
      )}
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
        <ModuleEditorFieldGrid className="mt-4">
          <ModuleEditorField nature="short-text" span={6}>
            <TextField label="العنوان" name="title" defaultValue={config.title} />
          </ModuleEditorField>
          <ModuleEditorField nature="short-description" span={6}>
            <TextField label="الوصف" name="description" defaultValue={config.description} multiline />
          </ModuleEditorField>
          <ModuleEditorField nature="short-text" span={6}>
            <TextField label="Placeholder" name="placeholder" defaultValue={config.placeholder} />
          </ModuleEditorField>
          <ModuleEditorField nature="short-description" span={6}>
            <TextField label="Help Text" name="help_text" defaultValue={config.helpText} multiline />
          </ModuleEditorField>
        </ModuleEditorFieldGrid>
      </ModuleEditorSection>

      <ModuleEditorSection>
        <ModuleEditorSectionHeading intent="settings">
          النطاق والعرض
        </ModuleEditorSectionHeading>
        <ModuleEditorFieldGrid className="mt-4">
          <ModuleEditorField nature="standard" span={4}>
            <div className={`${MODULE_EDITOR_CONTROL_CARD_CLASS_NAME} h-full`}>
              <AdminFormListboxSelect
                name="search_scope"
                label="Search Scope"
                defaultValue={config.scope}
                options={SEARCH_PLATFORM_SCOPES.map((scope) => ({
                  value: scope,
                  label: scope === "all" ? "كل المحتوى العام" : "أنواع محددة",
                }))}
                sizing="full"
              />
            </div>
          </ModuleEditorField>
          <ModuleEditorField nature="standard" span={4}>
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
          <ModuleEditorField nature="standard" span={4}>
            <div className={`${MODULE_EDITOR_CONTROL_CARD_CLASS_NAME} h-full`}>
              <AdminFormListboxSelect
                name="search_presentation"
                label="Presentation"
                defaultValue={config.presentation}
                options={SEARCH_PLATFORM_PRESENTATIONS.map((presentation) => ({
                  value: presentation,
                  label: PRESENTATION_LABELS[presentation],
                }))}
                sizing="full"
              />
            </div>
          </ModuleEditorField>
          <ModuleEditorField nature="standard" span={4}>
            <div className={`${MODULE_EDITOR_CONTROL_CARD_CLASS_NAME} h-full`}>
              <AdminFormListboxSelect
                name="default_sort"
                label="Default Sort"
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
          <fieldset className={`${MODULE_EDITOR_CONTROL_CARD_CLASS_NAME} space-y-3`}>
            <legend className="text-sm font-semibold text-white">Content Types</legend>
            <p className="text-xs leading-5 text-white/40">
              تُستخدم عند اختيار نطاق «أنواع محددة» وتظل داخل Unified Content فقط.
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
          </fieldset>

          <fieldset className={`${MODULE_EDITOR_CONTROL_CARD_CLASS_NAME} space-y-3`}>
            <legend className="text-sm font-semibold text-white">الفلاتر المتاحة</legend>
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
          </fieldset>
        </div>
      </ModuleEditorSection>
    </div>
  );
}

import {
  CONTENT_TYPES,
  getContentTypeLabel,
} from "../../../../lib/admin/content/content-types";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import { ADMIN_FORM } from "../../../../lib/admin/admin-ui-styles";
import {
  SEARCH_PLATFORM_FILTERS,
  SEARCH_PLATFORM_PRESENTATIONS,
  SEARCH_PLATFORM_RESULT_LIMITS,
  SEARCH_PLATFORM_SCOPES,
  type SearchPlatformConfig,
  type SearchPlatformFilter,
  type SearchPlatformPresentation,
} from "../../../../lib/page-blocks/search-platform-config";
import {
  AdminCard,
  AdminCheckbox,
  AdminFormControlHeader,
  AdminFormGrid,
  AdminFormListboxSelect,
} from "../../ui";
import { AdminModuleTabIcon } from "../../ui/AdminModuleTabs";
import {
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
  description,
  surface = true,
  hideLabel = false,
}: {
  label: string;
  name: string;
  defaultValue: string;
  description?: string;
  surface?: boolean;
  hideLabel?: boolean;
}) {
  const field = (
    <label className="flex h-full min-w-0 flex-col gap-3">
      {hideLabel ? (
        <span className="sr-only">{label}</span>
      ) : (
        <AdminFormControlHeader
          title={label}
          description={description ? <span id={`${name}-description`} aria-hidden="true">{description}</span> : undefined}
          icon={<AdminModuleTabIcon name="content" />}
          presentation="leading-icon"
        />
      )}
      <input
        name={name}
        defaultValue={defaultValue}
        aria-describedby={description && !hideLabel ? `${name}-description` : undefined}
        required
        className={fieldClassName("h-11 mt-auto")}
      />
    </label>
  );

  return surface ? (
    <AdminCard presentation="premium" className="h-full p-3">
      {field}
    </AdminCard>
  ) : field;
}

export default function SearchPlatformModuleEditor({
  config,
  section = "all",
}: {
  config: SearchPlatformConfig;
  section?: "all" | "text" | "search" | "presentation";
}) {
  return (
    <div className="space-y-5">
      {section === "all" || section === "text" ? (
        <div className="space-y-4" data-search-interface-display-formatting="">
          {section === "all" ? (
            <ModuleEditorSectionHeading intent="domain">
              محتوى واجهة البحث
            </ModuleEditorSectionHeading>
          ) : null}
          <AdminFormGrid columns={3}>
            <ModuleEditorVisibilityAlignRow
              label="العنوان"
              description="العنوان الرئيسي الذي يعرّف واجهة البحث."
              icon={<AdminModuleTabIcon name="content" />}
              presentation="premium"
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
            <ModuleEditorVisibilityAlignRow
              label="الوصف"
              description="وصف موجز يظهر أسفل عنوان البحث."
              icon={<AdminModuleTabIcon name="content" />}
              presentation="premium"
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
            <ModuleEditorVisibilityAlignRow
              label="النص المساعد"
              description="إرشاد مختصر يساعد الزائر على استخدام البحث."
              icon={<AdminModuleTabIcon name="content" />}
              presentation="premium"
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
            <TextField
              label="النص داخل حقل البحث"
              description="النص الظاهر داخل حقل البحث قبل الكتابة."
              name="placeholder"
              defaultValue={config.placeholder}
            />
            <ModuleEditorVisibilityAlignRow
              label="أيقونة البحث"
              description="إظهار أيقونة تنفيذ البحث داخل الحقل."
              icon={<AdminModuleTabIcon name="seo" />}
              presentation="premium"
              showName="show_search_action"
              controlMode="visibility-only"
              showDefault={config.interfaceDisplay.searchAction.visible}
              className="h-full"
            />
            <ModuleEditorVisibilityAlignRow
              label="عنوان النتائج"
              description="يعرض عدد النتائج وكلمة البحث الحالية تلقائيًا."
              icon={<AdminModuleTabIcon name="overview" />}
              presentation="premium"
              showName="show_search_results_title"
              boldName="search_results_title_bold"
              alignmentName="search_results_title_alignment"
              showDefault={config.interfaceDisplay.resultsTitle.visible}
              boldDefault={config.interfaceDisplay.resultsTitle.bold}
              alignmentDefault={config.interfaceDisplay.resultsTitle.alignment}
              className="h-full"
            />
            <TextField
              label="عنوان حالة عدم وجود نتائج"
              description="عنوان يظهر عندما لا توجد نتائج مطابقة."
              name="empty_results_title"
              defaultValue={config.interfaceDisplay.emptyResults.title}
            />
            <TextField
              label="وصف حالة عدم وجود نتائج"
              description="رسالة تساعد الزائر على تعديل البحث."
              name="empty_results_description"
              defaultValue={config.interfaceDisplay.emptyResults.description}
            />
          </AdminFormGrid>
        </div>
      ) : null}

      {section === "all" || section === "search" ? (
        <div className="space-y-4">
          {section === "all" ? (
            <ModuleEditorSectionHeading intent="settings">
              إعدادات البحث
            </ModuleEditorSectionHeading>
          ) : null}
          <AdminFormGrid columns={1}>
            <AdminCard presentation="premium" className="h-full p-3">
              <AdminFormListboxSelect
                name="search_scope"
                label={
                  <AdminFormControlHeader
                    title="نطاق البحث"
                    description="البحث في كل المحتوى العام أو في أنواع محددة."
                    icon={<AdminModuleTabIcon name="seo" />}
                    presentation="leading-icon"
                  />
                }
                defaultValue={config.scope}
                options={SEARCH_PLATFORM_SCOPES.map((scope) => ({
                  value: scope,
                  label: scope === "all" ? "كل المحتوى العام" : "أنواع محددة",
                }))}
                sizing="full"
              />
            </AdminCard>
          </AdminFormGrid>
          <AdminFormGrid columns={2}>
            <fieldset className="min-w-0" aria-describedby="search-content-types-description">
              <legend className="sr-only">أنواع المحتوى</legend>
              <AdminCard presentation="premium" className="h-full p-3">
                <div data-search-platform-option-group="content-types" className="space-y-3">
                  <AdminFormControlHeader
                    title="أنواع المحتوى"
                    description={<span id="search-content-types-description">تُستخدم عند اختيار نطاق «أنواع محددة» وتظل داخل المحتوى الموحّد فقط.</span>}
                    icon={<AdminModuleTabIcon name="content" />}
                    presentation="leading-icon"
                  />
                  <AdminFormGrid columns={3}>
                    {CONTENT_TYPES.map((contentType) => (
                      <label key={contentType} className={ADMIN_FORM.checkboxRow}>
                        <AdminCheckbox
                          name="content_types"
                          value={contentType}
                          defaultChecked={config.contentTypes.includes(contentType)}
                          label={getContentTypeLabel(contentType)}
                        />
                        <span className="min-w-0 flex-1">{getContentTypeLabel(contentType)}</span>
                      </label>
                    ))}
                  </AdminFormGrid>
                </div>
              </AdminCard>
            </fieldset>
            <fieldset className="min-w-0" aria-describedby="search-filters-description">
              <legend className="sr-only">الفلاتر المتاحة</legend>
              <AdminCard presentation="premium" className="h-full p-3">
                <div data-search-platform-option-group="filters" className="space-y-3">
                  <AdminFormControlHeader
                    title="الفلاتر المتاحة"
                    description={<span id="search-filters-description">تُعرض الفلاتر المختارة داخل صفحة النتائج فقط.</span>}
                    icon={<AdminModuleTabIcon name="settings" />}
                    presentation="leading-icon"
                  />
                  <AdminFormGrid columns={3}>
                    {SEARCH_PLATFORM_FILTERS.map((filter) => (
                      <label key={filter} className={ADMIN_FORM.checkboxRow}>
                        <AdminCheckbox
                          name="search_filters"
                          value={filter}
                          defaultChecked={config.filters.includes(filter)}
                          label={FILTER_LABELS[filter]}
                        />
                        <span className="min-w-0 flex-1">{FILTER_LABELS[filter]}</span>
                      </label>
                    ))}
                  </AdminFormGrid>
                </div>
              </AdminCard>
            </fieldset>
          </AdminFormGrid>
        </div>
      ) : null}

      {section === "all" || section === "presentation" ? (
        <div className="space-y-4">
          {section === "all" ? (
            <ModuleEditorSectionHeading intent="settings">
              إعدادات العرض
            </ModuleEditorSectionHeading>
          ) : null}
          <AdminFormGrid columns={3}>
            <AdminCard presentation="premium" className="h-full p-3">
              <AdminFormListboxSelect
                name="result_limit"
                label={
                  <AdminFormControlHeader
                    title="عدد النتائج في الصفحة"
                    description="عدد العناصر المعروضة في صفحة النتائج."
                    icon={<AdminModuleTabIcon name="specifications" />}
                    presentation="leading-icon"
                  />
                }
                className="flex h-full flex-col justify-between"
                defaultValue={String(config.resultLimit)}
                options={SEARCH_PLATFORM_RESULT_LIMITS.map((limit) => ({
                  value: String(limit),
                  label: String(limit),
                }))}
                sizing="full"
              />
            </AdminCard>
            <AdminCard presentation="premium" className="h-full p-3">
              <AdminFormListboxSelect
                name="search_presentation"
                label={
                  <AdminFormControlHeader
                    title="طريقة العرض"
                    description="اختيار الحقل المدمج أو عرض النتائج بقائمة أو شبكة."
                    icon={<AdminModuleTabIcon name="overview" />}
                    presentation="leading-icon"
                  />
                }
                className="flex h-full flex-col justify-between"
                defaultValue={config.presentation}
                options={SEARCH_PLATFORM_PRESENTATIONS.map((presentation) => ({
                  value: presentation,
                  label: PRESENTATION_LABELS[presentation],
                }))}
                sizing="full"
              />
            </AdminCard>
            <AdminCard presentation="premium" className="h-full p-3">
              <AdminFormListboxSelect
                name="default_sort"
                label={
                  <AdminFormControlHeader
                    title="الترتيب الافتراضي"
                    description="ترتيب النتائج عند بدء البحث."
                    icon={<AdminModuleTabIcon name="settings" />}
                    presentation="leading-icon"
                  />
                }
                className="flex h-full flex-col justify-between"
                defaultValue={config.defaultSort}
                options={[
                  { value: "newest", label: "الأحدث" },
                  { value: "oldest", label: "الأقدم" },
                ]}
                sizing="full"
              />
            </AdminCard>
          </AdminFormGrid>
        </div>
      ) : null}
    </div>
  );
}

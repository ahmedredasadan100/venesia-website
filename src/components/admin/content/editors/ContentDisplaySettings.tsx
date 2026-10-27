import type { ComponentProps, ReactNode } from "react";

import { AdminFormGrid, AdminFormGridItem } from "../../ui/AdminFormRuntime";
import AdminCard from "../../ui/AdminCard";
import { AdminModuleSectionHeader, AdminModuleTabIcon } from "../../ui/AdminModuleTabs";
import { ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME } from "../../../../lib/admin/admin-ui-styles";

import TopicFormSwitch from "./article/TopicFormSwitch";

export default function ContentDisplaySettings({
  showTitle = true,
  showImage = true,
  showExcerpt = true,
  showDate = true,
  showCategory = true,
  showSeries = true,
  showIntroCard = true,
  includeIntroCard = true,
  columns,
  introCardSpan = 2,
  embedded = false,
  presentation = "default",
  sectionHeading,
  children,
}: {
  showTitle?: boolean | null;
  showImage?: boolean | null;
  showExcerpt?: boolean | null;
  showDate?: boolean | null;
  showCategory?: boolean | null;
  showSeries?: boolean | null;
  showIntroCard?: boolean | null;
  includeIntroCard?: boolean;
  /** Opt into the shared responsive grid without changing existing editor layouts. */
  columns?: ComponentProps<typeof AdminFormGrid>["columns"];
  /** Natural single-cell flow is opt-in; existing premium-inline controls retain their span. */
  introCardSpan?: 1 | 2;
  embedded?: boolean;
  presentation?: ComponentProps<typeof TopicFormSwitch>["presentation"];
  /** Optional section composition; omitted consumers retain their existing controls-only surface. */
  sectionHeading?: ReactNode;
  children?: ReactNode;
}) {
  const introControl = (
    <TopicFormSwitch name="show_intro_card_on_page" label="إظهار بطاقة مقدمة الموضوع" icon={presentation === "premium-inline" ? <AdminModuleTabIcon name="overview" /> : undefined} defaultChecked={showIntroCard !== false} surface presentation={presentation} embedded={embedded} embeddedLayout={embedded ? "inline" : undefined} />
  );
  const controls = (
    <>
      <TopicFormSwitch name="show_title_on_page" label="إظهار العنوان" icon={presentation === "premium-inline" ? <AdminModuleTabIcon name="content" /> : undefined} defaultChecked={showTitle !== false} surface presentation={presentation} embedded={embedded} embeddedLayout={embedded ? "inline" : undefined} />
      <TopicFormSwitch name="show_image_on_page" label="إظهار الصورة" icon={presentation === "premium-inline" ? <AdminModuleTabIcon name="media" /> : undefined} defaultChecked={showImage !== false} surface presentation={presentation} embedded={embedded} embeddedLayout={embedded ? "inline" : undefined} />
      <TopicFormSwitch name="show_category_on_page" label="إظهار التصنيف" icon={presentation === "premium-inline" ? <AdminModuleTabIcon name="section" /> : undefined} defaultChecked={showCategory !== false} surface presentation={presentation} embedded={embedded} embeddedLayout={embedded ? "inline" : undefined} />
      <TopicFormSwitch name="show_series_on_page" label="إظهار السلسلة" icon={presentation === "premium-inline" ? <AdminModuleTabIcon name="database" /> : undefined} defaultChecked={showSeries !== false} surface presentation={presentation} embedded={embedded} embeddedLayout={embedded ? "inline" : undefined} />
      <TopicFormSwitch name="show_excerpt_on_page" label="إظهار المقتطف" icon={presentation === "premium-inline" ? <AdminModuleTabIcon name="specifications" /> : undefined} defaultChecked={showExcerpt !== false} surface presentation={presentation} embedded={embedded} embeddedLayout={embedded ? "inline" : undefined} />
      <TopicFormSwitch name="show_date_on_page" label="إظهار التاريخ" icon={presentation === "premium-inline" ? <AdminModuleTabIcon name="publish" /> : undefined} defaultChecked={showDate !== false} surface presentation={presentation} embedded={embedded} embeddedLayout={embedded ? "inline" : undefined} />
      {includeIntroCard ? (
        presentation === "premium-inline" && introCardSpan === 2 ? (
          <AdminFormGridItem span={2}>{introControl}</AdminFormGridItem>
        ) : introControl
      ) : null}
      {children}
    </>
  );

  const displayControls = (
    <div
      id="content-display-settings"
      className={columns === undefined
        ? "grid scroll-mt-24 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        : "scroll-mt-24"}
      data-content-display-settings
    >
      {columns === undefined ? controls : (
        <AdminFormGrid columns={columns} density={presentation === "premium-inline" ? "compact" : undefined}>{controls}</AdminFormGrid>
      )}
    </div>
  );

  return sectionHeading ? (
    <AdminCard presentation="premium" className="min-w-0 p-3">
      <AdminModuleSectionHeader
        id="content-display-settings-heading"
        sectionHeading={sectionHeading}
        icon="settings"
        sectionHeaderPresentation="premium"
        sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
      />
      {displayControls}
    </AdminCard>
  ) : displayControls;
}

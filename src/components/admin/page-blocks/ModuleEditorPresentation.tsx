"use client";

import { useCallback, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { resolveAdminFormReturnPath } from "../../../lib/admin/form-runtime";

import type { ModuleAssignmentContext } from "../../../lib/page-blocks/module-assignments-query";
import {
  getModuleEditorHeaderMetadata,
  getModuleEditorSectionOrder,
  getModuleEditorSectionMetadata,
} from "../../../lib/page-composition/slot-module-registry";
import {
  AdminCard,
  ADMIN_FORM_STACK_CLASS_NAME,
  AdminActionButton,
  AdminFormControlHeader,
  AdminFormField,
  AdminFormGrid,
  AdminFormGridItem,
  AdminFormSection,
  AdminFormSwitch,
  AdminTextFormatControls,
  AdminPageContextHeader,
  AdminStickyFormBar,
  type AdminPageContextHeaderProps,
  type AdminModuleTab,
  type AdminModuleTabsProps,
} from "../ui";
import type { AdminTextAlignment } from "../ui/AdminTextFormatControls";
import AdminModuleTabs, { AdminModuleSectionHeader, AdminModuleTabIcon } from "../ui/AdminModuleTabs";
import { ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME } from "../../../lib/admin/admin-ui-styles";
import BlockEditorContextHeader, {
  BlockEditorSaveFeedback,
  type BlockEditorContextHeaderProps,
} from "./BlockEditorContextHeader";
import ModuleCrossPageUsageBanner from "./ModuleCrossPageUsageBanner";
import ModulePageAssignmentsField from "./ModulePageAssignmentsField";
import {
  getModuleEditorFieldSpan,
  MODULE_EDITOR_TERMINOLOGY,
  type ModuleEditorFieldNature,
  type ModuleEditorFieldSpan,
} from "../../../lib/page-blocks/module-editor-presentation-contract";
import {
  MODULE_EDITOR_RETURN_PAGE_FORM_FIELD,
  MODULE_EDITOR_RETURN_PAGE_QUERY_PARAM,
  MODULE_EDITOR_TAB_FORM_FIELD,
  parseModuleEditorReturnPageId,
  resolveModuleEditorReturnNavigation,
  resolveModuleEditorTabId,
} from "../../../lib/page-blocks/admin-utils";

type ModuleEditorMetadataScope = {
  moduleKind: string;
  moduleSlug?: string | null;
  entityName?: string | null;
};

type ModuleEditorHeaderProps = ModuleEditorMetadataScope &
  (
    | Omit<BlockEditorContextHeaderProps, "eyebrow" | "title" | "description">
    | Omit<AdminPageContextHeaderProps, "eyebrow" | "title" | "description">
  );

export function ModuleEditorHeader({
  moduleKind,
  moduleSlug,
  entityName,
  ...props
}: ModuleEditorHeaderProps) {
  const searchParams = useSearchParams();
  const metadata = getModuleEditorHeaderMetadata(
    moduleKind,
    moduleSlug,
    entityName,
  );
  if (!metadata) {
    throw new Error(
      `Missing Module Editor header metadata for ${moduleKind}:${moduleSlug ?? "default"}`,
    );
  }

  const presentation = {
    eyebrow: metadata.eyebrowAr,
    title: metadata.titleAr,
    description: metadata.descriptionAr,
    visualPreset: props.visualPreset ?? (
      moduleKind === "media-hub" || moduleKind === "media-sidebar" ? "media" :
      moduleKind === "breadcrumb" || moduleKind === "cta" ? "navigation" :
      moduleKind === "content" ? "content" : "blocks"
    ),
  } satisfies Pick<AdminPageContextHeaderProps, "eyebrow" | "title" | "description" | "visualPreset">;

  const returnNavigation = resolveModuleEditorReturnNavigation(
    searchParams.get(MODULE_EDITOR_RETURN_PAGE_QUERY_PARAM),
    searchParams.get("return_to"),
  );

  if (returnNavigation) {
    const contextualProps = props as {
      actions?: ReactNode;
      meta?: ReactNode;
      saved?: boolean;
      status?: string;
      icon?: AdminPageContextHeaderProps["icon"];
      artwork?: AdminPageContextHeaderProps["artwork"];
    };
    return (
      <BlockEditorContextHeader
        {...returnNavigation}
        {...presentation}
        actions={contextualProps.actions}
        meta={contextualProps.meta}
        saved={contextualProps.saved}
        status={contextualProps.status}
        icon={contextualProps.icon}
        artwork={contextualProps.artwork}
      />
    );
  }

  return "backHref" in props ? (
    <BlockEditorContextHeader {...props} {...presentation} />
  ) : (
    <AdminPageContextHeader {...props} {...presentation} />
  );
}

type ModuleEditorTab = Omit<
  AdminModuleTab,
  "navigationLabel" | "label" | "sectionHeading" | "sectionDescription" | "icon"
> & {
  /** Use neutral when this tab already composes independently titled section panels. */
  contentSurface?: "panel" | "neutral";
};

type ModuleEditorTabsProps = Omit<ModuleEditorMetadataScope, "entityName"> &
  Omit<AdminModuleTabsProps, "tabs"> & {
    tabs: ModuleEditorTab[];
  };

export function ModuleEditorTabs({
  moduleKind,
  moduleSlug,
  tabs,
  initialTabId,
  activeTabId: controlledActiveTabId,
  onActiveTabChange,
  ...props
}: ModuleEditorTabsProps) {
  const searchParams = useSearchParams();
  const resolvedTabs = tabs
    .map((tab, sourceIndex) => {
      const metadata = getModuleEditorSectionMetadata(
        moduleKind,
        tab.id,
        moduleSlug,
      );
      if (!metadata) {
        throw new Error(
          `Missing Module Editor section metadata for ${moduleKind}:${moduleSlug ?? "default"}:${tab.id}`,
        );
      }

      const resolvedTab: AdminModuleTab = {
          ...tab,
          navigationLabel: metadata.navigationLabelAr,
          sectionHeading: metadata.sectionHeadingAr,
          sectionDescription: metadata.sectionDescriptionAr,
          icon: metadata.icon,
      };
      return {
        sourceIndex,
        order: getModuleEditorSectionOrder(metadata),
        tab: {
          ...resolvedTab,
          sectionHeading: null,
          sectionSummary: undefined,
          content: (
            <AdminFormSection presentation="panel" surface={tab.contentSurface} header={
              <AdminModuleSectionHeader
                {...resolvedTab}
                sectionHeaderPresentation="premium"
                standalone={tab.contentSurface === "neutral" ? true : undefined}
                sectionHeaderClassName={[ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME, tab.sectionHeaderClassName].filter(Boolean).join(" ")}
              />
            }>
              <div className={ADMIN_FORM_STACK_CLASS_NAME}>{tab.content}</div>
            </AdminFormSection>
          ),
        },
      };
    })
    .sort(
      (left, right) =>
        left.order - right.order || left.sourceIndex - right.sourceIndex,
    )
    .map(({ tab }) => tab);

  const tabIds = resolvedTabs.map((tab) => tab.id);
  const [selectedTabId, setSelectedTabId] = useState(() =>
    resolveModuleEditorTabId(searchParams.get("tab"), tabIds, initialTabId),
  );
  const activeTabId = resolveModuleEditorTabId(
    controlledActiveTabId === undefined ? selectedTabId : controlledActiveTabId,
    tabIds,
  );
  const handleActiveTabChange = useCallback((tabId: string) => {
    if (controlledActiveTabId === undefined) setSelectedTabId(tabId);
    onActiveTabChange?.(tabId);
  }, [controlledActiveTabId, onActiveTabChange]);

  return (
    <>
      {activeTabId ? <input type="hidden" name={MODULE_EDITOR_TAB_FORM_FIELD} value={activeTabId} /> : null}
      <AdminModuleTabs
        {...props}
        tabs={resolvedTabs}
        initialTabId={initialTabId}
        activeTabId={activeTabId}
        onActiveTabChange={handleActiveTabChange}
      />
    </>
  );
}

export function ModuleEditorSection({
  children,
  ...props
}: Omit<React.ComponentProps<typeof AdminFormSection>, "variant">) {
  return (
    <AdminFormSection {...props} variant="module">
      {children}
    </AdminFormSection>
  );
}

export type ModuleEditorSectionHeadingIntent =
  "domain" | "media-collection" | "repeater" | "cta" | "settings";

export function ModuleEditorSectionHeading({
  intent,
  children,
  className = "text-sm",
  actions,
}: {
  intent: ModuleEditorSectionHeadingIntent;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  const heading = (
    <h2
      data-module-editor-section-heading={intent}
      className={`${className} font-semibold text-white`.trim()}
    >
      {children}
    </h2>
  );

  if (!actions) return heading;

  return (
    <div
      data-module-editor-section-header={intent}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      {heading}
      <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}

export function ModuleEditorFieldGrid({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <AdminFormGrid columns={12} presentation="aligned-fields" className={className}>
      {children}
    </AdminFormGrid>
  );
}

export function ModuleEditorField({
  nature,
  span,
  children,
  className = "",
}: {
  nature: ModuleEditorFieldNature;
  span?: ModuleEditorFieldSpan;
  children: ReactNode;
  className?: string;
}) {
  const resolvedSpan = getModuleEditorFieldSpan(nature, span);
  return (
    <AdminFormGridItem
      span={resolvedSpan}
      className={className}
    >
      <div
        data-module-editor-field-nature={nature}
        data-module-editor-field-span={resolvedSpan}
        className="contents"
      >
        {children}
      </div>
    </AdminFormGridItem>
  );
}

export function ModuleEditorContentGroup({
  kind,
  children,
  className = "",
}: {
  kind: "short" | "long";
  children: ReactNode;
  className?: string;
}) {
  const label =
    kind === "short"
      ? MODULE_EDITOR_TERMINOLOGY.shortContent.labelAr
      : MODULE_EDITOR_TERMINOLOGY.longContent.labelAr;

  return (
    <div
      data-module-editor-content-group={kind}
      className={`space-y-3 ${kind === "long" ? "border-t border-white/10 pt-4" : ""} ${className}`.trim()}
    >
      <ModuleEditorSectionHeading intent="domain">
        {label}
      </ModuleEditorSectionHeading>
      {children}
    </div>
  );
}

export function ModuleEditorRepeaterGrid({
  children,
  columns = 3,
  className = "",
}: {
  children: ReactNode;
  columns?: 2 | 3;
  className?: string;
}) {

  return <div data-module-editor-repeater-grid=""><AdminFormGrid columns={columns} className={className}>{children}</AdminFormGrid></div>;

}

export function ModuleEditorRepeaterCard({
  title,
  description,
  icon,
  actions,
  children,
  className = "",
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {

  return (
    <AdminCard presentation="premium" className={`h-full p-3 ${className}`.trim()}>
      <div data-module-editor-repeater-card="" className="space-y-3">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <AdminFormControlHeader presentation="leading-icon" title={<span role="heading" aria-level={3}>{title}</span>} description={description} icon={icon} />
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </header>
        {children}
      </div>
    </AdminCard>
  );

}

export function ModuleEditorHeadingVisibilityRow({
  children,
  name,
  label,
  defaultChecked,
  className = "",
}: {
  children: ReactNode;
  name: string;
  label: ReactNode;
  defaultChecked: boolean;
  className?: string;
}) {
  return (
    <div
      data-module-editor-heading-visibility=""
      className={`grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end ${className}`.trim()}
    >
      {children}
      <AdminFormSwitch
        name={name}
        label={label}
        value="true"
        defaultChecked={defaultChecked}
        surface
        className="md:min-w-52"
      />
    </div>
  );
}

export function ModuleEditorStatusSwitch({
  status,
  label = "منشور",
  surface = true,
  className = "",
}: {
  status: string | null | undefined;
  label?: ReactNode;
  surface?: boolean;
  className?: string;
}) {
  return (
    <AdminFormSwitch
      name="status"
      label={label}
      value="published"
      uncheckedValue="unpublished"
      defaultChecked={status === "published"}
      surface={surface}
      className={`${surface ? "min-h-[46px]" : ""} ${className}`.trim()}
    />
  );
}

type ModuleEditorVisibilityAlignRowBaseProps = {
  label: string;
  showName: string;
  showDefault?: boolean;
  enableVisibility?: boolean;
  description?: ReactNode;
  icon?: ReactNode;
  className?: string;
  children?: ReactNode;
};

type ModuleEditorVisibilityAlignRowProps =
  ModuleEditorVisibilityAlignRowBaseProps &
    (
      | {
          controlMode?: "text";
          alignmentName: string;
          boldName?: string;
          alignmentDefault?: AdminTextAlignment;
          boldDefault?: boolean;
          preserveUnsetBold?: boolean;
          enableAlignment?: boolean;
          enableBold?: boolean;
        }
      | {
          controlMode: "visibility-only";
          alignmentName?: never;
          boldName?: never;
          alignmentDefault?: never;
          boldDefault?: never;
          preserveUnsetBold?: never;
          enableAlignment?: never;
          enableBold?: never;
        }
    );

export function ModuleEditorVisibilityAlignRow({
  label,
  alignmentName,
  showName,
  boldName,
  controlMode = "text",
  alignmentDefault = "right",
  showDefault = true,
  boldDefault,
  preserveUnsetBold = false,
  enableAlignment = true,
  enableBold = true,
  enableVisibility = true,
  description,
  icon,
  className = "",
  children,
}: ModuleEditorVisibilityAlignRowProps) {
  const [alignment, setAlignment] =
    useState<AdminTextAlignment>(alignmentDefault);
  const [show, setShow] = useState(showDefault);
  const [bold, setBold] = useState<boolean | undefined>(
    preserveUnsetBold ? boldDefault : (boldDefault ?? false),
  );
  const hasAlignmentControl =
    controlMode === "text" && enableAlignment && Boolean(alignmentName);
  const hasBoldControl =
    controlMode === "text" && enableBold && Boolean(boldName);

  const submittedBold = hasBoldControl
    ? bold
    : preserveUnsetBold ? boldDefault : (boldDefault ?? false);

  const submittedValues = (
    <>
      <input
        type="hidden"
        name={showName}
        value={String(enableVisibility ? show : showDefault)}
      />
      {alignmentName ? (
        <input
          type="hidden"
          name={alignmentName}
          value={hasAlignmentControl ? alignment : alignmentDefault}
        />
      ) : null}
      {boldName && submittedBold !== undefined ? (
        <input
          type="hidden"
          name={boldName}
          value={String(submittedBold)}
        />
      ) : null}
    </>
  );

  const renderControls = (toolbarLabel = `إعدادات ${label}`, part: "all" | "visibility" | "format" = "all", density: "default" | "compact" = "default") => (
    <div
      className="flex min-w-0 flex-wrap items-center gap-1.5 sm:flex-nowrap"
      role="toolbar"
      aria-label={toolbarLabel}
      dir="rtl"
    >
      {enableVisibility && part !== "format" ? (
        <AdminFormSwitch
          label={show ? "ظاهر" : "مخفي"}
          checked={show}
          onChange={(event) => setShow(event.target.checked)}
          surface={false}
          wrapLabel
          className={density === "compact" ? "!min-w-0 !gap-1 !px-1" : undefined}
        />
      ) : null}
      {part !== "visibility" && (hasAlignmentControl || hasBoldControl) ? (
        <AdminTextFormatControls
          ariaLabel={`تنسيق ${label}`}
          alignmentAriaLabel={`محاذاة ${label}`}
          alignment={hasAlignmentControl ? alignment : undefined}
          onAlignmentChange={
            hasAlignmentControl
              ? setAlignment
              : undefined
          }
          bold={hasBoldControl ? (bold ?? false) : undefined}
          onBoldChange={hasBoldControl ? setBold : undefined}
          embedded
          density={density}
        />
      ) : null}
    </div>
  );


  return (
    <AdminCard presentation="premium" className={`self-start p-3 ${className}`.trim()}>
      <div data-module-editor-control-row="" data-module-editor-control-mode={controlMode} data-module-editor-settings-composition="compact-inline" className="space-y-2.5">
        {submittedValues}
        <div data-module-editor-settings-header="" className="flex min-w-0 flex-wrap items-center gap-1">
          <div className="min-w-20 flex-1">
            <AdminFormControlHeader title={label} description={description} icon={icon} presentation="compact-inline" />
          </div>
          <div className="flex max-w-full shrink-0 flex-wrap items-center gap-1">
            {hasAlignmentControl || hasBoldControl ? renderControls(`تنسيق ${label}`, "format", "compact") : null}
            {enableVisibility ? renderControls(`إظهار ${label}`, "visibility", "compact") : null}
          </div>
        </div>
        {children ? <div data-module-editor-settings-body="" className="min-w-0">{children}</div> : null}
      </div>
    </AdminCard>
  );

}

export function ModuleEditorIdentitySection({
  name,
  status,
  children,
  nameLabel = "اسم الموديول",
  statusLabel = "حالة النشر",
  inputClassName,
  className = "",
}: {
  name: string;
  status: string | null | undefined;
  children?: ReactNode;
  nameLabel?: ReactNode;
  statusLabel?: ReactNode;
  inputClassName: string;
  className?: string;
}) {
  const nameControl = <input name="name" defaultValue={name} required className={inputClassName} />;
  return (
    <ModuleEditorSection
      data-module-editor-identity=""
      className={className}
    >
      <ModuleEditorFieldGrid>
        <ModuleEditorField
          nature="standard"
          span={children ? 4 : 6}
        >
          <div data-module-editor-name-field="" className="contents">
              <AdminFormField label={nameLabel} required presentation="panel">
                {nameControl}
              </AdminFormField>
            </div>
        </ModuleEditorField>
        {children ? (
          <ModuleEditorField
            nature="standard"
            span={4}
          >
            <div
              data-module-editor-identity-control=""
              className="contents"
            >
              {children}
            </div>
          </ModuleEditorField>
        ) : null}
        <ModuleEditorField
          nature="binary-state"
          span={children ? 4 : 6}
        >
          <div className="contents">
            <ModuleEditorStatusSwitch
              status={status}
              label={statusLabel}
              surface
            />
          </div>
        </ModuleEditorField>
      </ModuleEditorFieldGrid>
    </ModuleEditorSection>
  );
}

export function ModuleEditorPagesTab({
  moduleName,
  assignmentContext,
  showUsageBanner = true,
  children,
}: {
  moduleName: string;
  assignmentContext: ModuleAssignmentContext;
  /** Omit repeated read-only usage details when the assignment view is the reference. */
  showUsageBanner?: boolean;
  children?: ReactNode;
}) {
  return (
    <div data-module-editor-pages="" className="space-y-5">
      {showUsageBanner ? (
        <ModuleCrossPageUsageBanner
          moduleName={moduleName}
          assignments={assignmentContext.assignments}
        />
      ) : null}
      {children ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {children}
          <ModulePageAssignmentsField
            pages={assignmentContext.pages}
            assignedPageIds={assignmentContext.assignments.map(
              (row) => row.page_id,
            )}
          />
        </div>
      ) : (
        <ModulePageAssignmentsField
          pages={assignmentContext.pages}
          assignedPageIds={assignmentContext.assignments.map(
            (row) => row.page_id,
          )}
        />
      )}
    </div>
  );
}

export function ModuleEditorFeedbackSlot({ children }: { children: ReactNode }) {
  return children ? <div data-module-editor-feedback="">{children}</div> : null;
}

export function ModuleEditorFeedback({
  backHref,
  saved,
}: {
  backHref: string;
  saved?: boolean;
}) {
  return (
    <ModuleEditorFeedbackSlot>
      <BlockEditorSaveFeedback backHref={backHref} saved={saved} />
    </ModuleEditorFeedbackSlot>
  );
}

export function ModuleEditorSaveArea({
  saveLabel = "حفظ الموديول",
  className = "",
}: {
  saveLabel?: ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const searchParams = useSearchParams();
  const returnPageId = parseModuleEditorReturnPageId(
    searchParams.get(MODULE_EDITOR_RETURN_PAGE_QUERY_PARAM),
  );

  return (
    <>
      {returnPageId ? (
        <>
          <input
            type="hidden"
            name={MODULE_EDITOR_RETURN_PAGE_FORM_FIELD}
            value={returnPageId}
          />
          <input
            type="hidden"
            name="return_to"
            value={resolveAdminFormReturnPath(searchParams.get("return_to"), "/admin/pages-blocks/pages")}
          />
        </>
      ) : null}
      <AdminStickyFormBar
        className={className}
        title="إجراءات النموذج"
        description={null}
        icon={<AdminModuleTabIcon name="content" />}
      >
        <AdminActionButton type="submit" variant="primary" disabled={pending}>
            {pending ? "جارٍ الحفظ..." : saveLabel}
          </AdminActionButton>
      </AdminStickyFormBar>
    </>
  );
}

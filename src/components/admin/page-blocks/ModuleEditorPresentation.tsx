"use client";

import { Children, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";

import type { ModuleAssignmentContext } from "../../../lib/page-blocks/module-assignments-query";
import {
  getModuleEditorHeaderMetadata,
  getModuleEditorSectionOrder,
  getModuleEditorSectionMetadata,
} from "../../../lib/page-composition/slot-module-registry";
import {
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
import type { PageBlockTextAlignment } from "../../../lib/page-blocks/configs";
import AdminModuleTabs from "../ui/AdminModuleTabs";
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
  parseModuleEditorReturnPageId,
  resolveModuleEditorReturnNavigation,
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
  };

  const returnNavigation = resolveModuleEditorReturnNavigation(
    searchParams.get(MODULE_EDITOR_RETURN_PAGE_QUERY_PARAM),
  );

  if (returnNavigation) {
    const contextualProps = props as {
      actions?: ReactNode;
      meta?: ReactNode;
      saved?: boolean;
      status?: string;
    };
    return (
      <BlockEditorContextHeader
        {...returnNavigation}
        {...presentation}
        actions={contextualProps.actions}
        meta={contextualProps.meta}
        saved={contextualProps.saved}
        status={contextualProps.status}
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
>;

type ModuleEditorTabsProps = Omit<ModuleEditorMetadataScope, "entityName"> &
  Omit<AdminModuleTabsProps, "tabs"> & {
    tabs: ModuleEditorTab[];
  };

export function ModuleEditorTabs({
  moduleKind,
  moduleSlug,
  tabs,
  ...props
}: ModuleEditorTabsProps) {
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

      return {
        sourceIndex,
        order: getModuleEditorSectionOrder(metadata),
        tab: {
          ...tab,
          navigationLabel: metadata.navigationLabelAr,
          sectionHeading: metadata.sectionHeadingAr,
          sectionDescription: metadata.sectionDescriptionAr,
          icon: metadata.icon,
        } satisfies AdminModuleTab,
      };
    })
    .sort(
      (left, right) =>
        left.order - right.order || left.sourceIndex - right.sourceIndex,
    )
    .map(({ tab }) => tab);

  return <AdminModuleTabs {...props} tabs={resolvedTabs} />;
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
    <AdminFormGrid columns={12} className={className}>
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
      className={`h-full ${className}`.trim()}
    >
      <div
        data-module-editor-field-nature={nature}
        data-module-editor-field-span={resolvedSpan}
        className="h-full"
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
  return (
    <div
      data-module-editor-repeater-grid=""
      className={`grid gap-4 lg:grid-cols-2 ${columns === 2 ? "xl:grid-cols-2" : "xl:grid-cols-3"} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

export function ModuleEditorRepeaterCard({
  title,
  actions,
  children,
  className = "",
}: {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      data-module-editor-repeater-card=""
      className={`min-w-0 space-y-3 rounded-2xl border border-white/10 bg-[#05070B] p-4 ${className}`.trim()}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-[#D8B87A]/70">{title}</h3>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </header>
      {children}
    </article>
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

export const MODULE_EDITOR_CONTROL_CARD_CLASS_NAME =
  "rounded-2xl border border-white/10 bg-[#05070B]/72 p-4";

export function ModuleEditorVisibilityAlignRow({
  label,
  alignmentName,
  showName,
  boldName,
  alignmentDefault = "right",
  showDefault = true,
  boldDefault = false,
  enableAlignment = true,
  enableBold = true,
  enableVisibility = true,
  controlsPlacement = "header",
  presentation = "card",
  className = "",
  children,
}: {
  label: string;
  alignmentName: string;
  showName: string;
  boldName?: string;
  alignmentDefault?: PageBlockTextAlignment;
  showDefault?: boolean;
  boldDefault?: boolean;
  enableAlignment?: boolean;
  enableBold?: boolean;
  enableVisibility?: boolean;
  controlsPlacement?: "header" | "footer" | "cards";
  presentation?: "card" | "plain";
  className?: string;
  children?: ReactNode;
}) {
  const [alignment, setAlignment] =
    useState<PageBlockTextAlignment>(alignmentDefault);
  const [show, setShow] = useState(showDefault);
  const [bold, setBold] = useState(boldDefault);

  const submittedValues = (
    <>
      <input
        type="hidden"
        name={showName}
        value={String(enableVisibility ? show : showDefault)}
      />
      <input
        type="hidden"
        name={alignmentName}
        value={enableAlignment ? alignment : alignmentDefault}
      />
      {boldName ? (
        <input
          type="hidden"
          name={boldName}
          value={String(enableBold ? bold : boldDefault)}
        />
      ) : null}
    </>
  );

  const renderControls = (toolbarLabel = `إعدادات ${label}`) => (
    <div
      className="flex min-w-0 flex-wrap items-center gap-1.5 sm:flex-nowrap"
      role="toolbar"
      aria-label={toolbarLabel}
      dir="rtl"
    >
      {enableVisibility ? (
        <AdminFormSwitch
          label={show ? "ظاهر" : "مخفي"}
          checked={show}
          onChange={(event) => setShow(event.target.checked)}
          wrapLabel
        />
      ) : null}
      <AdminTextFormatControls
        ariaLabel={`تنسيق ${label}`}
        alignmentAriaLabel={`محاذاة ${label}`}
        alignment={enableAlignment ? alignment : undefined}
        onAlignmentChange={
          enableAlignment
            ? (next) => setAlignment(next as PageBlockTextAlignment)
            : undefined
        }
        bold={boldName && enableBold ? bold : undefined}
        onBoldChange={boldName && enableBold ? setBold : undefined}
        embedded
      />
    </div>
  );

  if (controlsPlacement === "cards") {
    return (
      <div data-module-editor-control-row="">
        {submittedValues}
        <div
          className="grid min-w-0 gap-4 lg:grid-cols-2"
          data-module-editor-cta-grid=""
        >
          {Children.toArray(children).map((child, index) => {
            const targetLabel = index === 0 ? "الزر الأساسي" : "الزر الثانوي";
            return (
              <div
                key={index}
                className={`${MODULE_EDITOR_CONTROL_CARD_CLASS_NAME} space-y-3`}
                data-module-editor-cta-card={
                  index === 0 ? "primary" : "secondary"
                }
              >
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <span className="shrink-0 text-sm font-semibold text-white/78">
                    {targetLabel}
                  </span>
                  {renderControls(`إعدادات ${targetLabel}`)}
                </div>
                {child}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      data-module-editor-control-row=""
      className={
        presentation === "card"
          ? `${MODULE_EDITOR_CONTROL_CARD_CLASS_NAME} ${className}`.trim()
          : className || undefined
      }
    >
      {submittedValues}
      {controlsPlacement === "header" ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="shrink-0 text-sm font-semibold text-white/78">
            {label}
          </span>
          {renderControls()}
        </div>
      ) : null}
      {children ? (
        <div className={controlsPlacement === "header" ? "mt-3" : ""}>
          {children}
        </div>
      ) : null}
      {controlsPlacement === "footer" ? (
        <div
          className={
            presentation === "card"
              ? "mt-3 flex flex-col gap-3 border-t border-white/8 pt-3 sm:flex-row sm:items-center sm:justify-between"
              : "mt-3 flex w-fit flex-col gap-3 rounded-xl border border-white/10 bg-[#05070B]/72 px-3 py-2 sm:flex-row sm:items-center"
          }
        >
          <span className="shrink-0 text-sm font-semibold text-white/78">
            {label}
          </span>
          {renderControls()}
        </div>
      ) : null}
    </div>
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
  return (
    <ModuleEditorSection
      data-module-editor-identity=""
      className={`mb-5 ${className}`.trim()}
    >
      <ModuleEditorFieldGrid className="md:grid-cols-2 xl:grid-cols-[minmax(16rem,20rem)_max-content_max-content] xl:justify-start">
        <ModuleEditorField
          nature="standard"
          span={3}
          className="xl:col-span-1!"
        >
          <label className="block space-y-2">
            <span className="block text-sm font-medium text-white/70">
              {nameLabel}
            </span>
            <input
              name="name"
              defaultValue={name}
              required
              className={inputClassName}
            />
          </label>
        </ModuleEditorField>
        {children ? (
          <ModuleEditorField
            nature="standard"
            span={3}
            className="xl:col-span-1!"
          >
            {children}
          </ModuleEditorField>
        ) : null}
        <ModuleEditorField
          nature="binary-state"
          span={3}
          className="xl:col-span-1!"
        >
          <div className="flex h-full items-end pb-1.5">
            <ModuleEditorStatusSwitch
              status={status}
              label={statusLabel}
              surface={false}
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
  children,
}: {
  moduleName: string;
  assignmentContext: ModuleAssignmentContext;
  children?: ReactNode;
}) {
  return (
    <div data-module-editor-pages="" className="space-y-5">
      <ModuleCrossPageUsageBanner
        moduleName={moduleName}
        assignments={assignmentContext.assignments}
      />
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

export function ModuleEditorFeedback(
  props:
    | { backHref: string; saved?: boolean; children?: never }
    | { children: ReactNode; backHref?: never; saved?: never },
) {
  const feedback =
    "children" in props ? (
      props.children
    ) : (
      <BlockEditorSaveFeedback backHref={props.backHref} saved={props.saved} />
    );

  return feedback ? <div data-module-editor-feedback="">{feedback}</div> : null;
}

export function ModuleEditorSaveArea({
  title = "حفظ الموديول",
  description = "تُحدّث التغييرات بعد اكتمال الحفظ.",
  saveLabel = "حفظ الموديول",
}: {
  title?: ReactNode;
  description?: ReactNode;
  saveLabel?: ReactNode;
}) {
  const { pending } = useFormStatus();
  const searchParams = useSearchParams();
  const returnPageId = parseModuleEditorReturnPageId(
    searchParams.get(MODULE_EDITOR_RETURN_PAGE_QUERY_PARAM),
  );

  return (
    <>
      {returnPageId ? (
        <input
          type="hidden"
          name={MODULE_EDITOR_RETURN_PAGE_FORM_FIELD}
          value={returnPageId}
        />
      ) : null}
      <AdminStickyFormBar
        className="mt-8"
        title={title}
        description={description}
      >
        <button
          type="submit"
          disabled={pending}
          className={`inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#D8B87A] px-6 text-sm font-bold text-[#06101C] transition hover:bg-[#e5c98d] ${
            pending ? "cursor-not-allowed opacity-60" : "cursor-pointer"
          }`}
        >
          {pending ? "جارٍ الحفظ..." : saveLabel}
        </button>
      </AdminStickyFormBar>
    </>
  );
}

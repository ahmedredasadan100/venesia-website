"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import type { ModuleAssignmentContext } from "../../../lib/page-blocks/module-assignments-query";
import {
  getModuleEditorHeaderMetadata,
  getModuleEditorSectionMetadata,
} from "../../../lib/page-composition/slot-module-registry";
import {
  AdminFormGrid,
  AdminFormGridItem,
  AdminFormSection,
  AdminFormSwitch,
  AdminPageContextHeader,
  AdminStickyFormBar,
  type AdminPageContextHeaderProps,
  type AdminModuleTab,
  type AdminModuleTabsProps,
} from "../ui";
import AdminModuleTabs from "../ui/AdminModuleTabs";
import BlockEditorContextHeader, {
  BlockEditorSaveFeedback,
  type BlockEditorContextHeaderProps,
} from "./BlockEditorContextHeader";
import ModuleCrossPageUsageBanner from "./ModuleCrossPageUsageBanner";
import ModulePageAssignmentsField from "./ModulePageAssignmentsField";
import {
  getModuleEditorFieldSpan,
  type ModuleEditorFieldNature,
  type ModuleEditorFieldSpan,
} from "../../../lib/page-blocks/module-editor-presentation-contract";

export const MODULE_EDITOR_STATUS_OPTIONS = [
  { value: "draft", label: "مسودة" },
  { value: "published", label: "منشور" },
  { value: "unpublished", label: "مخفي" },
  { value: "archived", label: "أرشيف" },
] as const;

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
  const metadata = getModuleEditorHeaderMetadata(moduleKind, moduleSlug, entityName);
  if (!metadata) {
    throw new Error(`Missing Module Editor header metadata for ${moduleKind}:${moduleSlug ?? "default"}`);
  }

  const presentation = {
    eyebrow: metadata.eyebrowAr,
    title: metadata.titleAr,
    description: metadata.descriptionAr,
  };

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
  const resolvedTabs: AdminModuleTab[] = tabs.map((tab) => {
    const metadata = getModuleEditorSectionMetadata(moduleKind, tab.id, moduleSlug);
    if (!metadata) {
      throw new Error(`Missing Module Editor section metadata for ${moduleKind}:${moduleSlug ?? "default"}:${tab.id}`);
    }

    return {
      ...tab,
      navigationLabel: metadata.navigationLabelAr,
      sectionHeading: metadata.sectionHeadingAr,
      sectionDescription: metadata.sectionDescriptionAr,
      icon: metadata.icon,
    };
  });

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

export function ModuleEditorFieldGrid({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <AdminFormGrid
      columns={12}
      className={className}
    >
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
      >
        {children}
      </div>
    </AdminFormGridItem>
  );
}

export function ModuleEditorRepeaterGrid({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-module-editor-repeater-grid=""
      className={`grid gap-4 lg:grid-cols-2 xl:grid-cols-3 ${className}`.trim()}
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

export function ModuleEditorSettingsComposition({
  context,
  primary,
  secondary,
  className = "",
}: {
  context?: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
  className?: string;
}) {
  return (
    <div data-module-editor-settings="" className={`space-y-5 ${className}`.trim()}>
      {context}
      {secondary ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {primary}
          {secondary}
        </div>
      ) : (
        primary
      )}
    </div>
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
            assignedPageIds={assignmentContext.assignments.map((row) => row.page_id)}
          />
        </div>
      ) : (
        <ModulePageAssignmentsField
          pages={assignmentContext.pages}
          assignedPageIds={assignmentContext.assignments.map((row) => row.page_id)}
        />
      )}
    </div>
  );
}

export function ModuleEditorTechnicalIdentity({
  mode,
  value,
  name = "slug",
  label = "المعرّف التقني",
  inputClassName,
}: {
  mode: "editable" | "read-only" | "hidden";
  value: string;
  name?: string;
  label?: ReactNode;
  inputClassName: string;
}) {
  if (mode === "hidden") return <input type="hidden" name={name} value={value} />;

  return (
    <label className="block space-y-2" data-module-editor-technical-identity={mode}>
      <span className="text-xs font-semibold text-white/55">{label}</span>
      <input
        name={name}
        defaultValue={value}
        readOnly={mode === "read-only"}
        required={mode === "editable"}
        dir="ltr"
        className={`${inputClassName} ${mode === "read-only" ? "cursor-default text-white/55" : ""}`.trim()}
      />
      {mode === "read-only" ? (
        <span className="block text-xs leading-5 text-white/40">
          معرّف بنيوي للقراءة فقط؛ تغيير نوع الموديول غير مدعوم من هذا المحرر.
        </span>
      ) : null}
    </label>
  );
}

export function ModuleEditorFeedback(
  props:
    | { backHref: string; saved?: boolean; children?: never }
    | { children: ReactNode; backHref?: never; saved?: never },
) {
  const feedback = "children" in props ? (
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

  return (
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
  );
}

"use client";

import { useCallback, useState } from "react";

import type { ContentType } from "../../../../lib/admin/content/content-types";
import {
  applyContentTemplatePreset,
  resolveContentTemplatePreset,
  type ContentTemplateContext,
  type ContentTemplateEditableValues,
} from "../../../../lib/admin/content-workflow/content-template-presets";
import { normalizeArticleMarkdown } from "../../../../lib/rich-text/html-utils";
import type {
  AdminFormAction,
  AdminFormActionState,
  AdminFormMode,
} from "../../../../lib/admin/form-runtime";
import AdminFormRuntime, { AdminFormActions } from "../../ui/AdminFormRuntime";
import AdminModuleTabs, {
  type AdminModuleTab,
} from "../../ui/AdminModuleTabs";
import ContentTemplatePicker from "../../content-workflow/ContentTemplatePicker";
import { ADMIN_FORM_STACK_CLASS_NAME } from "../../ui";
import { CONTENT_EDITOR_NAVIGATION_EVENT } from "./content-editor-navigation";
import { CONTENT_FORM_NAVIGATION } from "./content-form-definition";
import { ADMIN_ENTITY_REVIEW_TAB_LABEL } from "../../../../lib/admin/review/entity-review-presentation";
import { encodeTopicRevision } from "../../../../lib/admin/content/topic-revision";

type ContentEditorShellProps = {
  action: AdminFormAction;
  contentType: ContentType;
  mode: AdminFormMode;
  entityId?: number;
  baselineRevision?: string | null;
  closeHref: string;
  formId: string;
  tabs:
    | AdminModuleTab[]
    | ((model: ContentEditorModel) => AdminModuleTab[]);
  initialModelValue?: ContentEditorModelValue;
  templateContext?: ContentTemplateContext;
  initialState?: AdminFormActionState;
};

export type ContentEditorModelValue = ContentTemplateEditableValues;

export type ContentEditorModel = {
  value: Readonly<ContentEditorModelValue>;
  setField: <Field extends keyof ContentEditorModelValue>(
    field: Field,
    value: ContentEditorModelValue[Field],
  ) => void;
  requestPreset: (presetKey: string) => boolean;
};

function normalizeContentEditorModelValue(
  value: ContentEditorModelValue,
): ContentEditorModelValue {
  return {
    ...value,
    content: normalizeArticleMarkdown(value.content),
  };
}

const CONTENT_REVIEW_TAB_SECTION = {
  navigationLabel: ADMIN_ENTITY_REVIEW_TAB_LABEL,
  sectionHeading: "مراجعة المحتوى وحالة النشر",
  sectionDescription:
    "راجع جاهزية المحتوى وإعدادات الظهور، ثم عالج الملاحظات قبل النشر.",
  icon: "publish" as const,
};

type ContentEditorShellFrameProps = Omit<
  ContentEditorShellProps,
  "initialModelValue" | "tabs" | "templateContext"
> & {
  templateContext?: ContentTemplateContext;
  onApplyPreset?: (presetKey: string) => boolean;
  tabs: AdminModuleTab[];
};

function ContentEditorShellFrame({
  action,
  contentType,
  mode,
  entityId,
  baselineRevision,
  closeHref,
  formId,
  tabs,
  templateContext,
  onApplyPreset,
  initialState,
}: ContentEditorShellFrameProps) {
  if (mode === "edit" && baselineRevision === undefined) {
    throw new Error("Content edit forms require a baseline revision.");
  }

  const presentedTabs: AdminModuleTab[] = tabs.map((tab) =>
    tab.id === "publish"
      ? {
          id: tab.id,
          indicator: tab.indicator,
          content: tab.content,
          ...CONTENT_REVIEW_TAB_SECTION,
        }
      : tab,
  );

  return (
    <AdminFormRuntime
      key={entityId ?? `${contentType}:create`}
      action={action}
      initialState={initialState}
      mode={mode}
      entityKey={`content:${contentType}`}
      closeHref={closeHref}
      navigation={CONTENT_FORM_NAVIGATION}
      formId={formId}
      className={ADMIN_FORM_STACK_CLASS_NAME}
    >
      {entityId ? <input type="hidden" name="id" value={entityId} /> : null}
      {mode === "edit" ? (
        <input
          type="hidden"
          name="expected_updated_at"
          value={encodeTopicRevision(baselineRevision ?? null)}
          data-admin-form-server-owned=""
        />
      ) : null}
      <input type="hidden" name="content_type" value={contentType} />
      {mode === "create" && templateContext && onApplyPreset ? (
        <ContentTemplatePicker
          context={templateContext}
          onApplyPreset={onApplyPreset}
        />
      ) : null}
      <AdminModuleTabs
        tabs={presentedTabs}
        variant="editor"
        navigationEventName={CONTENT_EDITOR_NAVIGATION_EVENT}
      />
      <AdminFormActions />
    </AdminFormRuntime>
  );
}

function ModeledContentEditorShell(props: ContentEditorShellProps & {
  initialModelValue: ContentEditorModelValue;
  tabs: (model: ContentEditorModel) => AdminModuleTab[];
  templateContext: ContentTemplateContext;
}) {
  const { initialModelValue, tabs, templateContext, ...frameProps } = props;
  const [value, setValue] = useState(() =>
    normalizeContentEditorModelValue(initialModelValue),
  );
  const setField = useCallback<ContentEditorModel["setField"]>(
    (field, nextValue) => {
      setValue((current) =>
        current[field] ===
          (field === "content"
            ? normalizeArticleMarkdown(nextValue)
            : nextValue)
          ? current
          : {
              ...current,
              [field]:
                field === "content"
                  ? normalizeArticleMarkdown(nextValue)
                  : nextValue,
            },
      );
    },
    [],
  );
  const requestPreset = useCallback(
    (presetKey: string) => {
      if (!resolveContentTemplatePreset(presetKey, templateContext)) {
        return false;
      }
      setValue(
        (current) => {
          const applied = applyContentTemplatePreset(
            current,
            presetKey,
            templateContext,
          );
          return applied
            ? normalizeContentEditorModelValue(applied)
            : current;
        },
      );
      return true;
    },
    [templateContext],
  );
  const model: ContentEditorModel = { value, setField, requestPreset };

  return (
    <ContentEditorShellFrame
      {...frameProps}
      templateContext={templateContext}
      onApplyPreset={requestPreset}
      tabs={tabs(model)}
    />
  );
}

export default function ContentEditorShell(props: ContentEditorShellProps) {
  if (typeof props.tabs !== "function") {
    const { tabs, ...frameProps } = props;
    return (
      <ContentEditorShellFrame
        {...frameProps}
        tabs={tabs}
      />
    );
  }

  if (!props.initialModelValue || !props.templateContext) {
    throw new Error(
      "Modeled content editors require initialModelValue and templateContext.",
    );
  }

  return (
    <ModeledContentEditorShell
      key={props.entityId ?? `${props.contentType}:create`}
      {...props}
      initialModelValue={props.initialModelValue}
      tabs={props.tabs}
      templateContext={props.templateContext}
    />
  );
}

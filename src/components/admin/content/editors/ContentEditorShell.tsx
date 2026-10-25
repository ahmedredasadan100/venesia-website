"use client";

import { useCallback, useMemo, useState } from "react";

import type { ContentType } from "../../../../lib/admin/content/content-types";
import type { VideoProvider } from "../../../../lib/admin/media-topic-payload";
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
  AdminModuleSectionHeader,
  AdminModuleTabIcon,
  type AdminModuleTab,
} from "../../ui/AdminModuleTabs";
import AdminCard from "../../ui/AdminCard";
import { ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME } from "../../../../lib/admin/admin-ui-styles";
import ContentTemplatePicker from "../../content-workflow/ContentTemplatePicker";
import { ADMIN_FORM_STACK_CLASS_NAME } from "../../ui";
import { CONTENT_EDITOR_NAVIGATION_EVENT } from "./content-editor-navigation";
import { CONTENT_FORM_NAVIGATION } from "./content-form-definition";
import { ADMIN_ENTITY_REVIEW_TAB_LABEL } from "../../../../lib/admin/review/entity-review-presentation";
import { encodeTopicRevision, type TopicDraftSession, type TopicFormDraftFields } from "../../../../lib/admin/content/topic-revision";
import { TopicFormDraftRecovery } from "./article/TopicMarkdownEditor";

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
  draftSession?: TopicDraftSession;
};

export type ContentEditorModelValue = ContentTemplateEditableValues & {
  videoUrl?: string;
  videoProvider?: VideoProvider;
  videoStartSeconds?: string;
  videoThumbnail?: string;
  image?: string;
};

export type ContentEditorModel = {
  value: Readonly<ContentEditorModelValue>;
  recoveryFields: TopicFormDraftFields | null;
  recoveryEnabled: boolean;
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
  restoreVersion?: number;
  onRestoreDraft?: (fields: TopicFormDraftFields) => void;
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
  draftSession,
  restoreVersion = 0,
  onRestoreDraft,
}: ContentEditorShellFrameProps) {
  const draftScope = useMemo(() => draftSession ? {
    ...draftSession, contentType, entity: entityId === undefined ? "create" : String(entityId),
  } : null, [draftSession, contentType, entityId]);
  if (mode === "edit" && baselineRevision === undefined) {
    throw new Error("Content edit forms require a baseline revision.");
  }

  const presentedTabs: AdminModuleTab[] = tabs.map((tab) => {
    if (tab.id !== "publish") return tab;
    const reviewTab: AdminModuleTab = {
      id: tab.id,
      indicator: tab.indicator,
      content: tab.content,
      ...CONTENT_REVIEW_TAB_SECTION,
    };
    if (tab.sectionHeaderPresentation !== "premium") return reviewTab;
    return {
      ...reviewTab,
      sectionHeading: undefined,
      sectionDescription: undefined,
      content: (
        <div className={ADMIN_FORM_STACK_CLASS_NAME}>
          <AdminCard presentation="premium" className="min-w-0 overflow-hidden">
            <AdminModuleSectionHeader
              id={`${formId}-review-publish`}
              sectionHeading={ADMIN_ENTITY_REVIEW_TAB_LABEL}
              sectionDescription={CONTENT_REVIEW_TAB_SECTION.sectionDescription}
              icon={CONTENT_REVIEW_TAB_SECTION.icon}
              sectionHeaderPresentation="premium"
              sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
              standalone
            />
          </AdminCard>
          {tab.content}
        </div>
      ),
    };
  });

  return (
    <AdminFormRuntime
      key={entityId ?? `${contentType}:create`}
      action={action}
      initialState={initialState}
      mode={mode}
      entityKey={`content:${contentType}`}
      finalizeFieldsOnSubmit
      invalidateEntities={["topics", "categories", "series", "topics_without_image"]}
      closeHref={closeHref}
      navigation={CONTENT_FORM_NAVIGATION}
      formId={formId}
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
      {draftScope && onRestoreDraft ? <TopicFormDraftRecovery scope={draftScope} baselineRevision={baselineRevision ?? null} onRestore={onRestoreDraft} restoreVersion={restoreVersion} /> : null}
      <div key={restoreVersion} className={ADMIN_FORM_STACK_CLASS_NAME}>
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
        <AdminFormActions description={null} icon={<AdminModuleTabIcon name="content" />} />
      </div>
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
  const [recoveryFields, setRecoveryFields] = useState<TopicFormDraftFields | null>(null);
  const [restoreVersion, setRestoreVersion] = useState(0);
  const restoreDraft = useCallback((fields: TopicFormDraftFields) => {
    setRecoveryFields(fields);
    setValue(current => {
      const restored = { ...current };
      const bindings = {
        title: "title", excerpt: "excerpt", content: "content", seoTitle: "seo_title",
        seoDescription: "seo_description", focusKeyword: "focus_keyword", videoUrl: "video_url",
        videoProvider: "video_provider", videoStartSeconds: "video_start_seconds",
        videoThumbnail: "video_thumbnail", image: "image",
      } as const;
      for (const [field, nativeName] of Object.entries(bindings)) {
        if (!Object.hasOwn(fields, nativeName)) continue;
        const next = fields[nativeName]?.at(-1) ?? "";
        if (field === "videoProvider") restored.videoProvider = next as VideoProvider;
        else restored[field as Exclude<keyof typeof bindings, "videoProvider">] = next;
      }
      return normalizeContentEditorModelValue(restored);
    });
    setRestoreVersion(version => version + 1);
  }, []);
  const setField = useCallback<ContentEditorModel["setField"]>(
    (field, nextValue) => {
      setValue((current) =>
        current[field] ===
          (field === "content"
            ? normalizeArticleMarkdown(nextValue ?? "")
            : nextValue)
          ? current
          : {
              ...current,
              [field]:
                field === "content"
                  ? normalizeArticleMarkdown(nextValue ?? "")
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
  const model: ContentEditorModel = { value, setField, requestPreset, recoveryFields, recoveryEnabled: Boolean(props.draftSession) };

  return (
    <ContentEditorShellFrame
      {...frameProps}
      templateContext={templateContext}
      onApplyPreset={requestPreset}
      onRestoreDraft={restoreDraft}
      restoreVersion={restoreVersion}
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
      key={props.draftSession
        ? `${props.entityId ?? `${props.contentType}:create`}:${props.draftSession.actorId}:${props.draftSession.sessionVersion}:${props.draftSession.expiresAt}`
        : props.entityId ?? `${props.contentType}:create`}
      {...props}
      initialModelValue={props.initialModelValue}
      tabs={props.tabs}
      templateContext={props.templateContext}
    />
  );
}

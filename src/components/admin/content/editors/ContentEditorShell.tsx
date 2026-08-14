import type { ContentType } from "../../../../lib/admin/content/content-types";
import type {
  AdminFormAction,
  AdminFormActionState,
  AdminFormMode,
} from "../../../../lib/admin/form-runtime";
import AdminFormRuntime, { AdminFormActions } from "../../ui/AdminFormRuntime";
import AdminModuleTabs, {
  type AdminModuleTab,
} from "../../ui/AdminModuleTabs";
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
  tabs: AdminModuleTab[];
  initialState?: AdminFormActionState;
};

const CONTENT_REVIEW_TAB_SECTION = {
  navigationLabel: ADMIN_ENTITY_REVIEW_TAB_LABEL,
  sectionHeading: "مراجعة المحتوى وحالة النشر",
  sectionDescription:
    "راجع جاهزية المحتوى وإعدادات الظهور، ثم عالج الملاحظات قبل النشر.",
  icon: "publish" as const,
};

export default function ContentEditorShell({
  action,
  contentType,
  mode,
  entityId,
  baselineRevision,
  closeHref,
  formId,
  tabs,
  initialState,
}: ContentEditorShellProps) {
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
      <AdminModuleTabs
        tabs={presentedTabs}
        variant="editor"
        navigationEventName={CONTENT_EDITOR_NAVIGATION_EVENT}
      />
      <AdminFormActions />
    </AdminFormRuntime>
  );
}

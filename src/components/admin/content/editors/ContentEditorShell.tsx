import type { ReactNode } from "react";

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

type ContentEditorShellProps = {
  action: AdminFormAction;
  contentType: ContentType;
  mode: AdminFormMode;
  entityId?: number;
  closeHref: string;
  formId: string;
  tabs: AdminModuleTab[];
  initialState?: AdminFormActionState;
  beforeTabs?: ReactNode;
};

const CONTENT_REVIEW_TAB_SECTION = {
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
  closeHref,
  formId,
  tabs,
  initialState,
  beforeTabs,
}: ContentEditorShellProps) {
  const presentedTabs: AdminModuleTab[] = tabs.map((tab) =>
    tab.id === "publish" ? { ...tab, ...CONTENT_REVIEW_TAB_SECTION } : tab,
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
      <input type="hidden" name="content_type" value={contentType} />
      {beforeTabs}
      <AdminModuleTabs
        tabs={presentedTabs}
        variant="editor"
        navigationEventName={CONTENT_EDITOR_NAVIGATION_EVENT}
      />
      <AdminFormActions />
    </AdminFormRuntime>
  );
}

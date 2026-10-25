import Link from "next/link";

import AssignTemplateUsageWarning from "../../../../../../components/admin/page-blocks/AssignTemplateUsageWarning";
import {
  AdminCard,
  ADMIN_FORM_STACK_CLASS_NAME,
  AdminFormField,
  AdminFormGrid,
  AdminFormListboxSelect,
  AdminFormSwitch,
  AdminListboxSelect,
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  VenesiaModal,
  adminFormFieldClassName,
  adminFormLabelClassName,
} from "../../../../../../components/admin/ui";
import { AdminFormPendingFields } from "../../../../../../components/admin/ui/AdminFormRuntime";
import { adminFormHintClassName } from "../../../../../../lib/admin/admin-ui-styles";
import { getContentStatusMetadata } from "../../../../../../lib/admin/content/content-status-metadata";
import type { PageBlockActionResult } from "../../../../../../lib/page-blocks/action-result";
import {
  blockModuleListHref,
  moduleKindLabel,
} from "../../../../../../lib/page-blocks/admin-utils";
import { type PageLayoutSlot } from "../../../../../../lib/page-blocks/layout-slots";
import {
  REGISTERED_SLOT_MODULE_KINDS,
} from "../../../../../../lib/page-composition/slot-module-registry";
import type { PageBlockType } from "../../../../../../lib/page-blocks/types";
import type { AssignableModuleKind } from "./use-page-blocks-assign-modal";

type TemplateOption = {
  id: number;
  name: string;
  slug: string;
  status: string;
};

type PageBlocksAssignModalProps = {
  regionLabels: Readonly<Record<string, string>>;
  pageId: number;
  onClose: () => void;
  assignModuleKind: AssignableModuleKind;
  onAssignModuleKindChange: (kind: AssignableModuleKind) => void;
  assignTemplateId: number | null;
  onAssignTemplateIdChange: (id: number | null) => void;
  assignVisible: boolean;
  onAssignVisibleChange: (visible: boolean) => void;
  assignPending: boolean;
  templateOptions: TemplateOption[];
  templatesLoading: boolean;
  templatesError: string | null;
  onRetryTemplates: () => void;
  assignableTemplates: TemplateOption[];
  heroAssignmentExists: boolean;
  slotOptions: PageLayoutSlot[];
  assignState: PageBlockActionResult;
  assignHeroState: PageBlockActionResult;
  assignMediaSidebarState: PageBlockActionResult;
  assignMediaHubState: PageBlockActionResult;
  assignBlockAction: (formData: FormData) => void;
  assignHeroAction: (formData: FormData) => void;
  assignMediaSidebarAction: (formData: FormData) => void;
  assignMediaHubAction: (formData: FormData) => void;
};

export default function PageBlocksAssignModal({
  regionLabels,
  pageId,
  onClose,
  assignModuleKind,
  onAssignModuleKindChange,
  assignTemplateId,
  onAssignTemplateIdChange,
  assignVisible,
  onAssignVisibleChange,
  assignPending,
  templateOptions,
  templatesLoading,
  templatesError,
  onRetryTemplates,
  assignableTemplates,
  heroAssignmentExists,
  slotOptions,
  assignState,
  assignHeroState,
  assignMediaSidebarState,
  assignMediaHubState,
  assignBlockAction,
  assignHeroAction,
  assignMediaSidebarAction,
  assignMediaHubAction,
}: PageBlocksAssignModalProps) {
  return (
    <VenesiaModal
      open
      title="ربط موديول بالصفحة"
      description="اختر قالب موديول موجودًا — لن يُنشأ قالب فارغ."
      size="lg"
      onClose={onClose}
      footer={
        <>
          <AdminModalCancelButton onClick={onClose}>
            إلغاء
          </AdminModalCancelButton>
          <AdminModalPrimaryButton
            type="submit"
            form="assign-page-block-form"
            disabled={templatesLoading || Boolean(templatesError) || !assignableTemplates.length || !slotOptions.length || assignPending}
          >
            ربط الموديول
          </AdminModalPrimaryButton>
        </>
      }
    >
      <form
        id="assign-page-block-form"
        action={
          assignModuleKind === "hero"
            ? assignHeroAction
            : assignModuleKind === "media-sidebar"
              ? assignMediaSidebarAction
              : assignModuleKind === "media-hub"
                ? assignMediaHubAction
                : assignBlockAction
        }
        className={ADMIN_FORM_STACK_CLASS_NAME}
      >
        <input type="hidden" name="page_id" value={pageId} />
        {assignModuleKind !== "hero" &&
        assignModuleKind !== "media-sidebar" &&
        assignModuleKind !== "media-hub" ? (
          <input type="hidden" name="block_type" value={assignModuleKind} />
        ) : null}
        <input
          type="hidden"
          name="is_visible"
          value={assignVisible ? "true" : "false"}
        />

        <AdminFormPendingFields pending={assignPending} className="min-w-0">
        <div className={ADMIN_FORM_STACK_CLASS_NAME}>
        <AdminFormGrid columns={2}>
          <AdminCard presentation="premium" className="p-3 md:col-span-2">
            <AdminFormGrid columns={1} density="compact">
              <span id="assign-module-kind-label" className={adminFormLabelClassName({ textInset: true })}><span data-admin-form-label-text>نوع الموديول</span></span>
              <AdminListboxSelect
                disabled={assignPending}
                value={assignModuleKind}
                onChange={(value) => {
                  onAssignModuleKindChange(value as AssignableModuleKind);
                  onAssignTemplateIdChange(null);
                }}
                options={REGISTERED_SLOT_MODULE_KINDS.map((kind) => ({
                  value: kind,
                  label: moduleKindLabel(kind),
                }))}
                ariaLabelledBy="assign-module-kind-label"
              />
            </AdminFormGrid>
          </AdminCard>

          <AdminCard presentation="premium" className="p-3 md:col-span-2">
            <AdminFormGrid columns={1} density="compact">
              <AdminFormListboxSelect
                name="template_id"
                label="القالب"
                presentation="panel"
                required
                disabled={templatesLoading || Boolean(templatesError) || assignPending}
                loading={templatesLoading}
                error={templatesError}
                value={assignTemplateId ? String(assignTemplateId) : ""}
                onChange={(next) => {
                  const value = Number(next);
                  onAssignTemplateIdChange(
                    Number.isFinite(value) && value > 0 ? value : null,
                  );
                }}
                placeholder="اختر قالب موديول…"
                options={assignableTemplates.map((template) => ({
                  value: String(template.id),
                  label: `${template.name} (${getContentStatusMetadata(template.status).label})`,
                }))}
              />
              {templatesError ? (
                <AdminModalCancelButton onClick={onRetryTemplates}>
                  إعادة المحاولة
                </AdminModalCancelButton>
              ) : null}
              <AssignTemplateUsageWarning
                moduleKind={assignModuleKind}
                templateId={assignTemplateId}
                currentPageId={pageId}
              />
              <p className={adminFormHintClassName({ textInset: true })}>
                القوالب المرتبطة بهذه الصفحة لا تظهر في القائمة. لإعادة استخدام
                قالب، احذف الربط الحالي أو عدّله.
              </p>
              {!templatesLoading && !templatesError && !assignableTemplates.length ? (
                <p className={adminFormHintClassName({ textInset: true })}><span className="text-amber-200/70">
                  {assignModuleKind === "hero" && heroAssignmentExists ? (
                    "هذه الصفحة مرتبطة بهيرو واحد بالفعل. عدّل الربط الحالي أو أزله أولًا."
                  ) : templateOptions.length ? (
                    "كل القوالب مرتبطة بهذه الصفحة بالفعل."
                  ) : (
                    <>
                      لا توجد قوالب.{" "}
                      <Link
                        href={
                          assignModuleKind === "hero"
                            ? "/admin/pages-blocks/blocks/hero"
                            : blockModuleListHref(assignModuleKind as PageBlockType)
                        }
                        className="text-[#D8B87A] underline"
                      >
                        أنشئ موديولًا أولًا
                      </Link>
                    </>
                  )}
                </span></p>
              ) : null}
            </AdminFormGrid>
          </AdminCard>

          <AdminCard presentation="premium" className="p-3">
            <AdminFormListboxSelect
              name="slot"
              label="موضع العرض"
              presentation="panel"
              defaultValue={slotOptions[0] ?? ""}
              disabled={assignPending || slotOptions.length <= 1}
              options={slotOptions.map((slot) => ({
                value: slot,
                label: regionLabels[slot] ?? slot,
              }))}
              sizing="full"
            />
            {!slotOptions.length ? (
              <p className={adminFormHintClassName({ textInset: true })}><span className="text-amber-200/75">
                هذا النوع لا يملك Position متوافقًا مع بنية الصفحة الحالية.
              </span></p>
            ) : null}
          </AdminCard>

          {assignModuleKind === "hero" ? (
            <input type="hidden" name="sort_order" value="0" />
          ) : (
            <AdminCard presentation="premium" className="p-3">
              <AdminFormField label="Order" presentation="panel">
                <input
                  name="sort_order"
                  type="number"
                  min={0}
                  step={10}
                  placeholder="تلقائي"
                  className={adminFormFieldClassName()}
                />
              </AdminFormField>
            </AdminCard>
          )}

          <AdminCard presentation="premium" className="p-3 md:col-span-2">
            <AdminFormSwitch
              label={<span className={adminFormLabelClassName({ textInset: true })}><span data-admin-form-label-text>ظاهر على الموقع</span></span>}
              disabled={assignPending}
              checked={assignVisible}
              onChange={(event) => onAssignVisibleChange(event.target.checked)}
              embedded
            />
          </AdminCard>

          <p className={`${adminFormHintClassName({ textInset: true })} md:col-span-2`}><span className="text-amber-200/75">
            الربط الظاهر لا يكفي وحده — القالب يجب أن يكون{" "}
            <span className="font-semibold">منشورًا</span> ليظهر على الموقع العام.
          </span></p>

          {!assignState.ok && assignState.message ? (
            <p className="text-sm text-red-300 md:col-span-2">
              {assignState.message}
            </p>
          ) : null}
          {!assignHeroState.ok && assignHeroState.message ? (
            <p className="text-sm text-red-300 md:col-span-2">
              {assignHeroState.message}
            </p>
          ) : null}
          {!assignMediaSidebarState.ok && assignMediaSidebarState.message ? (
            <p className="text-sm text-red-300 md:col-span-2">
              {assignMediaSidebarState.message}
            </p>
          ) : null}
          {!assignMediaHubState.ok && assignMediaHubState.message ? (
            <p className="text-sm text-red-300 md:col-span-2">
              {assignMediaHubState.message}
            </p>
          ) : null}
        </AdminFormGrid>
        </div>
        </AdminFormPendingFields>
      </form>
    </VenesiaModal>
  );
}

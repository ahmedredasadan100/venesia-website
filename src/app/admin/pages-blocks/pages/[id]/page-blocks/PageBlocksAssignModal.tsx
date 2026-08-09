import Link from "next/link";

import AssignTemplateUsageWarning from "../../../../../../components/admin/page-blocks/AssignTemplateUsageWarning";
import {
  ADMIN_FORM,
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  VenesiaModal,
  adminFormFieldClassName,
  adminFormLabelClassName,
} from "../../../../../../components/admin/ui";
import { getContentStatusMetadata } from "../../../../../../lib/admin/content/content-status-metadata";
import type { PageBlockActionResult } from "../../../../../../lib/page-blocks/action-result";
import {
  blockModuleListHref,
  moduleKindLabel,
} from "../../../../../../lib/page-blocks/admin-utils";
import { LAYOUT_SLOT_LABELS_AR, type PageLayoutSlot } from "../../../../../../lib/page-blocks/layout-slots";
import type { PageBlockType } from "../../../../../../lib/page-blocks/types";
import type { AssignableModuleKind } from "./use-page-blocks-assign-modal";

type TemplateOption = { id: number; name: string; slug: string; status: string };

const slotLabels = LAYOUT_SLOT_LABELS_AR;
const ASSIGNABLE_MODULE_KINDS = [
  "hero",
  "breadcrumb",
  "content",
  "cta",
  "cards",
  "feed",
  "media-sidebar",
  "media-hub",
] as const satisfies readonly AssignableModuleKind[];

type PageBlocksAssignModalProps = {
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
  assignableTemplates: TemplateOption[];
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
  assignableTemplates,
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
      footer={(
        <>
          <AdminModalCancelButton onClick={onClose}>إلغاء</AdminModalCancelButton>
          <AdminModalPrimaryButton
            type="submit"
            form="assign-page-block-form"
            disabled={!assignableTemplates.length || assignPending}
          >
            ربط الموديول
          </AdminModalPrimaryButton>
        </>
      )}
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
          className={ADMIN_FORM.gridTwoCol}
        >
          <input type="hidden" name="page_id" value={pageId} />
          {assignModuleKind !== "hero" &&
          assignModuleKind !== "media-sidebar" &&
          assignModuleKind !== "media-hub" ? (
            <input type="hidden" name="block_type" value={assignModuleKind} />
          ) : null}
          <input type="hidden" name="is_visible" value={assignVisible ? "true" : "false"} />

          <label className={`${adminFormLabelClassName()} md:col-span-2`}>
            نوع الموديول
            <select
              value={assignModuleKind}
              onChange={(event) => {
                onAssignModuleKindChange(event.target.value as AssignableModuleKind);
                onAssignTemplateIdChange(null);
              }}
              className={adminFormFieldClassName()}
            >
              {ASSIGNABLE_MODULE_KINDS.map((kind) => (
                <option key={kind} value={kind}>{moduleKindLabel(kind)}</option>
              ))}
            </select>
          </label>

          <label className={`${adminFormLabelClassName()} md:col-span-2`}>
            القالب
            <select
              name="template_id"
              required
              className={adminFormFieldClassName()}
              defaultValue=""
              onChange={(event) => {
                const value = Number(event.currentTarget.value);
                onAssignTemplateIdChange(Number.isFinite(value) && value > 0 ? value : null);
              }}
            >
              <option value="" disabled>اختر قالب موديول…</option>
              {assignableTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} ({getContentStatusMetadata(template.status).label})
                </option>
              ))}
            </select>
            <AssignTemplateUsageWarning
              moduleKind={assignModuleKind}
              templateId={assignTemplateId}
              currentPageId={pageId}
            />
            <p className="text-xs leading-6 text-white/42">
              القوالب المرتبطة بهذه الصفحة لا تظهر في القائمة. لإعادة استخدام قالب، احذف الربط الحالي أو عدّله.
            </p>
            {!assignableTemplates.length ? (
              <p className="text-xs text-amber-200/70">
                {templateOptions.length
                  ? "كل القوالب مرتبطة بهذه الصفحة بالفعل."
                  : (
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
              </p>
            ) : null}
          </label>

          <label className={adminFormLabelClassName()}>
            Slot
            <select
              name="slot"
              defaultValue={
                assignModuleKind === "breadcrumb" || assignModuleKind === "hero"
                  ? "hero"
                  : assignModuleKind === "feed" || assignModuleKind === "media-sidebar"
                    ? "sidebar"
                    : assignModuleKind === "media-hub"
                      ? "main"
                      : "main"
              }
              className={adminFormFieldClassName()}
              disabled={assignModuleKind === "hero"}
            >
              {slotOptions.map((slot) => (
                <option key={slot} value={slot}>{slotLabels[slot] ?? slot}</option>
              ))}
            </select>
          </label>

          <label className={adminFormLabelClassName()}>
            Order
            <input name="sort_order" type="number" min={0} step={10} placeholder="تلقائي" className={adminFormFieldClassName()} />
          </label>

          <label className={`${ADMIN_FORM.checkboxRow} md:col-span-2`}>
            <span>ظاهر على الموقع</span>
            <input
              type="checkbox"
              checked={assignVisible}
              onChange={(event) => onAssignVisibleChange(event.target.checked)}
              className="h-4 w-4 accent-[#D8B87A]"
            />
          </label>

          <p className="text-xs leading-6 text-amber-200/75 md:col-span-2">
            الربط الظاهر لا يكفي وحده — القالب يجب أن يكون <span className="font-semibold">منشورًا</span> ليظهر على الموقع العام.
          </p>

          {!assignState.ok && assignState.message ? (
            <p className="text-sm text-red-300 md:col-span-2">{assignState.message}</p>
          ) : null}
          {!assignHeroState.ok && assignHeroState.message ? (
            <p className="text-sm text-red-300 md:col-span-2">{assignHeroState.message}</p>
          ) : null}
          {!assignMediaSidebarState.ok && assignMediaSidebarState.message ? (
            <p className="text-sm text-red-300 md:col-span-2">{assignMediaSidebarState.message}</p>
          ) : null}
          {!assignMediaHubState.ok && assignMediaHubState.message ? (
            <p className="text-sm text-red-300 md:col-span-2">{assignMediaHubState.message}</p>
          ) : null}

        </form>
    </VenesiaModal>
  );
}

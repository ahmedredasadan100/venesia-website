import Link from "next/link";

import AssignTemplateUsageWarning from "../../../../../../components/admin/page-blocks/AssignTemplateUsageWarning";
import type { PageBlockActionResult } from "../../../../../../lib/page-blocks/action-result";
import { blockModuleListHref, fieldClassName } from "../../../../../../lib/page-blocks/admin-utils";
import { LAYOUT_SLOT_LABELS_AR, type PageLayoutSlot } from "../../../../../../lib/page-blocks/layout-slots";
import type { PageBlockType } from "../../../../../../lib/page-blocks/types";
import type { AssignableModuleKind } from "./use-page-blocks-assign-modal";

type TemplateOption = { id: number; name: string; slug: string; status: string };

const slotLabels = LAYOUT_SLOT_LABELS_AR;

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="cursor-pointer rounded-xl border border-white/10 p-2 text-white/50 hover:text-white">
      ×
    </button>
  );
}

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
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[#080B10] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.5)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-xl font-semibold text-white">ربط بلوك بالصفحة</h3>
            <p className="mt-1 text-sm text-white/45">اختر قالبًا موجودًا — لن يُنشأ صف فارغ.</p>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <form
          action={
            assignModuleKind === "hero"
              ? assignHeroAction
              : assignModuleKind === "media-sidebar"
                ? assignMediaSidebarAction
                : assignModuleKind === "media-hub"
                  ? assignMediaHubAction
                  : assignBlockAction
          }
          className="mt-5 grid gap-4 md:grid-cols-2"
        >
          <input type="hidden" name="page_id" value={pageId} />
          {assignModuleKind !== "hero" &&
          assignModuleKind !== "media-sidebar" &&
          assignModuleKind !== "media-hub" ? (
            <input type="hidden" name="block_type" value={assignModuleKind} />
          ) : null}
          <input type="hidden" name="is_visible" value={assignVisible ? "true" : "false"} />

          <label className="space-y-2 md:col-span-2">
            <span className="text-xs font-semibold text-white/55">نوع الموديول</span>
            <select
              value={assignModuleKind}
              onChange={(event) => {
                onAssignModuleKindChange(event.target.value as AssignableModuleKind);
                onAssignTemplateIdChange(null);
              }}
              className={fieldClassName()}
            >
              <option value="hero">Hero</option>
              <option value="breadcrumb">Breadcrumb</option>
              <option value="content">Content</option>
              <option value="cta">CTA</option>
              <option value="cards">Cards</option>
              <option value="feed">Feed</option>
              <option value="media-sidebar">Media Sidebar</option>
              <option value="media-hub">Media Hub</option>
            </select>
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-xs font-semibold text-white/55">القالب</span>
            <select
              name="template_id"
              required
              className={fieldClassName()}
              defaultValue=""
              onChange={(event) => {
                const value = Number(event.currentTarget.value);
                onAssignTemplateIdChange(Number.isFinite(value) && value > 0 ? value : null);
              }}
            >
              <option value="" disabled>اختر قالبًا…</option>
              {assignableTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} ({template.status})
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

          <label className="space-y-2">
            <span className="text-xs font-semibold text-white/55">Slot</span>
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
              className={fieldClassName()}
              disabled={assignModuleKind === "hero"}
            >
              {slotOptions.map((slot) => (
                <option key={slot} value={slot}>{slotLabels[slot] ?? slot}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold text-white/55">Order</span>
            <input name="sort_order" type="number" min={0} step={10} placeholder="تلقائي" className={fieldClassName()} />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white/70 md:col-span-2">
            <span>ظاهر على الموقع</span>
            <input
              type="checkbox"
              checked={assignVisible}
              onChange={(event) => onAssignVisibleChange(event.target.checked)}
              className="accent-[#D8B87A]"
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

          <div className="flex justify-end gap-3 md:col-span-2">
            <button type="button" onClick={onClose} className="cursor-pointer rounded-2xl border border-white/10 px-5 py-3 text-sm text-white/60 hover:bg-white/5 hover:text-white">
              إلغاء
            </button>
            <button disabled={!assignableTemplates.length || assignPending} className="cursor-pointer rounded-2xl bg-[#D8B87A] px-5 py-3 text-sm font-bold text-[#06101C] hover:bg-[#e5c98d] disabled:cursor-not-allowed disabled:opacity-40">
              ربط البلوك
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

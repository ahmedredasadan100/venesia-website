"use client";

import { ADMIN_FORM_STACK_CLASS_NAME } from "../../../../components/admin/ui/AdminForm";
import {
  AdminActionButton,
  AdminFormField,
  AdminFormGrid,
  AdminFormSection,
  AdminFormSwitch,
  AdminStatusPill,
} from "../../../../components/admin/ui";
import FooterBlockHeader from "../../../../components/footer/FooterBlockHeader";
import {
  adminFormFieldClassName,
} from "../../../../lib/admin/admin-ui-styles";
import type {
  FooterBlockType,
  FooterSlot,
  FooterSlotIndex,
} from "../../../../lib/footer/footer-slot-types";
import { FOOTER_SLOT_INDICES } from "../../../../lib/footer/footer-slot-types";

import type { FooterMenuOption, FooterQuickLinkInput } from "./actions";
import {
  FOOTER_BLOCK_TYPE_LABELS,
  FOOTER_COLUMN_LABELS,
} from "./footer-builder-labels";
import {
  getFooterSlotBlockTitle,
  getFooterSlotBrandIcon,
} from "./footer-block-header-utils";
import { changeSlotType, duplicateSlotConfig } from "./footer-builder-utils";
import FooterSlotConfigFields, {
  BlockTypeSelect,
} from "./FooterSlotConfigFields";

type FooterSlotEditorCardProps = {
  slot: FooterSlot;
  slots: FooterSlot[];
  onSlotsChange: (slots: FooterSlot[]) => void;
  onMoveSlot: (index: FooterSlotIndex, direction: "earlier" | "later") => void;
  footerMenuId: number | null;
  quickLinks: FooterQuickLinkInput[];
  menuOptions: FooterMenuOption[];
};

export default function FooterSlotEditorCard({
  slot,
  slots,
  onSlotsChange,
  onMoveSlot,
  footerMenuId,
  quickLinks,
  menuOptions,
}: FooterSlotEditorCardProps) {
  const index = slot.index as FooterSlotIndex;
  const position = FOOTER_SLOT_INDICES.indexOf(index);
  const blockTitle = getFooterSlotBlockTitle(slot);
  const showBrandIcon = getFooterSlotBrandIcon(slot);

  function updateSlot(next: FooterSlot) {
    onSlotsChange(slots.map((item) => (item.index === index ? next : item)));
  }

  function updateHeading(value: string) {
    onSlotsChange(
      slots.map((item) =>
        item.index === index
          ? { ...item, heading: value.length ? value : null }
          : item,
      ),
    );
  }

  function handleTypeChange(type: FooterBlockType) {
    onSlotsChange(changeSlotType(slots, index, type));
  }

  function handleDuplicateFrom(fromIndex: FooterSlotIndex) {
    onSlotsChange(duplicateSlotConfig(slots, fromIndex, index));
  }

  const duplicateOptions = FOOTER_SLOT_INDICES.filter((item) => item !== index);

  return (
    <AdminFormSection>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D8B87A]/70">
            {FOOTER_COLUMN_LABELS[index]}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusPill tone={slot.enabled ? "green" : "muted"}>
              {slot.enabled ? "Active" : "Disabled"}
            </AdminStatusPill>
            <AdminStatusPill tone="gold">
              {FOOTER_BLOCK_TYPE_LABELS[slot.type]}
            </AdminStatusPill>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AdminFormSwitch
            label="تفعيل العمود"
            checked={slot.enabled}
            onChange={(event) =>
              updateSlot({ ...slot, enabled: event.target.checked })
            }
            surface
          />
        </div>
      </div>

      <div className={ADMIN_FORM_STACK_CLASS_NAME}>
        <AdminFormSection title="معاينة رأس العمود" description="النص التمهيدي والعنوان وفق إعدادات العمود الحالية.">
          <FooterBlockHeader
            variant="admin"
            eyebrow={slot.heading}
            title={blockTitle}
            icon={showBrandIcon ? "brand" : "none"}
            className="mt-3"
          />
          {!slot.heading?.trim() && !blockTitle && !showBrandIcon ? (
            <p className="mt-3 text-sm text-white/40">
              لا يوجد عنوان معروض — أضف تسمية قسم أو عنوان رئيسي حسب نوع البلوك.
            </p>
          ) : null}
        </AdminFormSection>

        <AdminFormGrid columns={2} presentation="aligned-fields">
          <BlockTypeSelect value={slot.type} onChange={handleTypeChange} />
          <AdminFormField label="النص التمهيدي — اختياري">
            <input
              value={slot.heading ?? ""}
              onChange={(event) => updateHeading(event.target.value)}
              className={adminFormFieldClassName()}
              dir="rtl"
              placeholder="يُترك فارغًا لإخفاء التسمية الذهبية"
            />
          </AdminFormField>
        </AdminFormGrid>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/8 pt-4">
          <span className="text-xs text-white/45">نسخ إعدادات من:</span>
          {duplicateOptions.map((fromIndex) => (
            <AdminActionButton
              key={fromIndex}
              variant="dark"
              className="!min-h-9 !px-3 !py-2 text-xs"
              onClick={() => handleDuplicateFrom(fromIndex)}
            >
              {FOOTER_COLUMN_LABELS[fromIndex]}
            </AdminActionButton>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AdminActionButton
            variant="dark"
            className="!min-h-9 !px-3 !py-2 text-xs"
            disabled={position <= 0}
            onClick={() => onMoveSlot(index, "earlier")}
          >
            تحريك للأمام
          </AdminActionButton>
          <AdminActionButton
            variant="dark"
            className="!min-h-9 !px-3 !py-2 text-xs"
            disabled={
              position === -1 || position >= FOOTER_SLOT_INDICES.length - 1
            }
            onClick={() => onMoveSlot(index, "later")}
          >
            تحريك للخلف
          </AdminActionButton>
        </div>

        {slot.enabled ? (
          <div className="border-t border-white/8 pt-4">
            <FooterSlotConfigFields
              slot={slot}
              onChange={updateSlot}
              footerMenuId={footerMenuId}
              quickLinks={quickLinks}
              menuOptions={menuOptions}
            />
          </div>
        ) : (
          <p className="rounded-[22px] border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/45">
            العمود معطّل ولن يظهر في الفوتر العام.
          </p>
        )}
      </div>
    </AdminFormSection>
  );
}

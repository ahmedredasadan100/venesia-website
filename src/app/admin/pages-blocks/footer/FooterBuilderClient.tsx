"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import AdminModuleTabs from "../../../../components/admin/page-blocks/AdminModuleTabs";
import { AdminActionButton, AdminCard, AdminPageHeader, AdminStatusPill } from "../../../../components/admin/ui";
import FooterBlockHeader from "../../../../components/footer/FooterBlockHeader";
import { ADMIN_LIST_PAGE } from "../../../../lib/admin/admin-ui-styles";
import type { FooterSlot, FooterSlotIndex } from "../../../../lib/footer/footer-slot-types";
import { FOOTER_SLOT_INDICES } from "../../../../lib/footer/footer-slot-types";
import type { FooterSettings } from "../../../../lib/footer/types";

import {
  restoreDefaultFooterAction,
  saveFooterBuilderAction,
  type FooterMenuOption,
  type FooterQuickLinkInput,
} from "./actions";
import { FOOTER_BLOCK_TYPE_LABELS, FOOTER_COLUMN_LABELS } from "./footer-builder-labels";
import { getFooterSlotBlockTitle, getFooterSlotBrandIcon } from "./footer-block-header-utils";
import { moveFooterSlotInOrder, normalizeSlotsForSave } from "./footer-builder-utils";
import { ContactItemsField, LegalFields, RestoreConfirmModal, SocialLinksField } from "./FooterBuilderEditors";
import FooterSlotEditorCard from "./FooterSlotEditorCard";

type FooterMenuItemRow = {
  id: number;
  label: string;
  href: string;
  sortOrder: number;
  visible: boolean;
};

type FooterBuilderClientProps = {
  settings: FooterSettings;
  footerMenuId: number | null;
  quickLinkItems: FooterMenuItemRow[];
  menuOptions: FooterMenuOption[];
  saved?: boolean;
};

export default function FooterBuilderClient({
  settings,
  footerMenuId,
  quickLinkItems,
  menuOptions,
  saved,
}: FooterBuilderClientProps) {
  const router = useRouter();
  const [slots, setSlots] = useState<FooterSlot[]>(() => structuredClone(settings.slots.slots));
  const [contactItems, setContactItems] = useState(() => structuredClone(settings.contactItems));
  const [socialLinks, setSocialLinks] = useState(() => structuredClone(settings.socialLinks));
  const [legal, setLegal] = useState(() => structuredClone(settings.legal));
  const quickLinks = useMemo<FooterQuickLinkInput[]>(
    () =>
      quickLinkItems.map((item) => ({
        id: item.id,
        label: item.label,
        href: item.href,
        sortOrder: item.sortOrder,
        visible: item.visible,
      })),
    [quickLinkItems],
  );

  const [message, setMessage] = useState<string | null>(saved ? "تم حفظ إعدادات الفوتر بنجاح." : null);
  const [error, setError] = useState<string | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const slotsSourceKey = JSON.stringify(settings.slots.slots);
  const [lastSlotsSourceKey, setLastSlotsSourceKey] = useState(slotsSourceKey);
  if (slotsSourceKey !== lastSlotsSourceKey) {
    setLastSlotsSourceKey(slotsSourceKey);
    setSlots(structuredClone(settings.slots.slots));
  }

  const summary = useMemo(
    () =>
      FOOTER_SLOT_INDICES.map((index) => {
        const slot = slots.find((item) => item.index === index);
        const type = slot?.type ?? "text";

        return {
          index,
          enabled: slot?.enabled ?? false,
          type,
          eyebrow: slot?.heading ?? null,
          title: slot ? getFooterSlotBlockTitle(slot) : null,
          showBrandIcon: slot ? getFooterSlotBrandIcon(slot) : false,
        };
      }),
    [slots],
  );

  function resetAlerts() {
    setMessage(null);
    setError(null);
  }

  function handleSave() {
    resetAlerts();
    startTransition(async () => {
      try {
        await saveFooterBuilderAction({
          slots: normalizeSlotsForSave(slots),
          contactItems,
          socialLinks,
          legal,
        });
        setMessage("تم حفظ إعدادات الفوتر بنجاح.");
        router.refresh();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "تعذر حفظ إعدادات الفوتر.");
      }
    });
  }

  function handleRestore() {
    resetAlerts();
    startTransition(async () => {
      try {
        const result = await restoreDefaultFooterAction();
        setSlots(structuredClone(result.slots.slots));
        setRestoreOpen(false);
        setMessage("تمت استعادة تخطيط الفوتر الافتراضي بنجاح.");
      } catch (restoreError) {
        setError(restoreError instanceof Error ? restoreError.message : "تعذر استعادة الفوتر الافتراضي.");
      }
    });
  }

  const slotsSourceLabel =
    settings.slotsSource === "database"
      ? "قاعدة البيانات"
      : settings.slotsSource === "legacy"
        ? "Legacy"
        : "افتراضي";

  function handleMoveSlot(index: FooterSlotIndex, direction: "earlier" | "later") {
    setSlots((current) => moveFooterSlotInOrder(current, index, direction));
  }

  const sortedSlots = useMemo(
    () => slots.slice().sort((a, b) => a.index - b.index),
    [slots],
  );

  const editorTabs = useMemo(
    () => [
      ...sortedSlots.map((slot) => {
        const index = slot.index as FooterSlotIndex;
        return {
          id: `column-${index}`,
          label: FOOTER_COLUMN_LABELS[index],
          content: (
            <FooterSlotEditorCard
              slot={slot}
              slots={slots}
              onSlotsChange={setSlots}
              onMoveSlot={handleMoveSlot}
              footerMenuId={footerMenuId}
              quickLinks={quickLinks}
              menuOptions={menuOptions}
            />
          ),
        };
      }),
      {
        id: "contact-data",
        label: "بيانات التواصل",
        content: (
          <AdminCard className="p-5 md:p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-white">بيانات التواصل العامة</h2>
              <p className="mt-1 text-sm text-white/50">
                تُستخدم في أي عمود تواصل يعتمد على «المجموعة العامة».
              </p>
            </div>
            <ContactItemsField
              items={contactItems}
              onChange={setContactItems}
              hint="أضف أو عدّل عناصر التواصل ورتّبها. التغييرات تُحفظ مع زر «حفظ الفوتر»."
            />
          </AdminCard>
        ),
      },
      {
        id: "social-legal",
        label: "السوشيال والقانوني",
        content: (
          <AdminCard className="p-5 md:p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-white">شريط السوشيال والحقوق</h2>
              <p className="mt-1 text-sm text-white/50">
                هذه الإعدادات تخص FooterSocialBar أسفل الأعمدة وليست جزءًا من الأعمدة الأربعة.
              </p>
            </div>
            <div className="space-y-6">
              <SocialLinksField links={socialLinks} onChange={setSocialLinks} />
              <LegalFields legal={legal} onChange={setLegal} />
            </div>
          </AdminCard>
        ),
      },
    ],
    [contactItems, footerMenuId, legal, menuOptions, quickLinks, slots, socialLinks, sortedSlots],
  );

  return (
    <div className={ADMIN_LIST_PAGE.wrapper} dir="rtl">
      <AdminPageHeader
        eyebrow="Footer Builder"
        title="منشئ الفوتر"
        description="أدر الأعمدة الأربعة للفوتر العام بحرية: غيّر نوع أي عمود، أعد ترتيب الأعمدة، واضبط المحتوى — مع الحفاظ على نفس تصميم الفوتر العام."
        meta={`مصدر الأعمدة: ${slotsSourceLabel}`}
        actions={
          <>
            <AdminActionButton variant="dark" onClick={() => setRestoreOpen(true)} disabled={isPending}>
              استعادة الافتراضي
            </AdminActionButton>
            <AdminActionButton variant="primary" onClick={handleSave} disabled={isPending}>
              {isPending ? "جارٍ الحفظ..." : "حفظ الفوتر"}
            </AdminActionButton>
          </>
        }
      />

      {settings.usesFallback ? (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          تنبيه: بعض مفاتيح الفوتر تُقرأ من fallback — راجع seed/migration عند الحاجة.
        </div>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <AdminCard className="p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">ملخص الأعمدة والترتيب</h2>
            <p className="mt-1 text-sm text-white/50">
              الترتيب هنا يطابق عرض الفوتر العام من اليمين إلى اليسار. غيّر نوع العمود من بطاقته، أو بدّل الترتيب من الأسهم.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summary.map((item, position) => (
            <div
              key={item.index}
              className="rounded-[22px] border border-white/10 bg-white/[0.02] px-4 py-4"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-[#D8B87A]/75">
                  {FOOTER_COLUMN_LABELS[item.index as FooterSlotIndex]}
                </p>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    aria-label={`تحريك ${FOOTER_COLUMN_LABELS[item.index as FooterSlotIndex]} للأمام`}
                    disabled={position === 0 || isPending}
                    onClick={() => handleMoveSlot(item.index as FooterSlotIndex, "earlier")}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-xs text-white/55 transition-colors hover:border-white/20 hover:text-white/85 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    aria-label={`تحريك ${FOOTER_COLUMN_LABELS[item.index as FooterSlotIndex]} للخلف`}
                    disabled={position === summary.length - 1 || isPending}
                    onClick={() => handleMoveSlot(item.index as FooterSlotIndex, "later")}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-xs text-white/55 transition-colors hover:border-white/20 hover:text-white/85 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    ‹
                  </button>
                </div>
              </div>
              <div className="mt-3 min-h-[52px]">
                <FooterBlockHeader
                  variant="admin"
                  eyebrow={item.eyebrow}
                  title={item.title}
                  icon={item.showBrandIcon ? "brand" : "none"}
                />
                {!item.eyebrow?.trim() && !item.title?.trim() && !item.showBrandIcon ? (
                  <p className="text-xs text-white/40">{FOOTER_BLOCK_TYPE_LABELS[item.type]}</p>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <AdminStatusPill tone={item.enabled ? "green" : "muted"}>
                  {item.enabled ? "Active" : "Disabled"}
                </AdminStatusPill>
                <AdminStatusPill tone="gold">{FOOTER_BLOCK_TYPE_LABELS[item.type]}</AdminStatusPill>
              </div>
            </div>
          ))}
        </div>
      </AdminCard>

      <AdminCard className="p-5 md:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-white">تحرير الأعمدة والإعدادات</h2>
          <p className="mt-1 text-sm text-white/50">
            افتح التبويب الذي تريد تعديله فقط. التنقل بين التبويبات لا يمس التعديلات غير المحفوظة.
          </p>
        </div>
        <AdminModuleTabs tabs={editorTabs} />
      </AdminCard>

      <div className="flex justify-end">
        <AdminActionButton variant="primary" onClick={handleSave} disabled={isPending}>
          {isPending ? "جارٍ الحفظ..." : "حفظ الفوتر"}
        </AdminActionButton>
      </div>

      <RestoreConfirmModal
        open={restoreOpen}
        onClose={() => setRestoreOpen(false)}
        onConfirm={handleRestore}
        pending={isPending}
      />
    </div>
  );
}

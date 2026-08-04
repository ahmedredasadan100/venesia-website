"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { AdminFeedbackRegion } from "../../../../components/admin/AdminFeedbackProvider";
import AdminModuleTabs from "../../../../components/admin/ui/AdminModuleTabs";
import {
  AdminActionButton,
  AdminCard,
  AdminConfirmDialog,
  AdminPageExperience,
  AdminPageHeader,
  AdminStatusPill,
} from "../../../../components/admin/ui";
import FooterBlockHeader from "../../../../components/footer/FooterBlockHeader";
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
import { ContactItemsField, LegalFields, SocialLinksField } from "./FooterBuilderEditors";
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
  const [messageWarning, setMessageWarning] = useState(false);
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
    setMessageWarning(false);
    setError(null);
  }

  function handleSave() {
    resetAlerts();
    startTransition(async () => {
      try {
        const result = await saveFooterBuilderAction({
          slots: normalizeSlotsForSave(slots),
          contactItems,
          socialLinks,
          legal,
        });
        const warning = result.status === "warning";
        setMessageWarning(warning);
        setMessage(
          warning
            ? "تم حفظ إعدادات الفوتر، لكن تعذرت مزامنة ارتباطات الميديا. يظل الحذف الآمن متوقفًا."
            : "تم حفظ إعدادات الفوتر بنجاح.",
        );
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
        const warning = result.status === "warning";
        setMessageWarning(warning);
        setMessage(
          warning
            ? "تمت استعادة التخطيط، لكن تعذرت مزامنة ارتباطات الميديا. يظل الحذف الآمن متوقفًا."
            : "تمت استعادة تخطيط الفوتر الافتراضي بنجاح.",
        );
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
      {
        id: "overview",
        navigationLabel: "نظرة عامة",
        sectionHeading: "ملخص الأعمدة والترتيب",
        sectionDescription:
          "راجع ترتيب الأعمدة وحالتها قبل فتح العمود الذي تريد تعديله.",
        icon: "overview" as const,
        content: (
          <AdminCard className="p-5 md:p-6">
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
        ),
      },
      ...sortedSlots.map((slot) => {
        const index = slot.index as FooterSlotIndex;
        return {
          id: `column-${index}`,
          navigationLabel: FOOTER_COLUMN_LABELS[index],
          sectionHeading: `تحرير ${FOOTER_COLUMN_LABELS[index]}`,
          sectionDescription: "اضبط نوع العمود ومحتواه وحالة ظهوره مع الحفاظ على ترتيب الفوتر العام.",
          icon: "section" as const,
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
        navigationLabel: "بيانات التواصل",
        sectionHeading: "بيانات التواصل العامة",
        sectionDescription: "أدر عناصر التواصل التي تستخدمها أعمدة الفوتر المرتبطة بالمجموعة العامة.",
        icon: "location" as const,
        content: (
          <AdminCard className="p-5 md:p-6">
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
        navigationLabel: "السوشيال والقانوني",
        sectionHeading: "شريط السوشيال والحقوق",
        sectionDescription: "أدر روابط الشبكات الاجتماعية والنصوص القانونية الظاهرة أسفل أعمدة الفوتر.",
        icon: "content" as const,
        content: (
          <AdminCard className="p-5 md:p-6">
            <div className="space-y-6">
              <SocialLinksField links={socialLinks} onChange={setSocialLinks} />
              <LegalFields legal={legal} onChange={setLegal} />
            </div>
          </AdminCard>
        ),
      },
    ],
    [contactItems, footerMenuId, isPending, legal, menuOptions, quickLinks, slots, socialLinks, sortedSlots, summary],
  );

  return (
    <AdminPageExperience dir="rtl">
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

      <AdminModuleTabs
        tabs={editorTabs}
        activePanelContext={
          <AdminFeedbackRegion
            channel="footer-builder"
            label="نتائج إجراءات منشئ الفوتر"
            feedback={
              error
                ? {
                    variant: "danger",
                    title: "تعذر تنفيذ الإجراء",
                    message: error,
                    layout: "inline",
                    dismissible: true,
                    lifecycle: "manual",
                  }
                : message
                  ? {
                      variant: messageWarning ? "warning" : "success",
                      title: messageWarning ? "تم التنفيذ مع تنبيه" : "تم تنفيذ الإجراء",
                      message,
                      layout: "inline",
                      dismissible: true,
                      lifecycle: "manual",
                      ...(saved ? { dismissSearchParams: ["saved"] } : {}),
                    }
                  : settings.usesFallback
                    ? {
                        variant: "warning",
                        title: "تنبيه مصدر إعدادات الفوتر",
                        message: "بعض مفاتيح الفوتر تُقرأ من fallback — راجع seed/migration عند الحاجة.",
                        layout: "inline",
                        dismissible: true,
                        lifecycle: "persistent",
                      }
                    : null
            }
          />
        }
      />

      <AdminConfirmDialog
        open={restoreOpen}
        title="استعادة الفوتر الافتراضي"
        description="سيتم استبدال تخطيط الأعمدة الأربعة والعناوين المرتبطة بالقيم الافتراضية. لن تُحذف بيانات التواصل أو السوشيال أو الحقوق."
        confirmLabel="تأكيد الاستعادة"
        onCancel={() => setRestoreOpen(false)}
        onConfirm={handleRestore}
        pending={isPending}
      />
    </AdminPageExperience>
  );
}

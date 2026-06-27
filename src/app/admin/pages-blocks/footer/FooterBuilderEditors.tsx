"use client";

import VenesiaModal, { adminFormFieldClassName } from "../../../../components/admin/VenesiaModal";
import { AdminActionButton } from "../../../../components/admin/ui";
import { ADMIN_FORM, adminFormHintClassName, adminFormLabelClassName } from "../../../../lib/admin/admin-ui-styles";
import type { FooterContactItem, FooterLegal, FooterSocialLink } from "../../../../lib/footer/types";
import type { FooterManualLink } from "../../../../lib/footer/footer-slot-types";
import { isSocialPlatform } from "../../../../lib/footer/defaults";

import type { FooterQuickLinkInput } from "./actions";
import FooterLinksDataGrid from "./FooterLinksDataGrid";
import FooterMenuPreviewDataGrid from "./FooterMenuPreviewDataGrid";

const SOCIAL_PLATFORM_OPTIONS = [
  ["facebook", "Facebook"],
  ["instagram", "Instagram"],
  ["tiktok", "TikTok"],
  ["youtube", "YouTube"],
  ["whatsapp", "WhatsApp"],
  ["location", "Location"],
] as const;

function emptyContactRow(): FooterContactItem {
  return { label: "", value: "", href: "", icon: "", visible: true };
}

function emptySocialRow(): FooterSocialLink {
  return { platform: "whatsapp", label: "", href: "", visible: true };
}

type ContactItemsFieldProps = {
  items: FooterContactItem[];
  onChange: (items: FooterContactItem[]) => void;
  hint?: string;
};

export function ContactItemsField({ items, onChange, hint }: ContactItemsFieldProps) {
  const rows = items.length ? items : [emptyContactRow()];

  return (
    <div className="space-y-3">
      {hint ? <p className={adminFormHintClassName()}>{hint}</p> : null}
      {rows.map((item, index) => (
        <div
          key={`contact-${index}`}
          className="space-y-3 rounded-[22px] border border-white/10 bg-white/[0.02] p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-white/75">عنصر #{index + 1}</p>
            <AdminActionButton
              variant="ghost"
              className="!min-h-8 !px-3 !py-1.5 text-xs text-red-300"
              onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
            >
              حذف
            </AdminActionButton>
          </div>
          <div className={ADMIN_FORM.gridTwoCol}>
            <label className={adminFormLabelClassName()}>
              <span>التسمية</span>
              <input
                value={item.label}
                onChange={(event) =>
                  onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, label: event.target.value } : row)))
                }
                className={adminFormFieldClassName()}
                dir="rtl"
              />
            </label>
            <label className={adminFormLabelClassName()}>
              <span>القيمة</span>
              <input
                value={item.value}
                onChange={(event) =>
                  onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, value: event.target.value } : row)))
                }
                className={adminFormFieldClassName()}
                dir="rtl"
              />
            </label>
            <label className={`${adminFormLabelClassName()} md:col-span-2`}>
              <span>الرابط (اختياري)</span>
              <input
                value={item.href ?? ""}
                onChange={(event) =>
                  onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, href: event.target.value } : row)))
                }
                className={adminFormFieldClassName()}
                dir="ltr"
              />
            </label>
            <label className={adminFormLabelClassName()}>
              <span>أيقونة (اختياري)</span>
              <input
                value={item.icon ?? ""}
                onChange={(event) =>
                  onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, icon: event.target.value } : row)))
                }
                className={adminFormFieldClassName()}
              />
            </label>
            <label className={ADMIN_FORM.checkboxRow}>
              <span>إظهار</span>
              <input
                type="checkbox"
                checked={item.visible !== false}
                onChange={(event) =>
                  onChange(
                    rows.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, visible: event.target.checked } : row,
                    ),
                  )
                }
                className="h-4 w-4 accent-[#D8B87A]"
              />
            </label>
          </div>
        </div>
      ))}
      <AdminActionButton variant="gold" onClick={() => onChange([...rows, emptyContactRow()])}>
        + إضافة عنصر تواصل
      </AdminActionButton>
    </div>
  );
}

type ManualLinksFieldProps = {
  links: FooterManualLink[];
  onChange: (links: FooterManualLink[]) => void;
};

export function ManualLinksField({ links, onChange }: ManualLinksFieldProps) {
  return <FooterLinksDataGrid links={links.length ? links : []} onChange={onChange} />;
}

type QuickLinksFieldProps = {
  footerMenuId: number | null;
  links: FooterQuickLinkInput[];
};

export function QuickLinksField({ footerMenuId, links }: QuickLinksFieldProps) {
  return <FooterMenuPreviewDataGrid footerMenuId={footerMenuId} links={links} />;
}

type SocialLinksFieldProps = {
  links: FooterSocialLink[];
  onChange: (links: FooterSocialLink[]) => void;
};

export function SocialLinksField({ links, onChange }: SocialLinksFieldProps) {
  const rows = links.length ? links : [emptySocialRow()];

  return (
    <div className="space-y-3">
      {rows.map((item, index) => (
        <div
          key={`social-${index}`}
          className="space-y-3 rounded-[22px] border border-white/10 bg-white/[0.02] p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-white/75">رابط #{index + 1}</p>
            <AdminActionButton
              variant="ghost"
              className="!min-h-8 !px-3 !py-1.5 text-xs text-red-300"
              onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
            >
              حذف
            </AdminActionButton>
          </div>
          <div className={ADMIN_FORM.gridTwoCol}>
            <label className={adminFormLabelClassName()}>
              <span>المنصة</span>
              <select
                value={item.platform}
                onChange={(event) => {
                  const platform = isSocialPlatform(event.target.value) ? event.target.value : "facebook";
                  onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, platform } : row)));
                }}
                className={adminFormFieldClassName()}
              >
                {SOCIAL_PLATFORM_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className={adminFormLabelClassName()}>
              <span>التسمية</span>
              <input
                value={item.label}
                onChange={(event) =>
                  onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, label: event.target.value } : row)))
                }
                className={adminFormFieldClassName()}
                dir="rtl"
              />
            </label>
            <label className={`${adminFormLabelClassName()} md:col-span-2`}>
              <span>الرابط</span>
              <input
                value={item.href}
                onChange={(event) =>
                  onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, href: event.target.value } : row)))
                }
                className={adminFormFieldClassName()}
                dir="ltr"
              />
            </label>
            <label className={`${ADMIN_FORM.checkboxRow} md:col-span-2`}>
              <span>إظهار في الشريط السفلي</span>
              <input
                type="checkbox"
                checked={item.visible !== false}
                onChange={(event) =>
                  onChange(
                    rows.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, visible: event.target.checked } : row,
                    ),
                  )
                }
                className="h-4 w-4 accent-[#D8B87A]"
              />
            </label>
          </div>
        </div>
      ))}
      <AdminActionButton variant="gold" onClick={() => onChange([...rows, emptySocialRow()])}>
        + إضافة رابط سوشيال
      </AdminActionButton>
    </div>
  );
}

type LegalFieldsProps = {
  legal: FooterLegal;
  onChange: (legal: FooterLegal) => void;
};

export function LegalFields({ legal, onChange }: LegalFieldsProps) {
  return (
    <div className={ADMIN_FORM.gridTwoCol}>
      <label className={adminFormLabelClassName()}>
        <span>Copyright</span>
        <input
          value={legal.copyright}
          onChange={(event) => onChange({ ...legal, copyright: event.target.value })}
          className={adminFormFieldClassName()}
        />
      </label>
      <label className={adminFormLabelClassName()}>
        <span>Legal Tagline</span>
        <input
          value={legal.tagline}
          onChange={(event) => onChange({ ...legal, tagline: event.target.value })}
          className={adminFormFieldClassName()}
        />
      </label>
    </div>
  );
}

type RestoreConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
};

export function RestoreConfirmModal({ open, onClose, onConfirm, pending }: RestoreConfirmModalProps) {
  return (
    <VenesiaModal
      open={open}
      title="استعادة الفوتر الافتراضي"
      description="سيتم استبدال تخطيط الأعمدة الأربعة والعناوين المرتبطة بالقيم الافتراضية. لن تُحذف بيانات التواصل أو السوشيال أو الحقوق."
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 px-4 py-2.5 text-sm text-white/70">
            إلغاء
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className="rounded-2xl border border-red-400/30 bg-red-500/15 px-4 py-2.5 text-sm font-semibold text-red-100 disabled:opacity-50"
          >
            تأكيد الاستعادة
          </button>
        </>
      }
    >
      <p className="text-sm text-white/60">هل تريد المتابعة؟</p>
    </VenesiaModal>
  );
}

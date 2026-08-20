"use client";

import { adminFormFieldClassName } from "../../../../components/admin/VenesiaModal";
import {
  AdminActionButton,
  AdminFormSwitch,
  AdminListboxSelect,
} from "../../../../components/admin/ui";
import {
  ADMIN_FORM,
  adminFormHintClassName,
  adminFormLabelClassName,
} from "../../../../lib/admin/admin-ui-styles";
import type {
  FooterContactItem,
  FooterLegal,
  FooterSocialLink,
} from "../../../../lib/footer/types";
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

export function ContactItemsField({
  items,
  onChange,
  hint,
}: ContactItemsFieldProps) {
  const rows = items.length ? items : [emptyContactRow()];

  function updateRow(index: number, patch: Partial<FooterContactItem>) {
    onChange(
      rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );
  }

  return (
    <div className="space-y-3">
      {hint ? <p className={adminFormHintClassName()}>{hint}</p> : null}
      {rows.map((item, index) => (
        <div
          key={`contact-row-${index}`}
          className={`space-y-3 rounded-[22px] border border-white/10 bg-white/[0.02] p-4 ${
            item.visible === false ? "opacity-55" : ""
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-white/75">
              عنصر #{index + 1}
              {item.visible === false ? (
                <span className="ms-2 text-xs font-normal text-white/40">
                  (مخفي في الفوتر)
                </span>
              ) : null}
            </p>
            <AdminActionButton
              variant="ghost"
              className="!min-h-8 !px-3 !py-1.5 text-xs text-red-300"
              onClick={() =>
                onChange(rows.filter((_, rowIndex) => rowIndex !== index))
              }
            >
              حذف
            </AdminActionButton>
          </div>

          <div className="rounded-2xl border border-white/8 bg-[#05070B]/70 px-4 py-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
              معاينة
            </p>
            <div className="text-[13px] text-white/50">
              {item.icon?.trim() || item.label?.trim() ? (
                <div className="flex items-center gap-2">
                  {item.icon?.trim() ? (
                    <span className="shrink-0 text-[#D8B87A]/50">
                      {item.icon.trim()}
                    </span>
                  ) : null}
                  {item.label?.trim() ? (
                    <span className="text-[11px] font-medium text-white/45">
                      {item.label.trim()}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {item.value?.trim() ? (
                <p
                  className={`break-all text-white/55 ${item.icon?.trim() || item.label?.trim() ? "mt-1" : ""}`}
                >
                  {item.value.trim()}
                </p>
              ) : !item.icon?.trim() && !item.label?.trim() ? (
                <p className="text-white/30">بدون محتوى</p>
              ) : null}
            </div>
          </div>

          <div className={ADMIN_FORM.gridTwoCol}>
            <label className={adminFormLabelClassName()}>
              <span>التسمية</span>
              <input
                value={item.label}
                onChange={(event) =>
                  updateRow(index, { label: event.target.value })
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
                  updateRow(index, { value: event.target.value })
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
                  updateRow(index, { href: event.target.value })
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
                  updateRow(index, { icon: event.target.value })
                }
                className={adminFormFieldClassName()}
              />
            </label>
            <AdminFormSwitch
              label="إظهار"
              checked={item.visible !== false}
              onChange={(event) =>
                updateRow(index, {
                  visible: event.target.checked ? undefined : false,
                })
              }
              surface
            />
          </div>
        </div>
      ))}
      <AdminActionButton
        variant="gold"
        onClick={() => onChange([...rows, emptyContactRow()])}
      >
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
  return (
    <FooterLinksDataGrid
      links={links.length ? links : []}
      onChange={onChange}
    />
  );
}

type QuickLinksFieldProps = {
  footerMenuId: number | null;
  links: FooterQuickLinkInput[];
};

export function QuickLinksField({ footerMenuId, links }: QuickLinksFieldProps) {
  return (
    <FooterMenuPreviewDataGrid footerMenuId={footerMenuId} links={links} />
  );
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
            <p className="text-sm font-medium text-white/75">
              رابط #{index + 1}
            </p>
            <AdminActionButton
              variant="ghost"
              className="!min-h-8 !px-3 !py-1.5 text-xs text-red-300"
              onClick={() =>
                onChange(rows.filter((_, rowIndex) => rowIndex !== index))
              }
            >
              حذف
            </AdminActionButton>
          </div>
          <div className={ADMIN_FORM.gridTwoCol}>
            <div className={adminFormLabelClassName()}>
              <span id={`footer-social-platform-${index}-label`}>المنصة</span>
              <AdminListboxSelect
                value={item.platform}
                onChange={(value) => {
                  const platform = isSocialPlatform(value) ? value : "facebook";
                  onChange(
                    rows.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, platform } : row,
                    ),
                  );
                }}
                options={SOCIAL_PLATFORM_OPTIONS.map(([value, label]) => ({
                  value,
                  label,
                }))}
                ariaLabelledBy={`footer-social-platform-${index}-label`}
              />
            </div>
            <label className={adminFormLabelClassName()}>
              <span>التسمية</span>
              <input
                value={item.label}
                onChange={(event) =>
                  onChange(
                    rows.map((row, rowIndex) =>
                      rowIndex === index
                        ? { ...row, label: event.target.value }
                        : row,
                    ),
                  )
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
                  onChange(
                    rows.map((row, rowIndex) =>
                      rowIndex === index
                        ? { ...row, href: event.target.value }
                        : row,
                    ),
                  )
                }
                className={adminFormFieldClassName()}
                dir="ltr"
              />
            </label>
            <AdminFormSwitch
              label="إظهار في الشريط السفلي"
              checked={item.visible !== false}
              onChange={(event) =>
                onChange(
                  rows.map((row, rowIndex) =>
                    rowIndex === index
                      ? { ...row, visible: event.target.checked }
                      : row,
                  ),
                )
              }
              surface
              className="md:col-span-2"
            />
          </div>
        </div>
      ))}
      <AdminActionButton
        variant="gold"
        onClick={() => onChange([...rows, emptySocialRow()])}
      >
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
          onChange={(event) =>
            onChange({ ...legal, copyright: event.target.value })
          }
          className={adminFormFieldClassName()}
        />
      </label>
      <label className={adminFormLabelClassName()}>
        <span>Legal Tagline</span>
        <input
          value={legal.tagline}
          onChange={(event) =>
            onChange({ ...legal, tagline: event.target.value })
          }
          className={adminFormFieldClassName()}
        />
      </label>
    </div>
  );
}

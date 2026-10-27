"use client";

import { adminFormFieldClassName } from "../../../../components/admin/VenesiaModal";
import { ADMIN_FORM_STACK_CLASS_NAME } from "../../../../components/admin/ui/AdminForm";
import {
  AdminActionButton,
  AdminDataGridActionIcon,
  AdminFormField,
  AdminFormGrid,
  AdminFormSection,
  AdminFormSwitch,
  AdminListboxSelect,
} from "../../../../components/admin/ui";
import {
  adminFormHintClassName,
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
    <div className={ADMIN_FORM_STACK_CLASS_NAME}>
      {hint ? <p className={adminFormHintClassName()}>{hint}</p> : null}
      {rows.map((item, index) => (
        <AdminFormSection
          key={`contact-row-${index}`}
          className={`space-y-3 ${
            item.visible === false ? "opacity-55" : ""
          }`}
          title={`عنصر #${index + 1}`}
          description={item.visible === false ? "مخفي في الفوتر" : undefined}
          actions={
            <AdminActionButton
              variant="danger-ghost"
              onClick={() =>
                onChange(rows.filter((_, rowIndex) => rowIndex !== index))
              }
            >
              <AdminDataGridActionIcon action="delete" />
              حذف
            </AdminActionButton>
          }
        >

          <AdminFormSection title="معاينة">
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
          </AdminFormSection>

          <AdminFormGrid columns={2} presentation="aligned-fields">
            <AdminFormField label="التسمية">
              <input
                value={item.label}
                onChange={(event) =>
                  updateRow(index, { label: event.target.value })
                }
                className={adminFormFieldClassName()}
                dir="rtl"
              />
            </AdminFormField>
            <AdminFormField label="القيمة">
              <input
                value={item.value}
                onChange={(event) =>
                  updateRow(index, { value: event.target.value })
                }
                className={adminFormFieldClassName()}
                dir="rtl"
              />
            </AdminFormField>
            <AdminFormField label="الرابط (اختياري)" className="md:col-span-2">
              <input
                value={item.href ?? ""}
                onChange={(event) =>
                  updateRow(index, { href: event.target.value })
                }
                className={adminFormFieldClassName()}
                dir="ltr"
              />
            </AdminFormField>
            <AdminFormField label="أيقونة (اختياري)">
              <input
                value={item.icon ?? ""}
                onChange={(event) =>
                  updateRow(index, { icon: event.target.value })
                }
                className={adminFormFieldClassName()}
              />
            </AdminFormField>
            <AdminFormSwitch
              label="إظهار"
              checked={item.visible !== false}
              onChange={(event) =>
                updateRow(index, {
                  visible: event.target.checked ? undefined : false,
                })
              }
              embedded
            />
          </AdminFormGrid>
        </AdminFormSection>
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
    <div className={ADMIN_FORM_STACK_CLASS_NAME}>
      {rows.map((item, index) => (
        <AdminFormSection
          key={`social-${index}`}
          className="space-y-3"
          title={`رابط #${index + 1}`}
          actions={
            <AdminActionButton
              variant="danger-ghost"
              onClick={() =>
                onChange(rows.filter((_, rowIndex) => rowIndex !== index))
              }
            >
              <AdminDataGridActionIcon action="delete" />
              حذف
            </AdminActionButton>
          }
        >
          <AdminFormGrid columns={2} presentation="aligned-fields">
            <AdminFormField label={<span id={`footer-social-platform-${index}-label`}>المنصة</span>}>
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
            </AdminFormField>
            <AdminFormField label="التسمية">
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
            </AdminFormField>
            <AdminFormField label="الرابط" className="md:col-span-2">
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
            </AdminFormField>
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
              embedded
              className="md:col-span-2"
            />
          </AdminFormGrid>
        </AdminFormSection>
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
    <AdminFormGrid columns={2} presentation="aligned-fields">
      <AdminFormField label="Copyright">
        <input
          value={legal.copyright}
          onChange={(event) =>
            onChange({ ...legal, copyright: event.target.value })
          }
          className={adminFormFieldClassName()}
        />
      </AdminFormField>
      <AdminFormField label="Legal Tagline">
        <input
          value={legal.tagline}
          onChange={(event) =>
            onChange({ ...legal, tagline: event.target.value })
          }
          className={adminFormFieldClassName()}
        />
      </AdminFormField>
    </AdminFormGrid>
  );
}

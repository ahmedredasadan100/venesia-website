"use client";

import Link from "next/link";

import { adminFormFieldClassName, ADMIN_FORM, adminFormHintClassName, adminFormLabelClassName } from "../../../../lib/admin/admin-ui-styles";
import { linkDefaultFromContainer } from "../../../../lib/admin/links/link-defaults";
import { serializeAdminLink } from "../../../../lib/admin/links/serialize";
import type { AdminLinkValue } from "../../../../lib/admin/links/types";
import { listFooterBlockTypes } from "../../../../lib/footer/footer-block-registry";
import type {
  FooterBlockType,
  FooterContactSlotConfig,
  FooterCustomLinksSlotConfig,
  FooterMediaSlotConfig,
  FooterMenuSlotConfig,
  FooterSlot,
  FooterTextSlotConfig,
} from "../../../../lib/footer/footer-slot-types";

import type { FooterMenuOption, FooterQuickLinkInput } from "./actions";
import {
  FOOTER_BLOCK_TYPE_LABELS,
  FOOTER_MEDIA_SOURCE_LABELS,
  FOOTER_MENU_LOCATION_LABELS,
} from "./footer-builder-labels";
import { ContactItemsField, ManualLinksField, QuickLinksField } from "./FooterBuilderEditors";
import { AdminLinkField } from "../../../../components/admin/ui";

type FooterSlotConfigFieldsProps = {
  slot: FooterSlot;
  onChange: (slot: FooterSlot) => void;
  footerMenuId: number | null;
  quickLinks: FooterQuickLinkInput[];
  menuOptions: FooterMenuOption[];
};

export default function FooterSlotConfigFields({
  slot,
  onChange,
  footerMenuId,
  quickLinks,
  menuOptions,
}: FooterSlotConfigFieldsProps) {
  switch (slot.type) {
    case "text":
      return (
        <TextSlotFields
          config={slot.config as FooterTextSlotConfig}
          onChange={(config) => onChange({ ...slot, type: "text", config })}
        />
      );
    case "menu":
      return (
        <MenuSlotFields
          config={slot.config as FooterMenuSlotConfig}
          onChange={(config) => onChange({ ...slot, type: "menu", config })}
          footerMenuId={footerMenuId}
          quickLinks={quickLinks}
          menuOptions={menuOptions}
        />
      );
    case "contact":
      return (
        <ContactSlotFields
          config={slot.config as FooterContactSlotConfig}
          onChange={(config) => onChange({ ...slot, type: "contact", config })}
        />
      );
    case "media":
      return (
        <MediaSlotFields
          config={slot.config as FooterMediaSlotConfig}
          onChange={(config) => onChange({ ...slot, type: "media", config })}
          menuOptions={menuOptions}
        />
      );
    case "custom_links":
      return (
        <CustomLinksSlotFields
          config={slot.config as FooterCustomLinksSlotConfig}
          onChange={(config) => onChange({ ...slot, type: "custom_links", config })}
        />
      );
    default:
      return null;
  }
}

export function BlockTypeSelect({
  value,
  onChange,
}: {
  value: FooterBlockType;
  onChange: (type: FooterBlockType) => void;
}) {
  return (
    <label className={adminFormLabelClassName()}>
      <span>نوع البلوك</span>
      <select value={value} onChange={(event) => onChange(event.target.value as FooterBlockType)} className={adminFormFieldClassName()}>
        {listFooterBlockTypes().map((type) => (
          <option key={type} value={type}>
            {FOOTER_BLOCK_TYPE_LABELS[type]}
          </option>
        ))}
      </select>
    </label>
  );
}

function updateCtaLink(config: FooterTextSlotConfig, link: AdminLinkValue): FooterTextSlotConfig {
  return {
    ...config,
    cta: {
      ...config.cta,
      link: serializeAdminLink(link),
      href: "",
    },
  };
}

function TextSlotFields({
  config,
  onChange,
}: {
  config: FooterTextSlotConfig;
  onChange: (config: FooterTextSlotConfig) => void;
}) {
  return (
    <div className="space-y-4">
      <label className={adminFormLabelClassName()}>
        <span>العنوان الرئيسي (Title)</span>
        <input
          value={config.title}
          onChange={(event) => onChange({ ...config, title: event.target.value })}
          className={adminFormFieldClassName()}
          dir="rtl"
        />
      </label>
      <label className={adminFormLabelClassName()}>
        <span>النص / Tagline</span>
        <textarea
          value={config.body}
          onChange={(event) => onChange({ ...config, body: event.target.value })}
          className={`${adminFormFieldClassName()} min-h-24`}
          dir="rtl"
        />
      </label>
      <label className={ADMIN_FORM.checkboxRow}>
        <span>إظهار أيقونة البراند</span>
        <input
          type="checkbox"
          checked={config.showBrandIcon}
          onChange={(event) => onChange({ ...config, showBrandIcon: event.target.checked })}
          className="h-4 w-4 accent-[#D8B87A]"
        />
      </label>
      <div className="rounded-[22px] border border-white/10 bg-white/[0.02] p-4">
        <p className="mb-3 text-sm font-medium text-white/70">زر CTA (اختياري)</p>
        <label className={`${ADMIN_FORM.checkboxRow} mb-3`}>
          <span>تفعيل الزر</span>
          <input
            type="checkbox"
            checked={config.cta.enabled}
            onChange={(event) => onChange({ ...config, cta: { ...config.cta, enabled: event.target.checked } })}
            className="h-4 w-4 accent-[#D8B87A]"
          />
        </label>
        {config.cta.enabled ? (
          <div className={ADMIN_FORM.gridTwoCol}>
            <label className={adminFormLabelClassName()}>
              <span>تسمية الزر</span>
              <input
                value={config.cta.label}
                onChange={(event) => onChange({ ...config, cta: { ...config.cta, label: event.target.value } })}
                className={adminFormFieldClassName()}
                dir="rtl"
              />
            </label>
            <div className="md:col-span-2">
              <AdminLinkField
                prefix="footer_text_cta"
                label="الرابط"
                controlledValue={linkDefaultFromContainer(config.cta as Record<string, unknown>)}
                onControlledChange={(link) => onChange(updateCtaLink(config, link))}
              />
            </div>
            <label className={adminFormLabelClassName()}>
              <span>الفتح في</span>
              <select
                value={config.cta.target}
                onChange={(event) =>
                  onChange({
                    ...config,
                    cta: { ...config.cta, target: event.target.value as "_self" | "_blank" },
                  })
                }
                className={adminFormFieldClassName()}
              >
                <option value="_self">نفس النافذة</option>
                <option value="_blank">نافذة جديدة</option>
              </select>
            </label>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MenuSlotFields({
  config,
  onChange,
  footerMenuId,
  quickLinks,
  menuOptions,
}: {
  config: FooterMenuSlotConfig;
  onChange: (config: FooterMenuSlotConfig) => void;
  footerMenuId: number | null;
  quickLinks: FooterQuickLinkInput[];
  menuOptions: FooterMenuOption[];
}) {
  return (
    <div className="space-y-4">
      <p className={adminFormHintClassName()}>
        يعرض قائمة موجودة مسبقًا فقط — إنشاء وتعديل العناصر من{" "}
        <Link href="/admin/pages-blocks/menus" className="text-[#D8B87A] underline">
          Menus Admin
        </Link>
        .
      </p>
      <label className={adminFormLabelClassName()}>
        <span>مصدر القائمة</span>
        <select
          value={config.source}
          onChange={(event) =>
            onChange({
              ...config,
              source: event.target.value as FooterMenuSlotConfig["source"],
            })
          }
          className={adminFormFieldClassName()}
        >
          <option value="location">حسب موقع القائمة</option>
          <option value="menu_id">قائمة محددة بالمعرّف</option>
        </select>
      </label>

      {config.source === "location" ? (
        <>
          <label className={adminFormLabelClassName()}>
            <span>موقع القائمة</span>
            <select
              value={config.location}
              onChange={(event) =>
                onChange({
                  ...config,
                  location: event.target.value as FooterMenuSlotConfig["location"],
                })
              }
              className={adminFormFieldClassName()}
            >
              {Object.entries(FOOTER_MENU_LOCATION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className={adminFormLabelClassName()}>
            <span>قائمة احتياطية</span>
            <select
              value={config.fallbackLocation ?? ""}
              onChange={(event) =>
                onChange({
                  ...config,
                  fallbackLocation: event.target.value
                    ? (event.target.value as FooterMenuSlotConfig["fallbackLocation"])
                    : null,
                })
              }
              className={adminFormFieldClassName()}
            >
              <option value="">بدون</option>
              {Object.entries(FOOTER_MENU_LOCATION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {config.location === "footer" ? (
            <QuickLinksField footerMenuId={footerMenuId} links={quickLinks} />
          ) : null}
        </>
      ) : (
        <>
        <label className={adminFormLabelClassName()}>
          <span>القائمة</span>
          <select
            value={config.menuId ?? ""}
            onChange={(event) =>
              onChange({
                ...config,
                menuId: event.target.value ? Number(event.target.value) : null,
              })
            }
            className={adminFormFieldClassName()}
          >
            <option value="">اختر قائمة</option>
            {menuOptions.map((menu) => (
              <option key={menu.id} value={menu.id}>
                {menu.name} ({menu.location})
              </option>
            ))}
          </select>
        </label>
        {config.menuId && config.menuId === footerMenuId ? (
          <QuickLinksField footerMenuId={footerMenuId} links={quickLinks} />
        ) : config.menuId ? (
          <p className={adminFormHintClassName()}>
            لتحرير عناصر هذه القائمة افتح{" "}
            <Link href={`/admin/pages-blocks/menus/${config.menuId}`} className="text-[#D8B87A] underline">
              محرر القائمة #{config.menuId}
            </Link>
            .
          </p>
        ) : null}
        </>
      )}

      <div className={ADMIN_FORM.gridTwoCol}>
        <label className={adminFormLabelClassName()}>
          <span>الحد الأقصى للعناصر</span>
          <input
            type="number"
            min={1}
            value={config.maxItems ?? ""}
            onChange={(event) =>
              onChange({
                ...config,
                maxItems: event.target.value ? Number(event.target.value) : null,
              })
            }
            className={adminFormFieldClassName()}
            placeholder="بدون حد"
          />
        </label>
        <label className={ADMIN_FORM.checkboxRow}>
          <span>المستوى الأول فقط</span>
          <input
            type="checkbox"
            checked={config.showOnlyTopLevel}
            onChange={(event) => onChange({ ...config, showOnlyTopLevel: event.target.checked })}
            className="h-4 w-4 accent-[#D8B87A]"
          />
        </label>
      </div>
    </div>
  );
}

function ContactSlotFields({
  config,
  onChange,
}: {
  config: FooterContactSlotConfig;
  onChange: (config: FooterContactSlotConfig) => void;
}) {
  return (
    <div className="space-y-4">
      <label className={adminFormLabelClassName()}>
        <span>مصدر بيانات التواصل</span>
        <select
          value={config.source}
          onChange={(event) =>
            onChange({
              ...config,
              source: event.target.value as FooterContactSlotConfig["source"],
            })
          }
          className={adminFormFieldClassName()}
        >
          <option value="global">المجموعة العامة (مشتركة)</option>
          <option value="custom">مخصص لهذا العمود</option>
        </select>
      </label>

      {config.source === "global" ? (
        <div className="rounded-[22px] border border-white/10 bg-white/[0.02] p-4 text-sm leading-7 text-white/62">
          <p>هذا العمود يستخدم المجموعة العامة لبيانات التواصل.</p>
          <p className="mt-2 text-white/45">عدّل العناصر من تبويب «بيانات التواصل» في منشئ الفوتر.</p>
        </div>
      ) : (
        <ContactItemsField
          items={config.items}
          onChange={(items) => onChange({ ...config, items })}
          hint="عناصر تواصل خاصة بهذا العمود فقط."
        />
      )}
    </div>
  );
}

function MediaSlotFields({
  config,
  onChange,
  menuOptions,
}: {
  config: FooterMediaSlotConfig;
  onChange: (config: FooterMediaSlotConfig) => void;
  menuOptions: FooterMenuOption[];
}) {
  return (
    <div className="space-y-4">
      <label className={adminFormLabelClassName()}>
        <span>مصدر الروابط</span>
        <select
          value={config.source}
          onChange={(event) =>
            onChange({
              ...config,
              source: event.target.value as FooterMediaSlotConfig["source"],
            })
          }
          className={adminFormFieldClassName()}
        >
          {Object.entries(FOOTER_MEDIA_SOURCE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {config.source === "main_submenu" ? (
        <>
          <AdminLinkField
            prefix="footer_media_parent"
            label="عنصر القائمة الأب"
            helperText="يُستخدم لجلب submenu من القائمة الرئيسية تحت هذا المسار."
            controlledValue={linkDefaultFromContainer(config as Record<string, unknown>, "parentLink", "parentHref")}
            onControlledChange={(link) =>
              onChange({
                ...config,
                parentLink: serializeAdminLink(link),
                parentHref: "",
              })
            }
          />
          <p className={adminFormHintClassName()}>
            يقرأ الروابط من submenu تحت هذا المسار في القائمة الرئيسية.{" "}
            <Link href="/admin/pages-blocks/menus" className="text-[#D8B87A] underline">
              تعديل القوائم
            </Link>
          </p>
        </>
      ) : null}

      {config.source === "menu_id" ? (
        <label className={adminFormLabelClassName()}>
          <span>القائمة</span>
          <select
            value={config.menuId ?? ""}
            onChange={(event) =>
              onChange({
                ...config,
                menuId: event.target.value ? Number(event.target.value) : null,
              })
            }
            className={adminFormFieldClassName()}
          >
            <option value="">اختر قائمة</option>
            {menuOptions.map((menu) => (
              <option key={menu.id} value={menu.id}>
                {menu.name} ({menu.location})
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {config.source === "manual" ? (
        <ManualLinksField
          links={config.manualLinks}
          onChange={(manualLinks) => onChange({ ...config, manualLinks })}
        />
      ) : null}

      <label className={adminFormLabelClassName()}>
        <span>الحد الأقصى للعناصر</span>
        <input
          type="number"
          min={1}
          value={config.maxItems ?? ""}
          onChange={(event) =>
            onChange({
              ...config,
              maxItems: event.target.value ? Number(event.target.value) : null,
            })
          }
          className={adminFormFieldClassName()}
          placeholder="بدون حد"
        />
      </label>
    </div>
  );
}

function CustomLinksSlotFields({
  config,
  onChange,
}: {
  config: FooterCustomLinksSlotConfig;
  onChange: (config: FooterCustomLinksSlotConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <p className={adminFormHintClassName()}>
        روابط يدوية (Label + URL) تُحفظ داخل إعدادات الفوتر فقط — لا تُكتب في القوائم أو menu_items.
      </p>
      <ManualLinksField links={config.links} onChange={(links) => onChange({ ...config, links })} />
    </div>
  );
}

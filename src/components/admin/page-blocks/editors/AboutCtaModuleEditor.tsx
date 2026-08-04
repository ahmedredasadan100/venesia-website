"use client";

import { useState } from "react";

import AdminMediaImageField from "../../media/AdminMediaImageField";
import { AdminLinkField } from "../../ui";
import { linkDefaultFromContainer } from "../../../../lib/admin/links/link-defaults";
import type { AdminLinkValue } from "../../../../lib/admin/links/types";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import type { AboutCtaContactConfig, AboutCtaModuleConfig } from "../../../../lib/page-blocks/configs";
import {
  CONTACT_ICON_OPTIONS,
  renderContactIcon,
  resolveContactIconKey,
} from "../../../page-blocks/contact-icons";

type AboutCtaEditorSection = "text" | "image" | "cta" | "contacts";

type AboutCtaModuleEditorProps = {
  config: AboutCtaModuleConfig;
  editorMode?: "about-cta" | "home-contact";
  /** Flat section selected by the specialized editor's shared tabs. */
  section: AboutCtaEditorSection;
};

const CONTACT_SLOTS = 4;

type ContactRow = {
  uid: string;
  label: string;
  value: string;
  secondaryValue: string;
  icon: string;
  linkDefault: AdminLinkValue;
};

function buildInitialRows(contacts: AboutCtaContactConfig[] | undefined): ContactRow[] {
  return Array.from({ length: CONTACT_SLOTS }, (_, index) => {
    const contact = contacts?.[index];
    return {
      uid: `contact-slot-${index}`,
      label: contact?.label ?? "",
      value: contact?.value ?? "",
      secondaryValue: contact?.secondaryValue ?? "",
      icon: resolveContactIconKey(contact?.icon, index),
      linkDefault: linkDefaultFromContainer((contact ?? {}) as Record<string, unknown>),
    };
  });
}

export default function AboutCtaModuleEditor({
  config,
  editorMode = "about-cta",
  section,
}: AboutCtaModuleEditorProps) {
  const isHomeContact = editorMode === "home-contact";
  const fieldLabels = {
    eyebrow: "العنوان التمهيدي الصغير",
    title: "العنوان",
    description: "الوصف",
    imageAlt: "وصف الصورة",
    buttonLabel: "نص الزر",
    buttonLink: "رابط الزر",
    chooseLink: "اختيار الرابط",
    clearLink: "مسح الرابط",
    note: "ملاحظة أسفل الزر",
    contactLabel: "اسم وسيلة التواصل",
    contactValue: "بيانات التواصل",
  };
  const [contactRows, setContactRows] = useState<ContactRow[]>(() => buildInitialRows(config.contacts));
  const showText = section === "text";
  const showImage = section === "image";
  const showCta = section === "cta";
  const showContacts = section === "contacts";

  function updateRow(
    uid: string,
    patch: Partial<Pick<ContactRow, "label" | "value" | "secondaryValue" | "icon">>,
  ) {
    setContactRows((rows) => rows.map((row) => (row.uid === uid ? { ...row, ...patch } : row)));
  }

  function moveRow(index: number, direction: -1 | 1) {
    setContactRows((rows) => {
      const target = index + direction;
      if (target < 0 || target >= rows.length) return rows;
      const next = [...rows];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const textFields = showText ? (
    <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
      <label className="block space-y-2">
        <span className="text-xs font-semibold text-white/55">{fieldLabels.eyebrow}</span>
        <input name="eyebrow" defaultValue={config.eyebrow ?? ""} className={fieldClassName()} />
      </label>
      <label className="block space-y-2">
        <span className="text-xs font-semibold text-white/55">{fieldLabels.title}</span>
        {isHomeContact ? (
          <textarea
            name="title"
            defaultValue={config.title ?? ""}
            rows={2}
            placeholder="سطران مفصولان بسطر فارغ"
            className={fieldClassName("resize-y leading-7")}
          />
        ) : (
          <input name="title" defaultValue={config.title ?? ""} className={fieldClassName()} />
        )}
      </label>
      <label className="block space-y-2">
        <span className="text-xs font-semibold text-white/55">{fieldLabels.description}</span>
        <textarea
          name="description"
          defaultValue={config.description ?? ""}
          rows={4}
          className={fieldClassName("resize-y leading-7")}
        />
      </label>
    </section>
  ) : null;

  const ctaFields = showCta ? (
    <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">{fieldLabels.buttonLabel}</span>
          <input name="button_label" defaultValue={config.button?.label ?? ""} className={fieldClassName()} />
        </label>
        <AdminLinkField
          prefix="button"
          label={fieldLabels.buttonLink}
          chooseLinkLabel={fieldLabels.chooseLink}
          clearLinkLabel={fieldLabels.clearLink}
          defaultValue={linkDefaultFromContainer(config.button as Record<string, unknown>)}
          showAnchor
        />
      </div>
      <label className="block space-y-2">
        <span className="text-xs font-semibold text-white/55">{fieldLabels.note}</span>
        <input name="note" defaultValue={config.note ?? ""} className={fieldClassName()} />
      </label>
    </section>
  ) : null;

  const imageFields = showImage ? (
    <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
      <AdminMediaImageField
        name="image"
        label="صورة القسم"
        defaultValue={config.image ?? ""}
        dimensionHint="content"
        browseFolder={isHomeContact ? "images/home" : "images/about"}
      />
      <label className="block space-y-2">
        <span className="text-xs font-semibold text-white/55">{fieldLabels.imageAlt}</span>
        <input name="image_alt" defaultValue={config.imageAlt ?? ""} className={fieldClassName()} />
      </label>
    </section>
  ) : null;

  const contactsFields = showContacts ? (
    <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
      <p className="text-xs leading-6 text-white/45">
        اترك الصف فارغًا لإخفائه. الرابط اختياري — إن وُجد يصبح النص قابلًا للنقر. استخدم الأسهم لتغيير ترتيب الظهور.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {contactRows.map((row, index) => (
          <div key={row.uid} className="space-y-3 rounded-2xl border border-white/10 bg-[#05070B] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[#D8B87A]/70">وسيلة {index + 1}</p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => moveRow(index, -1)}
                  disabled={index === 0}
                  aria-label="تحريك الصف لأعلى"
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-[#080B10] text-white/70 transition hover:border-[#D8B87A]/40 hover:text-[#D8B87A] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveRow(index, 1)}
                  disabled={index === contactRows.length - 1}
                  aria-label="تحريك الصف لأسفل"
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-[#080B10] text-white/70 transition hover:border-[#D8B87A]/40 hover:text-[#D8B87A] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
            </div>

            <label className="block space-y-2">
              <span className="text-xs font-semibold text-white/55">{fieldLabels.contactLabel}</span>
              <input
                name={`contact_${index}_label`}
                value={row.label}
                onChange={(event) => updateRow(row.uid, { label: event.target.value })}
                className={fieldClassName()}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-semibold text-white/55">{fieldLabels.contactValue}</span>
              <input
                name={`contact_${index}_value`}
                value={row.value}
                onChange={(event) => updateRow(row.uid, { value: event.target.value })}
                className={fieldClassName()}
              />
            </label>

            {isHomeContact && row.icon === "whatsapp" ? (
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-white/55">رقم واتساب الثاني — اختياري</span>
                <input
                  name={`contact_${index}_secondary_value`}
                  value={row.secondaryValue}
                  onChange={(event) => updateRow(row.uid, { secondaryValue: event.target.value })}
                  className={fieldClassName()}
                />
              </label>
            ) : null}

            <label className="block space-y-2">
              <span className="text-xs font-semibold text-white/55">الأيقونة</span>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#D8B87A]/22 bg-[#D8B87A]/[0.07] text-[#D8B87A]/75">
                  {renderContactIcon(row.icon)}
                </span>
                <select
                  name={`contact_${index}_icon`}
                  value={row.icon}
                  onChange={(event) => updateRow(row.uid, { icon: event.target.value })}
                  className={fieldClassName()}
                >
                  {CONTACT_ICON_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            {isHomeContact && row.icon === "whatsapp" ? null : (
              <AdminLinkField
                prefix={`contact_${index}`}
                label="الرابط — اختياري"
                defaultValue={row.linkDefault}
              />
            )}
          </div>
        ))}
      </div>
    </section>
  ) : null;

  return (
    <div className="space-y-6">
      {textFields}
      {imageFields}
      {ctaFields}
      {contactsFields}
    </div>
  );
}

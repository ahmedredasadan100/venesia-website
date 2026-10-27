"use client";
import { adminFormLabelClassName } from "../../../../lib/admin/admin-ui-styles";
import { contentModuleMediaSlot } from "../../../../lib/page-blocks/configs";

import {
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorRepeaterCard,
  ModuleEditorRepeaterGrid,
  ModuleEditorSection,
  ModuleEditorVisibilityAlignRow,
} from "../ModuleEditorPresentation";

import { useState } from "react";

import AdminMediaImageField from "../../media/AdminMediaImageField";
import { AdminModuleTabIcon } from "../../ui/AdminModuleTabs";
import { ADMIN_FORM_STACK_CLASS_NAME, AdminActionButton, AdminFormControlHeader, AdminFormGrid, AdminFormListboxSelect, AdminLinkField } from "../../ui";
import { linkDefaultFromContainer } from "../../../../lib/admin/links/link-defaults";
import type { AdminLinkValue } from "../../../../lib/admin/links/types";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import {
  resolvePageBlockTextFormat,
  type AboutCtaContactConfig,
  type AboutCtaModuleConfig,
} from "../../../../lib/page-blocks/configs";
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
  const ReorderButton = AdminActionButton;
  const fieldLabels = {
    eyebrow: "النص التمهيدي",
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
  const eyebrowFormat = resolvePageBlockTextFormat(config, "eyebrow");
  const titleFormat = resolvePageBlockTextFormat(config, "title", { bold: true });
  const descriptionFormat = resolvePageBlockTextFormat(config, "description");

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
      <ModuleEditorFieldGrid>
      <ModuleEditorField nature="short-text" span={6}>
      <ModuleEditorVisibilityAlignRow label={fieldLabels.eyebrow} description={isHomeContact ? "نص قصير يقدم فكرة القسم ويظهر فوق العنوان." : undefined} icon={<AdminModuleTabIcon name="content" />} showName="show_eyebrow" boldName="eyebrow_bold" alignmentName="eyebrow_alignment" showDefault={eyebrowFormat.visible} boldDefault={eyebrowFormat.bold} alignmentDefault={eyebrowFormat.alignment}>
        <input name="eyebrow" aria-label={fieldLabels.eyebrow} defaultValue={config.eyebrow ?? ""} className={fieldClassName()} />
      </ModuleEditorVisibilityAlignRow>
      </ModuleEditorField>
      <ModuleEditorField nature="short-text" span={6}>
      <ModuleEditorVisibilityAlignRow label={fieldLabels.title} description={isHomeContact ? "العنوان الرئيسي للقسم مع الحفاظ على فواصل الأسطر." : undefined} icon={<AdminModuleTabIcon name="content" />} showName="show_title" boldName="title_bold" alignmentName="title_alignment" showDefault={titleFormat.visible} boldDefault={titleFormat.bold} alignmentDefault={titleFormat.alignment}>
        {isHomeContact ? (
          <textarea
            name="title"
            aria-label={fieldLabels.title}
            defaultValue={config.title ?? ""}
            rows={2}
            className={fieldClassName("h-[72px] resize-none overflow-hidden leading-6")}
          />
        ) : (
          <input name="title" aria-label={fieldLabels.title} defaultValue={config.title ?? ""} className={fieldClassName()} />
        )}
      </ModuleEditorVisibilityAlignRow>
      </ModuleEditorField>
      <ModuleEditorField nature="long-content" span={12}>
      <ModuleEditorVisibilityAlignRow label={fieldLabels.description} description={isHomeContact ? "وصف القسم كما يظهر في الصفحة." : undefined} icon={<AdminModuleTabIcon name="content" />} showName="show_description" boldName="description_bold" alignmentName="description_alignment" showDefault={descriptionFormat.visible} boldDefault={descriptionFormat.bold} alignmentDefault={descriptionFormat.alignment}>
        <textarea
          name="description"
          aria-label={fieldLabels.description}
          defaultValue={config.description ?? ""}
          rows={2}
          className={fieldClassName("h-[72px] resize-none overflow-hidden leading-6")}
        />
      </ModuleEditorVisibilityAlignRow>
      </ModuleEditorField>
      </ModuleEditorFieldGrid>
  ) : null;

  const ctaContent = (
      <>
      <AdminFormGrid>
        <label className={adminFormLabelClassName({ textInset: true })}>
          <span data-admin-form-label-text>{fieldLabels.buttonLabel}</span>
          <input name="button_label" defaultValue={config.button?.label ?? ""} className={fieldClassName()} />
        </label>
        <AdminLinkField
          prefix="button"
          actionPresentation="bare"
          label={fieldLabels.buttonLink}
          chooseLinkLabel={fieldLabels.chooseLink}
          clearLinkLabel={fieldLabels.clearLink}
          defaultValue={linkDefaultFromContainer(config.button as Record<string, unknown>)}
          showAnchor
        />
      </AdminFormGrid>
      <label className={adminFormLabelClassName({ textInset: true })}>
        <span data-admin-form-label-text>{fieldLabels.note}</span>
        <input name="note" defaultValue={config.note ?? ""} className={fieldClassName()} />
      </label>
      </>
  );
  const ctaFields = showCta ? (
    <ModuleEditorSection surface="neutral" className={ADMIN_FORM_STACK_CLASS_NAME}>{ctaContent}</ModuleEditorSection>
  ) : null;

  const imageContent = (
      <AdminMediaImageField
        variant="card"
        showLabel={false}
        mediaSlot={contentModuleMediaSlot("about-cta")}
        name="image"
        label="صورة القسم"
        defaultValue={config.image ?? ""}
        altName="image_alt"
        defaultAlt={config.imageAlt ?? ""}
        altLabel={fieldLabels.imageAlt}
        browseFolder={isHomeContact ? "images/home" : "images/about"}
      />
  );
  const imageFields = showImage ? (
    <ModuleEditorSection surface="neutral" className={ADMIN_FORM_STACK_CLASS_NAME}><AdminFormControlHeader presentation="leading-icon" title="صورة القسم" icon={<AdminModuleTabIcon name="media" />} />{imageContent}</ModuleEditorSection>
  ) : null;

  const contactsFields = showContacts ? (
      <ModuleEditorSection surface="neutral">
      <ModuleEditorRepeaterGrid columns={isHomeContact ? 2 : 3}>
        {contactRows.map((row, index) => (
          <ModuleEditorRepeaterCard
            key={row.uid}
            icon={isHomeContact ? <AdminModuleTabIcon name="location" /> : undefined}
            description={isHomeContact ? "بيانات وسيلة التواصل ورابطها وترتيبها." : undefined}
            title={`وسيلة ${index + 1}`}
            actions={(
              <>
                <ReorderButton
                  type="button"
                  onClick={() => moveRow(index, -1)}
                  disabled={index === 0}
                  aria-label="تحريك الصف لأعلى"
                  size="icon"
                >
                  ↑
                </ReorderButton>
                <ReorderButton
                  type="button"
                  onClick={() => moveRow(index, 1)}
                  disabled={index === contactRows.length - 1}
                  aria-label="تحريك الصف لأسفل"
                  size="icon"
                >
                  ↓
                </ReorderButton>
              </>
            )}
          >

            <label className={adminFormLabelClassName({ textInset: true })}>
              <span data-admin-form-label-text>{fieldLabels.contactLabel}</span>
              <input
                name={`contact_${index}_label`}
                value={row.label}
                onChange={(event) => updateRow(row.uid, { label: event.target.value })}
                className={fieldClassName()}
              />
            </label>

            <label className={adminFormLabelClassName({ textInset: true })}>
              <span data-admin-form-label-text>{fieldLabels.contactValue}</span>
              <input
                name={`contact_${index}_value`}
                value={row.value}
                onChange={(event) => updateRow(row.uid, { value: event.target.value })}
                className={fieldClassName()}
              />
            </label>

            {isHomeContact && row.icon === "whatsapp" ? (
              <label className={adminFormLabelClassName({ textInset: true })}>
                <span data-admin-form-label-text>رقم واتساب الثاني — اختياري</span>
                <input
                  name={`contact_${index}_secondary_value`}
                  value={row.secondaryValue}
                  onChange={(event) => updateRow(row.uid, { secondaryValue: event.target.value })}
                  className={fieldClassName()}
                />
              </label>
            ) : null}

            <div className={adminFormLabelClassName({ textInset: true })}>
              <span data-admin-form-label-text>الأيقونة</span>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#D8B87A]/22 bg-[#D8B87A]/[0.07] text-[#D8B87A]/75">
                  {renderContactIcon(row.icon)}
                </span>
                <AdminFormListboxSelect
                  name={`contact_${index}_icon`}
                  value={row.icon}
                  onChange={(value) => updateRow(row.uid, { icon: value })}
                  options={CONTACT_ICON_OPTIONS.map((option) => ({ value: option.key, label: option.label }))}
                  className="min-w-0 flex-1"
                />
              </div>
            </div>

            {isHomeContact && row.icon === "whatsapp" ? null : (
              <AdminLinkField
                prefix={`contact_${index}`}
                actionPresentation="bare"
                label="الرابط — اختياري"
                defaultValue={row.linkDefault}
              />
            )}
          </ModuleEditorRepeaterCard>
        ))}
      </ModuleEditorRepeaterGrid>
      </ModuleEditorSection>
  ) : null;

  return (
    <div className={ADMIN_FORM_STACK_CLASS_NAME}>
      {textFields}
      {imageFields}
      {ctaFields}
      {contactsFields}
    </div>
  );
}

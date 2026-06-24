"use client";

import AdminMediaImageField from "../../media/AdminMediaImageField";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import type { AboutCtaContactConfig, AboutCtaModuleConfig } from "../../../../lib/page-blocks/configs";

type AboutCtaModuleEditorProps = {
  config: AboutCtaModuleConfig;
  editorMode?: "about-cta" | "home-contact";
};

function padContacts(contacts: AboutCtaContactConfig[] | undefined, size = 4) {
  const rows = [...(contacts ?? [])].slice(0, size);
  while (rows.length < size) rows.push({});
  return rows;
}

export default function AboutCtaModuleEditor({
  config,
  editorMode = "about-cta",
}: AboutCtaModuleEditorProps) {
  const isHomeContact = editorMode === "home-contact";
  const contacts = padContacts(config.contacts);

  return (
    <div className="space-y-6">
      <input type="hidden" name="config_schema" value="about-cta" />

      <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
        <h2 className="text-sm font-semibold text-white">النص الرئيسي</h2>
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">Eyebrow</span>
          <input name="eyebrow" defaultValue={config.eyebrow ?? ""} className={fieldClassName()} />
        </label>
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">Title</span>
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
          <span className="text-xs font-semibold text-white/55">Description</span>
          <textarea
            name="description"
            defaultValue={config.description ?? ""}
            rows={4}
            className={fieldClassName("resize-y leading-7")}
          />
        </label>
      </section>

      <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
        <h2 className="text-sm font-semibold text-white">الزر والملاحظة</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-xs font-semibold text-white/55">Button label</span>
            <input name="button_label" defaultValue={config.button?.label ?? ""} className={fieldClassName()} />
          </label>
          <label className="block space-y-2">
            <span className="text-xs font-semibold text-white/55">Button href</span>
            <input
              name="button_href"
              defaultValue={config.button?.href ?? ""}
              dir="ltr"
              className={fieldClassName()}
            />
          </label>
        </div>
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">Note تحت الزر</span>
          <input name="note" defaultValue={config.note ?? ""} className={fieldClassName()} />
        </label>
      </section>

      <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
        <h2 className="text-sm font-semibold text-white">الصورة</h2>
        <AdminMediaImageField
          name="image"
          label="صورة القسم"
          defaultValue={config.image ?? ""}
          dimensionHint="content"
          browseFolder={isHomeContact ? "images/home" : "images/about"}
        />
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">Alt</span>
          <input name="image_alt" defaultValue={config.imageAlt ?? ""} className={fieldClassName()} />
        </label>
      </section>

      <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
        <h2 className="text-sm font-semibold text-white">بيانات التواصل (4 كحد أقصى)</h2>
        <p className="text-xs leading-6 text-white/45">
          اترك الصف فارغًا لإخفائه. الرابط اختياري — إن وُجد يصبح النص قابلًا للنقر.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {contacts.map((contact, index) => (
            <div key={index} className="space-y-3 rounded-2xl border border-white/10 bg-[#05070B] p-4">
              <p className="text-xs font-semibold text-[#D8B87A]/70">وسيلة {index + 1}</p>
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-white/55">Label</span>
                <input
                  name={`contact_${index}_label`}
                  defaultValue={contact.label ?? ""}
                  className={fieldClassName()}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-white/55">Value</span>
                <input
                  name={`contact_${index}_value`}
                  defaultValue={contact.value ?? ""}
                  className={fieldClassName()}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-white/55">Href (اختياري)</span>
                <input
                  name={`contact_${index}_href`}
                  defaultValue={contact.href ?? ""}
                  dir="ltr"
                  className={fieldClassName()}
                />
              </label>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

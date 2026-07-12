"use client";

import AdminMediaImageField from "../../media/AdminMediaImageField";
import { AdminLinkField } from "../../ui";
import { linkDefaultFromContainer } from "../../../../lib/admin/links/link-defaults";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import type { AboutIntroBeatConfig, AboutIntroModuleConfig } from "../../../../lib/page-blocks/configs";

type AboutIntroEditorSection = "all" | "text" | "images" | "cta";

type AboutIntroModuleEditorProps = {
  config: AboutIntroModuleConfig;
  /** home-story shows CTA + 2 images; about-intro shows beats + 3 images (default). */
  editorMode?: "about-intro" | "home-story";
  /**
   * When set (home-story flat tabs), render only one section.
   * Defaults to `"all"` for the classic about-intro layout.
   */
  section?: AboutIntroEditorSection;
};

function padBeats(beats: AboutIntroBeatConfig[] | undefined) {
  const rows = [...(beats ?? [])].slice(0, 3);
  while (rows.length < 3) rows.push({});
  return rows;
}

export default function AboutIntroModuleEditor({
  config,
  editorMode = "about-intro",
  section = "all",
}: AboutIntroModuleEditorProps) {
  const images = config.images ?? {};
  const beats = padBeats(config.beats);
  const isHomeStory = editorMode === "home-story";
  const showText = section === "all" || section === "text";
  const showImages = section === "all" || section === "images";
  const showCta = isHomeStory && (section === "all" || section === "cta");
  const showBeats = !isHomeStory && section === "all";

  return (
    <div className="space-y-6">
      {section === "all" ? <input type="hidden" name="config_schema" value="about-intro" /> : null}
      {isHomeStory && section === "all" ? <input type="hidden" name="include_story_cta" value="1" /> : null}

      {showText ? (
        <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
          {section === "all" ? <h2 className="text-sm font-semibold text-white">النص</h2> : null}
          <label className="block space-y-2">
            <span className="text-xs font-semibold text-white/55">Eyebrow</span>
            <input name="eyebrow" defaultValue={config.eyebrow ?? ""} className={fieldClassName()} />
          </label>
          <label className="block space-y-2">
            <span className="text-xs font-semibold text-white/55">Title</span>
            <input name="title" defaultValue={config.title ?? ""} className={fieldClassName()} />
          </label>
          {!isHomeStory ? (
            <label className="block space-y-2">
              <span className="text-xs font-semibold text-white/55">Subtitle (السطر الذهبي)</span>
              <input name="subtitle" defaultValue={config.subtitle ?? ""} className={fieldClassName()} />
            </label>
          ) : null}
          <label className="block space-y-2">
            <span className="text-xs font-semibold text-white/55">Description — فقرات مفصولة بسطر فارغ</span>
            <textarea
              name="body"
              defaultValue={config.body ?? ""}
              rows={8}
              className={fieldClassName("resize-y leading-7")}
            />
          </label>
        </section>
      ) : null}

      {showImages ? (
        <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
          {section === "all" ? (
            <h2 className="text-sm font-semibold text-white">
              {isHomeStory ? "الصور (2 متداخلة)" : "الصور (3 كحد أقصى)"}
            </h2>
          ) : null}
          <p className="text-xs leading-6 text-white/45">
            {isHomeStory
              ? "صورتان متداخلتان في يسار السكشن. اترك الموضع فارغًا لإخفائه من العرض."
              : "كل صورة موضع مستقل في التخطيط الحالي. اترك الموضع فارغًا لإخفائه من العرض."}
          </p>
          <div className={`grid gap-5 ${isHomeStory ? "md:grid-cols-2" : "lg:grid-cols-3"}`}>
            <AdminMediaImageField
              name="image_main"
              label="الصورة 1 — الرئيسية"
              defaultValue={images.main ?? ""}
              dimensionHint="content"
              browseFolder={isHomeStory ? "images/home" : "images/about"}
            />
            <AdminMediaImageField
              name="image_secondary"
              label="الصورة 2 — الثانوية"
              defaultValue={images.secondary ?? ""}
              dimensionHint="content"
              browseFolder={isHomeStory ? "images/home" : "images/about"}
            />
            {!isHomeStory ? (
              <AdminMediaImageField
                name="image_accent"
                label="الصورة 3 — اللمسة"
                defaultValue={images.accent ?? ""}
                dimensionHint="content"
                browseFolder="images/about"
              />
            ) : null}
          </div>
          <div className={`grid gap-4 ${isHomeStory ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
            <label className="block space-y-2">
              <span className="text-xs font-semibold text-white/55">Alt — الصورة 1</span>
              <input name="image_main_alt" defaultValue={images.mainAlt ?? ""} className={fieldClassName()} />
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-semibold text-white/55">Alt — الصورة 2</span>
              <input name="image_secondary_alt" defaultValue={images.secondaryAlt ?? ""} className={fieldClassName()} />
            </label>
            {!isHomeStory ? (
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-white/55">Alt — الصورة 3</span>
                <input name="image_accent_alt" defaultValue={images.accentAlt ?? ""} className={fieldClassName()} />
              </label>
            ) : null}
          </div>
        </section>
      ) : null}

      {showCta ? (
        <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
          {section === "all" ? <h2 className="text-sm font-semibold text-white">زر CTA</h2> : null}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-xs font-semibold text-white/55">Label</span>
              <input name="button_label" defaultValue={config.button?.label ?? ""} className={fieldClassName()} />
            </label>
            <AdminLinkField
              prefix="button"
              label="رابط الزر"
              defaultValue={linkDefaultFromContainer(config.button as Record<string, unknown>)}
              showAnchor
            />
          </div>
        </section>
      ) : null}

      {showBeats ? (
        <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
          <h2 className="text-sm font-semibold text-white">البطاقات (3 كحد أقصى)</h2>
          <div className="grid gap-4 lg:grid-cols-3">
            {beats.map((beat, index) => (
              <div key={index} className="space-y-3 rounded-2xl border border-white/10 bg-[#05070B] p-4">
                <p className="text-xs font-semibold text-[#D8B87A]/70">بطاقة {index + 1}</p>
                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-white/55">Badge / Number</span>
                  <input
                    name={`beat_${index}_num`}
                    defaultValue={beat.num ?? ""}
                    placeholder={String(index + 1).padStart(2, "0")}
                    className={fieldClassName()}
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-white/55">Title</span>
                  <input name={`beat_${index}_title`} defaultValue={beat.title ?? ""} className={fieldClassName()} />
                </label>
                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-white/55">Description</span>
                  <textarea
                    name={`beat_${index}_text`}
                    defaultValue={beat.text ?? ""}
                    rows={3}
                    className={fieldClassName("resize-y leading-7")}
                  />
                </label>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

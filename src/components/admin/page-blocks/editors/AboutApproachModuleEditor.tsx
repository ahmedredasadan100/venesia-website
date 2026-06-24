"use client";

import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import type { AboutApproachModuleConfig } from "../../../../lib/page-blocks/configs";

type AboutApproachModuleEditorProps = {
  config: AboutApproachModuleConfig;
};

export default function AboutApproachModuleEditor({ config }: AboutApproachModuleEditorProps) {
  return (
    <div className="space-y-6">
      <input type="hidden" name="config_schema" value="about-approach" />

      <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
        <h2 className="text-sm font-semibold text-white">Our Approach</h2>
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">Eyebrow</span>
          <input name="eyebrow" defaultValue={config.eyebrow ?? ""} className={fieldClassName()} />
        </label>
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">Title — النص الكامل</span>
          <textarea
            name="title"
            defaultValue={config.title ?? ""}
            rows={4}
            className={fieldClassName("resize-y leading-7")}
          />
        </label>
        <p className="text-xs leading-6 text-white/45">
          للحفاظ على التمييز البصري الحالي، افصل الجزء الثاني بـ <code dir="ltr"> — </code> (مسافة قبل وبعد الشرطة).
        </p>
      </section>
    </div>
  );
}

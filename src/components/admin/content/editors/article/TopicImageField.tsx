"use client";

import { useState } from "react";
import AdminMediaImageField from "../../../media/AdminMediaImageField";
import AdminMediaAltWarning from "../../../media-intelligence/AdminMediaAltWarning";
import { adminFormFieldClassName } from "../../../../../lib/admin/admin-ui-styles";
import TopicFieldCounter from "./TopicFieldCounter";

type TopicImageFieldProps = {
  defaultImage?: string | null;
  defaultAlt?: string | null;
  formId?: string;
};

export default function TopicImageField({ defaultImage = "", defaultAlt = "", formId }: TopicImageFieldProps) {
  const [altLength, setAltLength] = useState((defaultAlt ?? "").length);

  return (
    <div className="space-y-3">
      <AdminMediaImageField
        name="image"
        label="الصورة الرئيسية"
        defaultValue={defaultImage ?? ""}
        browseFolder="images/topics"
        dimensionHint="content"
        variant="compact"
        showLabel={false}
        compactAspectClassName="aspect-video"
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] leading-5 text-white/42">
        <span>JPG، PNG، WEBP، GIF، AVIF</span>
        <span>الحد الأقصى 5MB · 1600 × 900</span>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-white/58">النص البديل للصورة (Alt Text)</span>
        <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <textarea
            id="topic-image-alt"
            name="image_alt"
            rows={2}
            defaultValue={defaultAlt ?? ""}
            placeholder="اكتب نصًا يصف الصورة للمستخدمين ومحركات البحث"
            onInput={(event) => setAltLength(event.currentTarget.value.length)}
            className={adminFormFieldClassName("h-auto min-h-16 scroll-mt-24 resize-y rounded-xl px-3 py-2.5 leading-6")}
          />
          <TopicFieldCounter count={altLength} />
        </div>
      </label>

      {formId ? <AdminMediaAltWarning formId={formId} requiredForPublish /> : null}
    </div>
  );
}

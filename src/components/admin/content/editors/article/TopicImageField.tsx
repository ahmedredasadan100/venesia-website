"use client";
import { mediaContentSlot } from "../../../../../lib/media-center/detail-page-config";

import AdminMediaImageField from "../../../media/AdminMediaImageField";
import AdminMediaAltWarning from "../../../media-intelligence/AdminMediaAltWarning";
import { AdminFormError } from "../../../ui/AdminFormRuntime";

type TopicImageFieldProps = {
  defaultImage?: string | null;
  onValueChange?: (value: string) => void;
  defaultAlt?: string | null;
  formId?: string;
  /** Optional shared classes for the Alt field label/stack and design-size hint. */
  labelClassName?: string;
  guidanceClassName?: string;
  /** Alignment-only classes appended by the original-dimensions owner. */
  originalDimensionsClassName?: string;
};

export default function TopicImageField({ defaultImage = "", onValueChange, defaultAlt = "", formId, labelClassName, guidanceClassName, originalDimensionsClassName }: TopicImageFieldProps) {
  return (
    <div className="space-y-3">
      <AdminMediaImageField
        mediaSlot={mediaContentSlot("image")}
        name="image"
        label="الصورة الرئيسية"
        defaultValue={defaultImage ?? ""}
        onValueChange={onValueChange}
        browseFolder="images/topics"
        variant="card"
        showLabel={false}
        guidanceClassName={guidanceClassName}
        originalDimensionsClassName={originalDimensionsClassName}
        dimensionsPresentation="disclosure"
        altName="image_alt"
        defaultAlt={defaultAlt ?? ""}
        altLabel="النص البديل للصورة (Alt Text)"
        altId="topic-image-alt"
        altRows={2}
        altPlaceholder="اكتب نصًا يصف الصورة للمستخدمين ومحركات البحث"
        metadataPresentation="panel"
        metadataLabelClassName={labelClassName}
        showAltCounter
        clearAltOnRemove={false}
        altError={<AdminFormError name="image_alt" />}
        altWarning={formId ? <AdminMediaAltWarning formId={formId} requiredForPublish /> : null}
      />
      <AdminFormError name="image" />
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";

import {
  AdminDataGridRowActions,
  AdminDuplicateResourceModal,
  adminFormFieldClassName,
} from "../../../../components/admin/ui";
import {
  archiveMediaContent,
  duplicateMediaContent,
  publishMediaContent,
  unpublishMediaContent,
} from "./actions";
import {
  isMediaEditableContentType,
  MEDIA_SECTION_OPTIONS,
  type MediaListContentType,
} from "./media-content-config";

type MediaRowActionsProps = {
  item: {
    id: number;
    title: string | null;
    slug: string | null;
    category_slug: string | null;
    content_type: MediaListContentType | string | null;
    status: string | null;
  };
  currentListPath: string;
};

function MediaDuplicateFields({
  item,
  currentListPath,
}: Pick<MediaRowActionsProps, "item" | "currentListPath">) {
  const defaultTitle = `${item.title || "محتوى بدون عنوان"} (نسخة)`;
  const defaultSlug = `${item.slug || `media-${item.id}`}-copy`;
  const sectionOptions = MEDIA_SECTION_OPTIONS.filter(
    (option) => option.contentType === item.content_type,
  );

  return (
    <>
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="redirect_to" value={currentListPath} />

      <div className="md:col-span-2">
        <label className="block space-y-2 text-right">
          <span className="text-xs font-medium text-white/45">اسم النسخة الجديدة</span>
          <input
            name="title"
            defaultValue={defaultTitle}
            dir="rtl"
            className={adminFormFieldClassName("text-right")}
          />
        </label>
      </div>

      <label className="block space-y-2 text-right">
        <span className="text-xs font-medium text-white/45">Slug النسخة</span>
        <input
          name="slug"
          defaultValue={defaultSlug}
          dir="ltr"
          className={adminFormFieldClassName("text-left font-en")}
        />
      </label>

      <label className="block space-y-2 text-right">
        <span className="text-xs font-medium text-white/45">قسم المركز الإعلامي</span>
        <select
          name="category_slug"
          defaultValue={item.category_slug || "__same"}
          dir="rtl"
          className={adminFormFieldClassName("text-right")}
        >
          <option value="__same">نفس القسم الحالي</option>
          {sectionOptions.map((option) => (
            <option key={option.slug} value={option.slug}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-2 text-right md:col-span-2">
        <span className="text-xs font-medium text-white/45">حالة النسخة</span>
        <select name="status" defaultValue="unpublished" dir="rtl" className={adminFormFieldClassName("text-right")}>
          <option value="unpublished">مخفي</option>
          <option value="draft">مسودة</option>
          <option value="published">منشور</option>
        </select>
      </label>
    </>
  );
}

export default function MediaRowActions({ item, currentListPath }: MediaRowActionsProps) {
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const duplicateFormId = useMemo(() => `duplicate-media-form-${item.id}`, [item.id]);

  const editable = isMediaEditableContentType(item.content_type);
  const editHref = editable ? `/admin/content/media/${item.id}` : undefined;
  const isPublished = item.status === "published";
  const previewHref = editable ? `/admin/content/media/${item.id}/preview` : null;
  const hiddenFields = { id: item.id, redirect_to: currentListPath };

  return (
    <AdminDataGridRowActions
      edit={
        editable && editHref
          ? { href: editHref, title: "تعديل" }
          : { disabled: true, title: "التعديل غير متاح" }
      }
      preview={previewHref ? { href: previewHref, title: "معاينة داخلية" } : null}
      visibility={{
        action: isPublished ? unpublishMediaContent : publishMediaContent,
        hiddenFields,
        isPublished,
        title: isPublished ? "إخفاء المحتوى" : "نشر المحتوى",
      }}
      duplicate={
        <AdminDuplicateResourceModal
          triggerTitle="نسخ المحتوى"
          open={duplicateOpen}
          onOpen={() => setDuplicateOpen(true)}
          onClose={() => setDuplicateOpen(false)}
          title="نسخ المحتوى"
          description="أنشئ نسخة جديدة من المحتوى مع slug وحالة مستقلة."
          formId={duplicateFormId}
          formAction={duplicateMediaContent}
        >
          <MediaDuplicateFields item={item} currentListPath={currentListPath} />
        </AdminDuplicateResourceModal>
      }
      delete={{
        action: archiveMediaContent,
        hiddenFields,
        title: "حذف آمن",
      }}
    />
  );
}

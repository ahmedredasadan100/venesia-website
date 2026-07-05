"use client";

import { useMemo, useState } from "react";

import {
  ADMIN_DATA_GRID_RULES,
  ADMIN_FORM,
  AdminDataGridActionButton,
  AdminDataGridActionsCell,
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  VenesiaModal,
  adminFormFieldClassName,
} from "../../../../components/admin/ui";
import { getMediaHref } from "../../../../lib/media-center/types";
import { toPublicMediaType } from "../../../../lib/media-center/content-type-map";
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

function PublicPreviewIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={ADMIN_DATA_GRID_RULES.actionIcon}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M14 3h7v7" />
      <path d="M10 14 21 3" />
      <path d="M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6" />
    </svg>
  );
}

function getMediaPreviewHref(item: MediaRowActionsProps["item"]) {
  if (!item.slug) return null;

  const publicType = toPublicMediaType(item.content_type);
  if (!publicType) return null;

  return getMediaHref({ type: publicType, slug: item.slug });
}

function MediaDuplicateModal({
  item,
  currentListPath,
}: Pick<MediaRowActionsProps, "item" | "currentListPath">) {
  const [open, setOpen] = useState(false);
  const formId = useMemo(() => `duplicate-media-form-${item.id}`, [item.id]);
  const defaultTitle = `${item.title || "محتوى بدون عنوان"} (نسخة)`;
  const defaultSlug = `${item.slug || `media-${item.id}`}-copy`;
  const sectionOptions = MEDIA_SECTION_OPTIONS.filter(
    (option) => option.contentType === item.content_type,
  );

  return (
    <>
      <AdminDataGridActionButton
        action="duplicate"
        size="compact"
        title="نسخ المحتوى"
        onClick={() => setOpen(true)}
      />

      <VenesiaModal
        open={open}
        title="نسخ المحتوى"
        description="أنشئ نسخة جديدة من المحتوى مع slug وحالة مستقلة."
        size="lg"
        onClose={() => setOpen(false)}
        footer={
          <>
            <AdminModalCancelButton onClick={() => setOpen(false)}>إلغاء</AdminModalCancelButton>
            <AdminModalPrimaryButton type="submit" form={formId}>
              إنشاء النسخة
            </AdminModalPrimaryButton>
          </>
        }
      >
        <form id={formId} action={duplicateMediaContent} className={ADMIN_FORM.gridTwoCol}>
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
        </form>
      </VenesiaModal>
    </>
  );
}

export default function MediaRowActions({ item, currentListPath }: MediaRowActionsProps) {
  const editable = isMediaEditableContentType(item.content_type);
  const editHref = editable ? `/admin/content/media/${item.id}` : undefined;
  const isPublished = item.status === "published";
  const previewHref = getMediaPreviewHref(item);

  return (
    <AdminDataGridActionsCell compact>
      {editable && editHref ? (
        <AdminDataGridActionButton action="edit" href={editHref} size="compact" title="تعديل" />
      ) : (
        <AdminDataGridActionButton action="edit" size="compact" disabled title="التعديل غير متاح" />
      )}

      {previewHref ? (
        <AdminDataGridActionButton
          href={previewHref}
          target="_blank"
          tone="dark"
          size="compact"
          title="معاينة المحتوى"
        >
          <PublicPreviewIcon />
        </AdminDataGridActionButton>
      ) : null}

      <form action={isPublished ? unpublishMediaContent : publishMediaContent} className="contents">
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="redirect_to" value={currentListPath} />
        <AdminDataGridActionButton
          type="submit"
          action="visibility"
          size="compact"
          hidden={isPublished}
          title={isPublished ? "إخفاء المحتوى" : "نشر المحتوى"}
        />
      </form>

      <MediaDuplicateModal item={item} currentListPath={currentListPath} />

      <form action={archiveMediaContent} className="contents">
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="redirect_to" value={currentListPath} />
        <AdminDataGridActionButton type="submit" action="delete" size="compact" title="حذف آمن" />
      </form>
    </AdminDataGridActionsCell>
  );
}

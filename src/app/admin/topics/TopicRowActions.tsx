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
} from "../../../components/admin/ui";
import { duplicateTopic, publishTopic, softDeleteTopic, unpublishTopic } from "./actions";

type TopicRowActionsProps = {
  topic: {
    id: number;
    title: string | null;
    slug: string | null;
    category_slug: string | null;
    status: string | null;
  };
  categories: Array<{ name: string; slug: string }>;
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

function TopicDuplicateModal({
  topic,
  categories,
  currentListPath,
}: Pick<TopicRowActionsProps, "topic" | "categories" | "currentListPath">) {
  const [open, setOpen] = useState(false);
  const formId = useMemo(() => `duplicate-topic-form-${topic.id}`, [topic.id]);
  const defaultTitle = `${topic.title || "موضوع بدون عنوان"} (نسخة)`;
  const defaultSlug = `${topic.slug || `topic-${topic.id}`}-copy`;

  return (
    <>
      <AdminDataGridActionButton
        action="duplicate"
        size="compact"
        title="نسخ الموضوع"
        onClick={() => setOpen(true)}
      />

      <VenesiaModal
        open={open}
        title="نسخ الموضوع"
        description="أنشئ نسخة جديدة من الموضوع مع slug وحالة مستقلة."
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
        <form id={formId} action={duplicateTopic} className={ADMIN_FORM.gridTwoCol}>
          <input type="hidden" name="id" value={topic.id} />
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
            <span className="text-xs font-medium text-white/45">التصنيف</span>
            <select
              name="category_slug"
              defaultValue={topic.category_slug || "__same"}
              dir="rtl"
              className={adminFormFieldClassName("text-right")}
            >
              <option value="__same">نفس التصنيف الحالي</option>
              <option value="__none">بدون تصنيف</option>
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
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

export default function TopicRowActions({ topic, categories, currentListPath }: TopicRowActionsProps) {
  const isPublished = topic.status === "published";
  const previewHref = topic.slug
    ? `/topics/${encodeURIComponent(topic.slug)}`
    : `/admin/topics/${topic.id}/preview`;

  return (
    <AdminDataGridActionsCell compact>
      <AdminDataGridActionButton
        action="edit"
        href={`/admin/topics/${topic.id}`}
        size="compact"
        title="تعديل"
      />

      <AdminDataGridActionButton
        href={previewHref}
        target="_blank"
        tone="dark"
        size="compact"
        title="معاينة الموضوع"
      >
        <PublicPreviewIcon />
      </AdminDataGridActionButton>

      <form action={isPublished ? unpublishTopic : publishTopic} className="contents">
        <input type="hidden" name="id" value={topic.id} />
        <input type="hidden" name="redirect_to" value={currentListPath} />
        <AdminDataGridActionButton
          type="submit"
          action="visibility"
          size="compact"
          hidden={isPublished}
          title={isPublished ? "إخفاء الموضوع" : "نشر الموضوع"}
        />
      </form>

      <TopicDuplicateModal topic={topic} categories={categories} currentListPath={currentListPath} />

      <form action={softDeleteTopic} className="contents">
        <input type="hidden" name="id" value={topic.id} />
        <input type="hidden" name="redirect_to" value={currentListPath} />
        <AdminDataGridActionButton type="submit" action="delete" size="compact" title="حذف آمن" />
      </form>
    </AdminDataGridActionsCell>
  );
}

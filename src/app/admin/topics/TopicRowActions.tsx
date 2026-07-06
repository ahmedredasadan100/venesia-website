"use client";

import { useMemo, useState } from "react";

import {
  AdminDataGridRowActions,
  AdminDuplicateResourceModal,
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

function TopicDuplicateFields({
  topic,
  categories,
  currentListPath,
}: Pick<TopicRowActionsProps, "topic" | "categories" | "currentListPath">) {
  const defaultTitle = `${topic.title || "موضوع بدون عنوان"} (نسخة)`;
  const defaultSlug = `${topic.slug || `topic-${topic.id}`}-copy`;

  return (
    <>
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
    </>
  );
}

export default function TopicRowActions({ topic, categories, currentListPath }: TopicRowActionsProps) {
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const duplicateFormId = useMemo(() => `duplicate-topic-form-${topic.id}`, [topic.id]);

  const isPublished = topic.status === "published";
  const previewHref = topic.slug
    ? `/topics/${encodeURIComponent(topic.slug)}`
    : `/admin/topics/${topic.id}/preview`;
  const hiddenFields = { id: topic.id, redirect_to: currentListPath };

  return (
    <AdminDataGridRowActions
      edit={{ href: `/admin/topics/${topic.id}`, title: "تعديل" }}
      preview={{ href: previewHref, title: "معاينة الموضوع" }}
      visibility={{
        action: isPublished ? unpublishTopic : publishTopic,
        hiddenFields,
        isPublished,
        title: isPublished ? "إخفاء الموضوع" : "نشر الموضوع",
      }}
      duplicate={
        <AdminDuplicateResourceModal
          triggerTitle="نسخ الموضوع"
          open={duplicateOpen}
          onOpen={() => setDuplicateOpen(true)}
          onClose={() => setDuplicateOpen(false)}
          title="نسخ الموضوع"
          description="أنشئ نسخة جديدة من الموضوع مع slug وحالة مستقلة."
          formId={duplicateFormId}
          formAction={duplicateTopic}
        >
          <TopicDuplicateFields topic={topic} categories={categories} currentListPath={currentListPath} />
        </AdminDuplicateResourceModal>
      }
      delete={{
        action: softDeleteTopic,
        hiddenFields,
        title: "حذف آمن",
      }}
    />
  );
}

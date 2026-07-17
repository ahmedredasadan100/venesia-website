"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import {
  duplicateUnifiedContent,
  setUnifiedContentStatus,
  softDeleteUnifiedContent,
  toggleUnifiedContentFeatured,
} from "../../../app/admin/content/topics/actions";
import {
  adminContentTopicPath,
  adminContentTopicPreviewPath,
} from "../../../lib/admin/content-routes";
import type { UnifiedContentRow } from "../../../lib/admin/content/load-unified-content";
import AdminContentActivityPopover from "./AdminContentActivityPopover";

type IconAction = "edit" | "preview" | "visibility" | "feature" | "duplicate" | "delete";

function ActionIcon({ action, hidden = false, active = false }: { action: IconAction; hidden?: boolean; active?: boolean }) {
  if (action === "edit") return <path d="M4 20h4.8L19.2 9.6a2.4 2.4 0 0 0-3.4-3.4L5.4 16.6 4 20Zm10.5-12.5 2 2" />;
  if (action === "preview") return <><path d="M14 3h7v7M10 14 21 3M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6" /></>;
  if (action === "visibility") {
    return hidden
      ? <><path d="M3 3l18 18M9.2 5.6A9.8 9.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7a13 13 0 0 1-2.4 3.6M6.5 6.9C4.5 8.2 3 10.4 2.5 12c1 2.5 4.5 7 9.5 7 1.2 0 2.3-.25 3.3-.7" /></>
      : <><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" /><circle cx="12" cy="12" r="3" /></>;
  }
  if (action === "feature") return <path fill={active ? "currentColor" : "none"} d="m12 3 2.7 5.47 6.03.88-4.36 4.25 1.03 6-5.4-2.84L6.6 19.6l1.03-6-4.36-4.25 6.03-.88L12 3Z" />;
  if (action === "duplicate") return <><path d="M8 8h10v12H8zM6 16H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></>;
  return <><path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13M10 11v5M14 11v5" /></>;
}

function ActionSvg(props: Parameters<typeof ActionIcon>[0]) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <ActionIcon {...props} />
    </svg>
  );
}

function SubmitActionButton({
  title,
  action,
  tone,
  hidden,
  active,
}: {
  title: string;
  action: IconAction;
  tone: string;
  hidden?: boolean;
  active?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      title={title}
      aria-label={title}
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-[8px] border transition disabled:cursor-wait disabled:opacity-45 ${tone}`}
    >
      {pending ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <ActionSvg action={action} hidden={hidden} active={active} />}
    </button>
  );
}

export default function UnifiedContentRowActions({
  row,
  currentListPath,
}: {
  row: UnifiedContentRow;
  currentListPath: string;
}) {
  const isPublished = row.status === "published";
  const visibilityTitle = isPublished
    ? "إخفاء المحتوى المنشور"
    : row.status === "archived"
      ? "نشر المحتوى المؤرشف بعد التحقق"
      : row.status === "draft"
        ? "نشر المسودة بعد التحقق"
        : "إعادة نشر المحتوى المخفي";

  return (
    <div className="flex min-w-[344px] flex-nowrap items-center justify-center gap-1" dir="rtl">
      <Link
        href={adminContentTopicPath(row.id)}
        title="تعديل"
        aria-label="تعديل"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] border border-[#D8B87A]/22 bg-[#D8B87A]/10 text-[#F1C668] transition hover:border-[#D8B87A]/48"
      >
        <ActionSvg action="edit" />
      </Link>
      <Link
        href={adminContentTopicPreviewPath(row.id)}
        target="_blank"
        rel="noreferrer"
        title="معاينة"
        aria-label="معاينة"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] border border-white/10 bg-white/[0.055] text-white/62 transition hover:border-sky-300/35 hover:text-sky-100"
      >
        <ActionSvg action="preview" />
      </Link>
      <form action={setUnifiedContentStatus}>
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="next_status" value={isPublished ? "unpublished" : "published"} />
        <input type="hidden" name="redirect_to" value={currentListPath} />
        <SubmitActionButton
          title={visibilityTitle}
          action="visibility"
          hidden={!isPublished}
          tone={isPublished ? "border-emerald-300/25 bg-emerald-500/12 text-emerald-100" : "border-white/10 bg-white/[0.055] text-white/52"}
        />
      </form>
      <form action={toggleUnifiedContentFeatured}>
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="redirect_to" value={currentListPath} />
        <SubmitActionButton
          title={row.is_featured ? "إلغاء التمييز" : "تعيين كمميز"}
          action="feature"
          active={Boolean(row.is_featured)}
          tone={row.is_featured ? "border-[#D8B87A]/40 bg-[#D8B87A]/14 text-[#F1C668]" : "border-white/10 bg-white/[0.04] text-white/35"}
        />
      </form>
      <AdminContentActivityPopover
        publishedBy={row.published_by_display}
        publishedAt={row.published_at}
        updatedBy={row.updated_by_display}
        updatedAt={row.updated_at}
        viewsCount={row.views_count}
      />
      <form action={duplicateUnifiedContent}>
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="redirect_to" value={currentListPath} />
        <SubmitActionButton title="نسخ" action="duplicate" tone="border-sky-300/18 bg-sky-500/10 text-sky-100" />
      </form>
      <form
        action={softDeleteUnifiedContent}
        onSubmit={(event) => {
          if (!window.confirm("سيتم حذف المحتوى حذفًا آمنًا. هل تريد المتابعة؟")) event.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="redirect_to" value={currentListPath} />
        <SubmitActionButton title="حذف آمن" action="delete" tone="border-red-300/18 bg-red-500/80 text-white" />
      </form>
    </div>
  );
}

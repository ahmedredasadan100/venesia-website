import Link from "next/link";

import { PlusIcon } from "../../../../../../components/admin/AdminRowActions";
import {
  AdminActionButton,
  AdminInfoBar,
  AdminPageContextHeader,
} from "../../../../../../components/admin/ui";
import { moduleKindLabel, moduleListHref } from "../../../../../../lib/page-blocks/admin-utils";

type PageBlocksHeaderPage = {
  title: string;
  slug: string;
  path: string;
};

type PageBlocksHeaderProps = {
  page: PageBlocksHeaderPage;
  assignmentCount: number;
  onOpenAssignModal: () => void;
};

type PageModuleKindsBarProps = {
  page: Pick<PageBlocksHeaderPage, "title" | "slug">;
  usedModuleKinds: string[];
};

function resolveEditorTitle(page: PageBlocksHeaderPage) {
  if (page.slug === "home" || page.path === "/") {
    return "إدارة الصفحة الرئيسية";
  }

  return `إدارة صفحة ${page.title}`;
}

export function PageModuleKindsBar({ page, usedModuleKinds }: PageModuleKindsBarProps) {
  if (!usedModuleKinds.length) return null;

  return (
    <AdminInfoBar
      label={`مرجع موديولات الصفحة ${page.title || page.slug}`}
      description={(
        <span className="flex flex-wrap items-center gap-2">
          {usedModuleKinds.map((kind) => (
            <Link
              key={kind}
              href={moduleListHref(kind)}
              className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/70 transition hover:border-[#D8B87A]/40 hover:text-[#D8B87A]"
            >
              {moduleKindLabel(kind)}
            </Link>
          ))}
        </span>
      )}
    />
  );
}

export default function PageBlocksHeader({
  page,
  assignmentCount,
  onOpenAssignModal,
}: PageBlocksHeaderProps) {
  const previewPath = page.path || "/";

  return (
    <AdminPageContextHeader
      eyebrow="PAGE BUILDER"
      title={resolveEditorTitle(page)}
      description="تحكّم في إعدادات الصفحة، هيكلها، والموديولات المعروضة داخلها."
      meta={(
        <div className="space-y-1 text-right text-xs leading-6 text-[#D8B87A]/90">
          <div>
            المسار:{" "}
            <span dir="ltr" className="font-en">
              {previewPath}
            </span>
          </div>
          <div>
            الكود:{" "}
            <span dir="ltr" className="font-en">
              {page.slug}
            </span>
          </div>
          <div>الموديولات: {assignmentCount}</div>
        </div>
      )}
      actions={(
        <>
          <AdminActionButton href="/admin/pages-blocks/pages" variant="dark">
            إدارة الصفحات
          </AdminActionButton>
          <AdminActionButton href="/admin/pages-blocks/blocks" variant="dark">
            إدارة الموديولات
          </AdminActionButton>
          <AdminActionButton href={previewPath} variant="dark">
            معاينة الصفحة
          </AdminActionButton>
          <AdminActionButton variant="primary" onClick={onOpenAssignModal}>
            <PlusIcon />
            إضافة موديول
          </AdminActionButton>
        </>
      )}
    />
  );
}

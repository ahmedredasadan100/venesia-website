import Link from "next/link";

import { AdminActionButton, AdminInfoBar, AdminPageHeader } from "../../../../../../components/admin/ui";
import { moduleKindLabel, moduleListHref } from "../../../../../../lib/page-blocks/admin-utils";

type PageBlocksHeaderPage = {
  title: string;
  slug: string;
  path: string;
};

type PageBlocksHeaderProps = {
  page: PageBlocksHeaderPage;
  assignmentCount: number;
  usedModuleKinds: string[];
  onOpenAssignModal: () => void;
};

export default function PageBlocksHeader({
  page,
  assignmentCount,
  usedModuleKinds,
  onOpenAssignModal,
}: PageBlocksHeaderProps) {
  return (
    <>
      <AdminPageHeader
        eyebrow="مدير موديولات الصفحة"
        title={page.title}
        description="من هنا تراجع الموديولات المرتبطة بهذه الصفحة، وتتحكم في موضع ظهورها وترتيبها داخل الصفحة، بينما يظل تعديل المحتوى من مدير كل موديول."
        meta={(
          <div className="space-y-1 text-right leading-6">
            <div>المسار: <span dir="ltr" className="font-en">{page.path || "/"}</span></div>
            <div>الكود: <span dir="ltr" className="font-en">{page.slug}</span></div>
            <div>عدد الموديولات بالصفحة: {assignmentCount}</div>
          </div>
        )}
        actions={(
          <div className="flex flex-wrap items-center gap-3">
            <AdminActionButton href="/admin/pages-blocks/pages" variant="ghost">
              رجوع للصفحات
            </AdminActionButton>
            <AdminActionButton href="/admin/pages-blocks/blocks" variant="ghost">
              إدارة الموديولات
            </AdminActionButton>
            <AdminActionButton href={page.path || "#"} variant="ghost">
              معاينة عامة
            </AdminActionButton>
            <button
              type="button"
              onClick={onOpenAssignModal}
              className="inline-flex min-h-11 cursor-pointer items-center rounded-2xl bg-[#D8B87A] px-5 text-sm font-bold text-[#06101C] transition hover:bg-[#e5c98d]"
            >
              ربط موديول
            </button>
          </div>
        )}
      />

      {usedModuleKinds.length ? (
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
      ) : null}
    </>
  );
}

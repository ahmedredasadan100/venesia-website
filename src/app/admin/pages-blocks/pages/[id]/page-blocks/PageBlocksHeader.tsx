import Link from "next/link";

import { PlusIcon } from "../../../../../../components/admin/AdminRowActions";
import {
  AdminActionButton,
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
  previewHref: string | null;
  onOpenAssignModal: () => void;
};

type PageModuleKindsSummaryProps = {
  usedModuleKinds: Array<{ productKind: string; listKind: string }>;
};

function resolveEditorTitle(page: PageBlocksHeaderPage) {
  if (page.slug === "home" || page.path === "/") {
    return "إدارة الصفحة الرئيسية";
  }

  return `إدارة صفحة ${page.title}`;
}

export function PageModuleKindsSummary({ usedModuleKinds }: PageModuleKindsSummaryProps) {
  if (!usedModuleKinds.length) return null;

  return (
    <>
      {usedModuleKinds.map(({ productKind, listKind }) => (
        <Link
          key={productKind}
          href={moduleListHref(listKind)}
          className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/70 transition hover:border-[#D8B87A]/40 hover:text-[#D8B87A]"
        >
          {moduleKindLabel(productKind)}
        </Link>
      ))}
    </>
  );
}

export default function PageBlocksHeader({
  page,
  previewHref,
  onOpenAssignModal,
}: PageBlocksHeaderProps) {
  return (
    <AdminPageContextHeader
      eyebrow="منشئ الصفحات"
      title={resolveEditorTitle(page)}
      description="تحكّم في إعدادات الصفحة، هيكلها، والموديولات المعروضة داخلها."
      actions={(
        <>
          <AdminActionButton href="/admin/pages-blocks/pages" variant="dark">
            إدارة الصفحات
          </AdminActionButton>
          <AdminActionButton href="/admin/pages-blocks/blocks" variant="dark">
            إدارة الموديولات
          </AdminActionButton>
          <AdminActionButton
            href={previewHref ?? undefined}
            disabled={!previewHref}
            variant="dark"
          >
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

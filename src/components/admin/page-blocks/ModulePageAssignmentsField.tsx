import Link from "next/link";

import { AdminCheckbox, AdminFormSection } from "../ui";

type ModulePageOption = {
  id: number;
  title: string;
  path: string;
};

type ModulePageAssignmentsFieldProps = {
  pages: ModulePageOption[];
  assignedPageIds: number[];
};

function pagePathSegments(path: string) {
  return path.split(/[?#]/u, 1)[0].split("/").filter(Boolean);
}

function groupPages(pages: ModulePageOption[]) {
  const familyRootSegments = new Set(
    pages
      .map((page) => pagePathSegments(page.path))
      .filter((segments) => segments.length > 1)
      .map(([root]) => root),
  );
  const sourceOrder = new Map(pages.map((page, index) => [page.id, index]));
  const familyPages = pages
    .filter((page) => {
      const segments = pagePathSegments(page.path);
      return segments.length > 1 || (segments.length === 1 && familyRootSegments.has(segments[0]));
    })
    .sort((first, second) => {
      const firstSegments = pagePathSegments(first.path);
      const secondSegments = pagePathSegments(second.path);
      const firstRoot = firstSegments[0] ?? "";
      const secondRoot = secondSegments[0] ?? "";
      if (firstRoot !== secondRoot) {
        const firstRootIndex = pages.findIndex((page) => page.path === `/${firstRoot}`);
        const secondRootIndex = pages.findIndex((page) => page.path === `/${secondRoot}`);
        return firstRootIndex - secondRootIndex;
      }
      return firstSegments.length - secondSegments.length ||
        (sourceOrder.get(first.id) ?? 0) - (sourceOrder.get(second.id) ?? 0);
    });
  const familyPageIds = new Set(familyPages.map((page) => page.id));

  return {
    primaryPages: pages.filter((page) => !familyPageIds.has(page.id)),
    familyPages,
  };
}

export default function ModulePageAssignmentsField({
  pages,
  assignedPageIds,
}: ModulePageAssignmentsFieldProps) {
  const assignedSet = new Set(assignedPageIds);
  const { primaryPages, familyPages } = groupPages(pages);
  const pageGroups = [
    {
      title: "الصفحات الرئيسية",
      pages: primaryPages,
      emptyLabel: "لا توجد صفحات رئيسية.",
    },
    {
      title: "مجموعات الصفحات",
      pages: familyPages,
      emptyLabel: "لا توجد مجموعات صفحات.",
    },
  ];

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2" data-module-page-groups="">
      {pageGroups.map((group) => (
        <AdminFormSection
          key={group.title}
          variant="module"
          compactHeader
          title={group.title}
          className="min-w-0"
        >
          <div className="space-y-2" data-module-page-group={group.title}>
            {group.pages.map((page) => (
              <div
                key={page.id}
                className="group flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-3.5 py-2.5 text-sm text-white/72 transition hover:border-white/16 hover:bg-white/[0.04] has-[input:checked]:border-[#D8B87A]/38 has-[input:checked]:bg-[#D8B87A]/[0.055]"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-white/78">{page.title}</span>
                  <span dir="ltr" className="mt-0.5 block truncate text-left font-mono text-[11px] text-white/35">
                    {page.path}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  {assignedSet.has(page.id) ? (
                    <Link
                      href={`/admin/pages-blocks/pages/${page.id}`}
                      className="text-xs font-semibold text-[#D8B87A] underline-offset-4 hover:underline"
                    >
                      إدارة الموضع
                    </Link>
                  ) : null}
                  <AdminCheckbox
                    name="page_ids"
                    value={page.id}
                    defaultChecked={assignedSet.has(page.id)}
                    label={`ربط ${page.title}`}
                    presentation="premium"
                  />
                </span>
              </div>
            ))}

            {!group.pages.length ? <p className="text-sm text-white/45">{group.emptyLabel}</p> : null}
          </div>
        </AdminFormSection>
      ))}
    </div>
  );
}

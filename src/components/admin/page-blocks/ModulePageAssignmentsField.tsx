"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { AdminCard, AdminCheckbox, AdminFormControlHeader, AdminFormGrid, AdminToneBadge } from "../ui";
import { AdminModuleTabIcon } from "../ui/AdminModuleTabs";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<{ baseline: string; ids: Set<number> } | null>(null);
  const assignedSet = new Set(assignedPageIds);
  const baseline = assignedPageIds.join(",");
  // Controls and counts share one live selection. Persisted assignments still
  // own position-management links until the existing save completes.
  const selectedSet = selection?.baseline === baseline ? selection.ids : assignedSet;
  useEffect(() => {

    const form = containerRef.current?.closest("form");
    const reset = () => setSelection(null);
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, []);
  const { primaryPages, familyPages } = groupPages(pages);
  const pageGroups = [
    {
      title: "الصفحات الرئيسية",
      description: "اختر الصفحات التي يظهر بها الموديول.",
      icon: "content" as const,
      pages: primaryPages,
      emptyLabel: "لا توجد صفحات رئيسية.",
    },
    {
      title: "مجموعات الصفحات",
      description: "اختر مجموعات الصفحات التي يظهر بها الموديول.",
      icon: "plans" as const,
      pages: familyPages,
      emptyLabel: "لا توجد مجموعات صفحات.",
    },
  ];

  const groups = pageGroups.map((group) => {
    const selectedCount = group.pages.filter((page) => selectedSet.has(page.id)).length;
    const rows = (
      <div className="space-y-2" data-module-page-group={group.title}>
        {group.pages.map((page) => {
          const checkbox = (
            <AdminCheckbox
              name="page_ids"
              value={page.id}
              checked={selectedSet.has(page.id)}
              onChange={(event) => {
                const ids = new Set(selectedSet);
                if (event.currentTarget.checked) ids.add(page.id);
                else ids.delete(page.id);
                setSelection({ baseline, ids });
              }}
              label={"ربط " + page.title}
              presentation="premium"
            />
          );
          return (
            <div
              key={page.id}
              data-module-page-row={page.id}
              className="group flex min-w-0 items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm transition hover:border-white/25 hover:bg-white/[0.04] focus-within:ring-2 focus-within:ring-[#D8B87A]/60 has-[input:checked]:border-[#D8B87A]/65 has-[input:checked]:bg-[#D8B87A]/[0.075]"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span aria-hidden="true" className="size-5 shrink-0 text-white/55 group-has-[input:checked]:text-[#E6C98D]"><AdminModuleTabIcon name="content" /></span>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-white/78">{page.title}</span>
                  <span dir="ltr" className="mt-0.5 block truncate text-right font-mono text-xs text-white/55">
                    {page.path}
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                {assignedSet.has(page.id) ? (
                  <Link
                    href={"/admin/pages-blocks/pages/" + page.id}
                    className="inline-flex min-h-11 items-center rounded-lg px-1 text-xs font-semibold text-[#D8B87A] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]"
                  >
                    إدارة الموضع
                  </Link>
                ) : null}
                <label className="inline-flex size-11 cursor-pointer items-center justify-center">{checkbox}</label>
              </span>
            </div>
          );
        })}
        {!group.pages.length ? <p className="text-sm text-white/45">{group.emptyLabel}</p> : null}
      </div>
    );
    return (
      <AdminCard key={group.title} presentation="premium" className="min-w-0 space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <AdminFormControlHeader
              presentation="leading-icon"
              title={<span role="heading" aria-level={3}>{group.title}</span>}
              description={group.description}
              icon={<AdminModuleTabIcon name={group.icon} />}
            />
          </div>
          <span role="status" aria-label={"اختيارات " + group.title} aria-live="polite" aria-atomic="true">
            <AdminToneBadge
              toneClassName={selectedCount ? "border-[#D8B87A]/50 bg-[#D8B87A]/10 text-[#E6C98D]" : "border-white/15 bg-white/5 text-white/60"}
              className="min-h-8 whitespace-nowrap px-3 text-xs"
            >
              {selectedCount} محددة
            </AdminToneBadge>
          </span>
        </div>
        {rows}
      </AdminCard>
    );
  });

  return (
    <div ref={containerRef} data-module-page-groups="">
      <AdminFormGrid columns={2}>{groups}</AdminFormGrid>
    </div>
  );
}

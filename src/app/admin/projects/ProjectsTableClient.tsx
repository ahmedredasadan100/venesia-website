"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  AdminBulkActionBar,
  AdminCard,
  AdminDataGrid,
  AdminDataGridActionButton,
  AdminDataGridActions,
  AdminDataGridCheckbox,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridRow,
  AdminDataGridSortLabel,
} from "../../../components/admin/ui";
import { useAdminTable } from "../../../components/admin/table-engine";
import AdminStatusPill from "../../../components/admin/ui/AdminStatusPill";
import type { ProjectCategory } from "../../../config/projects-data";
import {
  bulkProjectsActionAjax,
  deleteProjectAjax,
  getProjectsTableRows,
  toggleProjectPublicationAjax,
} from "./actions";

export type ProjectGridRow = {
  id: number;
  code: string;
  arabic_name: string;
  location_label: string;
  map_area: string;
  featured: boolean;
  publication_status: string | null;
  updated_at: string;
};

type ProjectSortKey = "code" | "location" | "updated_at";

const columns = "44px minmax(96px,110px) minmax(200px,1.2fr) 90px 110px 150px 220px";

function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function publicationMeta(status?: string | null) {
  if (status === "published") return { label: "منشور", tone: "green" as const };
  if (status === "unpublished") return { label: "مخفي", tone: "gold" as const };
  if (status === "archived") return { label: "أرشيف", tone: "muted" as const };
  return { label: "مسودة", tone: "muted" as const };
}

function locationLabel(item: ProjectGridRow) {
  return item.location_label || item.map_area || "—";
}

function ProjectIcon({ type }: { type: ProjectCategory }) {
  return (
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#D8B87A]/16 bg-[#D8B87A]/8 text-lg">
      {type === "residential" ? "🏠" : "🏢"}
    </span>
  );
}

type ProjectsTableClientProps = {
  type: ProjectCategory;
  projects: ProjectGridRow[];
};

export default function ProjectsTableClient({ type, projects }: ProjectsTableClientProps) {
  const sortAccessors = useMemo(
    () => ({
      code: (item: ProjectGridRow) => item.code,
      location: (item: ProjectGridRow) => locationLabel(item),
      updated_at: (item: ProjectGridRow) => item.updated_at,
    }),
    [],
  );

  const table = useAdminTable<ProjectGridRow, ProjectSortKey>({
    initialRows: projects,
    getRowId: (item) => item.id,
    sortAccessors,
    refresh: () => getProjectsTableRows(type),
  });

  function sortProps(key: ProjectSortKey) {
    return {
      active: table.sort.key === key,
      direction: table.sort.direction,
      onClick: () => table.toggleSort(key),
    } as const;
  }

  return (
    <div className="space-y-4">
      {table.feedback ? (
        <div
          className={`rounded-[16px] border px-4 py-3 text-sm font-semibold ${
            table.feedback.type === "success"
              ? "border-emerald-400/18 bg-emerald-500/10 text-emerald-100"
              : "border-red-400/18 bg-red-500/10 text-red-100"
          }`}
        >
          {table.feedback.message}
        </div>
      ) : null}

      <AdminBulkActionBar
        selectedIds={table.selection.selectedIds}
        entityLabel="مشروع"
        options={[
          { value: "publish", label: "نشر المحدد" },
          { value: "hide", label: "إخفاء المحدد" },
          { value: "delete", label: "حذف المحدد" },
        ]}
        onClearSelection={table.selection.clearSelection}
        onExecute={(action, ids) =>
          table.runAction(() => bulkProjectsActionAjax(action, ids.map(Number), type))
        }
        isBusy={table.isPending}
      />

      <AdminDataGrid>
        <AdminDataGridHeader columns={columns}>
          <div className="flex justify-center">
            <AdminDataGridCheckbox
              inputRef={table.selection.selectAllRef}
              checked={table.selection.allSelected}
              onChange={(event) => table.selection.toggleAll(event.currentTarget.checked)}
              label="تحديد الكل"
            />
          </div>
          <AdminDataGridSortLabel {...sortProps("code")}>Code</AdminDataGridSortLabel>
          <AdminDataGridSortLabel {...sortProps("location")}>Location / Area</AdminDataGridSortLabel>
          <span className="text-center">Featured</span>
          <span className="text-center">Published</span>
          <AdminDataGridSortLabel {...sortProps("updated_at")} className="mx-auto">
            Last Updated
          </AdminDataGridSortLabel>
          <span className="text-center">Actions</span>
        </AdminDataGridHeader>

        {table.rows.length ? (
          table.rows.map((item) => {
            const published = publicationMeta(item.publication_status);
            const isHidden = item.publication_status !== "published";

            return (
              <AdminDataGridRow
                key={item.id}
                columns={columns}
                className="border-b border-white/[0.045] last:border-b-0"
              >
                <div className="flex justify-center">
                  <AdminDataGridCheckbox
                    checked={table.selection.selectedSet.has(item.id)}
                    onChange={(event) => table.selection.toggleOne(item.id, event.currentTarget.checked)}
                    label={`تحديد ${item.code}`}
                  />
                </div>

                <div className="flex min-w-0 items-center gap-2.5">
                  <ProjectIcon type={type} />
                  <span className="truncate font-en text-sm font-semibold text-[#D8B87A]">{item.code}</span>
                </div>

                <div className="truncate text-sm text-white/60">{locationLabel(item)}</div>

                <div className="flex justify-center">
                  <AdminStatusPill tone={item.featured ? "green" : "muted"}>
                    {item.featured ? "نعم" : "لا"}
                  </AdminStatusPill>
                </div>
                <div className="flex justify-center">
                  <AdminStatusPill tone={published.tone}>{published.label}</AdminStatusPill>
                </div>
                <div className="text-center text-xs text-white/50">{formatDate(item.updated_at)}</div>

                <AdminDataGridActions>
                  <AdminDataGridActionButton action="edit" href={`/admin/projects/${item.id}`} />
                  <AdminDataGridActionButton
                    action="visibility"
                    title={isHidden ? "نشر" : "إخفاء"}
                    hidden={isHidden}
                    disabled={table.isPending}
                    onClick={() =>
                      table.runAction(() => toggleProjectPublicationAjax(item.id, item.publication_status))
                    }
                  />
                  <AdminDataGridActionButton
                    action="delete"
                    disabled={table.isPending}
                    onClick={() => table.runAction(() => deleteProjectAjax(item.id))}
                  />
                </AdminDataGridActions>
              </AdminDataGridRow>
            );
          })
        ) : (
          <AdminDataGridEmpty>
            <p className="text-base font-semibold text-white">لا توجد مشاريع في هذه القائمة</p>
            <p className="mt-2 text-sm text-white/45">
              نفّذ ملف SQL ثم استورد البيانات من projects-data.ts عبر زر الاستيراد في الصفحة الرئيسية للمشاريع.
            </p>
          </AdminDataGridEmpty>
        )}
      </AdminDataGrid>
    </div>
  );
}

export function ProjectsHubCard({
  href,
  emoji,
  title,
  description,
  count,
}: {
  href: string;
  emoji: string;
  title: string;
  description: string;
  count: number;
}) {
  return (
    <Link href={href} className="block h-full">
      <AdminCard interactive className="group h-full p-6">
        <div className="flex items-start justify-between gap-4">
          <span className="text-3xl">{emoji}</span>
          <AdminStatusPill tone="green">{count} مشروع</AdminStatusPill>
        </div>
        <h2 className="mt-5 text-2xl font-semibold text-white">{title}</h2>
        <p className="mt-4 min-h-[72px] text-sm leading-7 text-white/52">{description}</p>
        <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#D8B87A]">
          فتح المدير
          <span aria-hidden="true">←</span>
        </div>
      </AdminCard>
    </Link>
  );
}

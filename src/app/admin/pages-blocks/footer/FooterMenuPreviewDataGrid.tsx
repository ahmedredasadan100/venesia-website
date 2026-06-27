"use client";

import Link from "next/link";
import { useMemo } from "react";

import {
  ADMIN_DATA_GRID_ACTION_COLUMNS,
  AdminDataGrid,
  AdminDataGridActionButton,
  AdminDataGridActionsCell,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridRow,
  AdminStatusPill,
} from "../../../../components/admin/ui";
import { adminFormHintClassName } from "../../../../lib/admin/admin-ui-styles";

import type { FooterQuickLinkInput } from "./actions";

const columns = `56px minmax(120px,1.1fr) minmax(160px,1.4fr) 88px 88px ${ADMIN_DATA_GRID_ACTION_COLUMNS.one}`;

type FooterMenuPreviewDataGridProps = {
  footerMenuId: number | null;
  links: FooterQuickLinkInput[];
};

export default function FooterMenuPreviewDataGrid({ footerMenuId, links }: FooterMenuPreviewDataGridProps) {
  const sortedLinks = useMemo(
    () => links.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [links],
  );

  if (!footerMenuId) {
    return (
      <div className="rounded-[22px] border border-amber-400/20 bg-amber-400/5 p-4 text-sm leading-7 text-amber-100/85">
        لا توجد قائمة Footer نشطة. أنشئ قائمة بـ location = footer من{" "}
        <Link href="/admin/pages-blocks/menus" className="text-[#D8B87A] underline">
          إدارة القوائم
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-[22px] border border-white/10 bg-white/[0.02] p-4 text-sm leading-7 text-white/62">
        <p>تُدار عناصر القائمة من إدارة القوائم فقط — المعاينة هنا للقراءة.</p>
        <p className="mt-2">
          <Link href="/admin/pages-blocks/menus" className="text-[#D8B87A] underline">
            الانتقال إلى Menus Admin
          </Link>
          {" · "}
          <Link href={`/admin/pages-blocks/menus/${footerMenuId}`} className="text-[#D8B87A] underline">
            فتح قائمة الفوتر
          </Link>
        </p>
      </div>

      <p className={adminFormHintClassName()}>معاينة العناصر الحالية (قراءة فقط)</p>

      <AdminDataGrid>
        <AdminDataGridHeader columns={columns}>
          <span className="text-center">#</span>
          <span>اسم العنصر</span>
          <span>الرابط</span>
          <span className="text-center">الترتيب</span>
          <span className="text-center">الحالة</span>
          <span className="text-center">الإجراءات</span>
        </AdminDataGridHeader>

        {sortedLinks.length ? (
          sortedLinks.map((item, index) => (
            <AdminDataGridRow key={`quick-${item.id ?? index}`} columns={columns}>
              <span className="text-center text-sm font-en text-white/45">{index + 1}</span>
              <span className="truncate text-sm text-white/85">{item.label || "—"}</span>
              <span className="truncate font-en text-xs text-white/45" dir="ltr">
                {item.href || "—"}
              </span>
              <span className="text-center text-xs font-en text-white/45">{item.sortOrder}</span>
              <span className="flex justify-center">
                <AdminStatusPill tone={item.visible ? "green" : "muted"}>
                  {item.visible ? "ظاهر" : "مخفي"}
                </AdminStatusPill>
              </span>
              <AdminDataGridActionsCell>
                <AdminDataGridActionButton
                  action="edit"
                  title="تعديل في Menus Admin"
                  href={`/admin/pages-blocks/menus/${footerMenuId}`}
                />
              </AdminDataGridActionsCell>
            </AdminDataGridRow>
          ))
        ) : (
          <AdminDataGridEmpty>لا توجد عناصر في قائمة الفوتر حاليًا.</AdminDataGridEmpty>
        )}
      </AdminDataGrid>
    </div>
  );
}

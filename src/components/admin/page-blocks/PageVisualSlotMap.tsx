"use client";

import Link from "next/link";

import { LAYOUT_SLOT_LABELS_AR, normalizeLayoutSlot, type PageLayoutSlot } from "../../../lib/page-blocks/layout-slots";
import { moduleEditHref, moduleKindLabel, normalizeBoolean } from "../../../lib/page-blocks/admin-utils";
import type { PageBlockAssignmentRow } from "../../../lib/page-blocks/types";
import { PAGE_LAYOUT_SLOT_ORDER } from "../../../lib/page-blocks/layout-slots";
import { getSlotCompatibilityLabel } from "../../../lib/page-composition/slot-module-registry";

type PageVisualSlotMapProps = {
  assignments: PageBlockAssignmentRow[];
};

function groupAssignmentsBySlot(assignments: PageBlockAssignmentRow[]) {
  const groups = new Map<PageLayoutSlot, PageBlockAssignmentRow[]>();

  for (const slot of PAGE_LAYOUT_SLOT_ORDER) {
    groups.set(slot, []);
  }

  for (const row of assignments) {
    const slot = normalizeLayoutSlot(row.slot);
    const list = groups.get(slot) ?? [];
    list.push(row);
    groups.set(slot, list);
  }

  for (const [slot, rows] of groups) {
    groups.set(
      slot,
      [...rows].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
    );
  }

  return groups;
}

export default function PageVisualSlotMap({ assignments }: PageVisualSlotMapProps) {
  const grouped = groupAssignmentsBySlot(assignments);

  return (
    <div>
      <div className="grid gap-4 xl:grid-cols-5">
        {PAGE_LAYOUT_SLOT_ORDER.map((slot) => {
          const rows = grouped.get(slot) ?? [];
          const isEmpty = rows.length === 0;

          return (
            <div
              key={slot}
              className={[
                "min-h-[220px] rounded-[22px] border p-4",
                isEmpty ? "border-dashed border-white/12 bg-black/15" : "border-white/10 bg-black/25",
              ].join(" ")}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">{LAYOUT_SLOT_LABELS_AR[slot]}</p>
                  <p className="font-en text-[10px] tracking-[0.2em] text-white/30">{slot}</p>
                </div>
                <span
                  className={[
                    "rounded-full px-2 py-1 text-[10px] font-semibold",
                    isEmpty ? "bg-white/5 text-white/35" : "bg-[#D8B87A]/12 text-[#D8B87A]",
                  ].join(" ")}
                >
                  {rows.length}
                </span>
              </div>

              {isEmpty ? (
                <p className="text-xs leading-6 text-white/35">فتحة فارغة — لا توجد وحدات مربوطة هنا.</p>
              ) : (
                <ul className="space-y-2">
                  {rows.map((row) => {
                    const visible = normalizeBoolean(row.is_visible, true);
                    const compatibility = getSlotCompatibilityLabel(row.module_kind);

                    return (
                      <li
                        key={`${row.module_kind}-${row.id}`}
                        className="rounded-[16px] border border-white/8 bg-[#05070B]/80 px-3 py-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">{row.template_name}</p>
                            <p className="mt-1 text-[11px] text-white/45">
                              {moduleKindLabel(row.module_kind)}
                              {compatibility ? ` · يُفضّل: ${compatibility}` : null}
                            </p>
                          </div>
                          <AdminStatusDot visible={visible} />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Link
                            href={moduleEditHref(row.module_kind, row.template_id)}
                            className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-white/55 hover:border-[#D8B87A]/30 hover:text-[#D8B87A]"
                          >
                            تحرير
                          </Link>
                          <span className="font-en text-[10px] text-white/30">#{row.sort_order}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs leading-6 text-white/35">
        ملاحظة: الفوتر العام للموقع يُدار من{" "}
        <Link href="/admin/pages-blocks/footer" className="text-[#D8B87A]/80 hover:text-[#D8B87A]">
          Footer Builder
        </Link>{" "}
        — فتحة footer هنا للموديولات قبل الفوتر على مستوى الصفحة فقط.
      </p>
    </div>
  );
}

function AdminStatusDot({ visible }: { visible: boolean }) {
  return (
    <span
      className={[
        "mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full",
        visible ? "bg-emerald-400" : "bg-amber-400",
      ].join(" ")}
      title={visible ? "ظاهر" : "مخفي"}
    />
  );
}

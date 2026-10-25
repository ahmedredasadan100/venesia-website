"use client";

import Link from "next/link";
import { ADMIN_FORM_STACK_CLASS_NAME, AdminActionButton, AdminCard, AdminFormGrid, AdminFormLayout, AdminFormSection } from "../ui";
import { AdminModuleSectionHeader } from "../ui/AdminModuleTabs";
import { ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME, adminFormHintClassName } from "../../../lib/admin/admin-ui-styles";

import { normalizeLayoutSlot, type PageLayoutSlot } from "../../../lib/page-blocks/layout-slots";
import { moduleEditHref, moduleKindLabel, normalizeBoolean } from "../../../lib/page-blocks/admin-utils";
import type { PageBlockAssignmentRow } from "../../../lib/page-blocks/types";
import type { PageRegionDefinition } from "../../../lib/page-composition/load-page-regions";
import { comparePageAssignmentOrder } from "../../../lib/page-composition/page-assignment-contract";
import { getSlotCompatibilityLabel } from "../../../lib/page-composition/slot-module-registry";
import { resolveVenesiaThemeLayout } from "../../page-composition/venisia-theme-regions";
import type { AdminInstantMutationRowInteraction } from "../../../lib/admin/entity-list/data-engine/instant-mutation";

type PageVisualSlotMapProps = {
  returnTo?: string;
  assignments: PageBlockAssignmentRow[];
  regions: readonly PageRegionDefinition[];
  layoutKey: string;
  getReorderPosition: (row: PageBlockAssignmentRow) => { position: number; count: number };
  getRowInteraction: (row: PageBlockAssignmentRow) => AdminInstantMutationRowInteraction;
  reorderDisabled: boolean;
  onMoveTo: (row: PageBlockAssignmentRow, targetPosition: number) => void;
};

function compareRowsInSlot(
  slot: PageLayoutSlot,
  first: PageBlockAssignmentRow,
  second: PageBlockAssignmentRow,
) {
  if (slot === "hero") {
    const firstIsHero = first.module_kind === "hero";
    const secondIsHero = second.module_kind === "hero";
    if (firstIsHero !== secondIsHero) return firstIsHero ? -1 : 1;
  }

  return comparePageAssignmentOrder(
    {
      sortOrder: first.sort_order,
      moduleKind: first.module_kind,
      assignmentId: first.id,
    },
    {
      sortOrder: second.sort_order,
      moduleKind: second.module_kind,
      assignmentId: second.id,
    },
  );
}

function groupAssignmentsBySlot(assignments: PageBlockAssignmentRow[], regions: readonly PageRegionDefinition[]) {
  const groups = new Map<PageLayoutSlot, PageBlockAssignmentRow[]>();

  for (const region of regions) {
    groups.set(region.key, []);
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
      [...rows].sort((first, second) => compareRowsInSlot(slot, first, second)),
    );
  }

  return groups;
}

export default function PageVisualSlotMap({
  assignments, regions, returnTo, layoutKey, getReorderPosition,
  getRowInteraction, reorderDisabled, onMoveTo,
}: PageVisualSlotMapProps) {
  const grouped = groupAssignmentsBySlot(assignments, regions);
  const layoutPlan = resolveVenesiaThemeLayout({
    layoutKey,
    regions,
    hasSidebarContent: (grouped.get("sidebar") ?? []).some((row) =>
      normalizeBoolean(row.is_publicly_visible, false)),
  });
  const regionsByKey = new Map(regions.map((region) => [region.key, region]));
  const orderedKeys = [...new Set([...layoutPlan.regionOrder, ...regions.map((region) => region.key)])]
    .filter((key) => regionsByKey.has(key));
  const hasMainSidebar = layoutPlan.topology === "main-sidebar" &&
    regionsByKey.has("main") && regionsByKey.has("sidebar");

  const renderRegion = (slot: PageLayoutSlot) => {
    const { adminLabel } = regionsByKey.get(slot)!;
    const rows = grouped.get(slot) ?? [];
    const isEmpty = rows.length === 0;

    return (
      <AdminFormSection
        key={slot}
        presentation="panel"
        header={<AdminModuleSectionHeader
          id={`page-map-${slot}`}
          sectionHeading={adminLabel}
          sectionDescription={<bdi className="font-en">{slot}</bdi>}
          icon="plans"
          sectionHeaderPresentation="premium"
          sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
        />}
      >
        {isEmpty ? (
          <p className={adminFormHintClassName({ textInset: true })}>فتحة فارغة — لا توجد وحدات مربوطة هنا.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => {
              const visible = normalizeBoolean(row.is_publicly_visible, false);
              const compatibility = getSlotCompatibilityLabel(row.module_kind);
              const { position, count } = getReorderPosition(row);
              const interaction = getRowInteraction(row);
              const unavailable = reorderDisabled || interaction.isPending ||
                !row.manages_assignment_on_page || row.module_kind === "hero";

              return (
                <li
                  key={`${row.module_kind}-${row.id}`}
                >
                  <AdminCard presentation="premium" className={`p-3 ${visible ? "" : "opacity-50"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{row.template_name}</p>
                        <p className="mt-1 text-[11px] text-white/45">
                          {moduleKindLabel(row.module_kind, row.template_slug, row.template_variant)}
                          {compatibility ? ` · يُفضّل: ${compatibility}` : null}
                        </p>
                      </div>
                      <AdminStatusDot visible={visible} />
                    </div>
                    {!visible ? <p className={adminFormHintClassName({ textInset: true })}>مخفي</p> : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <AdminActionButton
                        href={moduleEditHref(row.module_kind, row.template_id, { returnPageId: row.page_id, returnTo })}
                        variant="dark"
                        aria-label={`تحرير ${row.template_name}`}
                      >
                        تحرير
                      </AdminActionButton>
                      <AdminActionButton
                        size="icon"
                        disabled={unavailable || position <= 0}
                        aria-label={`نقل ${row.template_name} لأعلى`}
                        onClick={() => onMoveTo(row, position - 1)}
                      >
                        <span aria-hidden="true">↑</span>
                      </AdminActionButton>
                      <AdminActionButton
                        size="icon"
                        disabled={unavailable || position >= count - 1}
                        aria-label={`نقل ${row.template_name} لأسفل`}
                        onClick={() => onMoveTo(row, position + 1)}
                      >
                        <span aria-hidden="true">↓</span>
                      </AdminActionButton>
                      <span className="font-en text-[10px] text-white/30">#{row.sort_order}</span>
                    </div>
                    </AdminCard>
                </li>
              );
            })}
          </ul>
        )}
      </AdminFormSection>
    );
  };

  return (
    <div className={ADMIN_FORM_STACK_CLASS_NAME} data-page-map-topology={layoutPlan.topology}>
      <AdminFormGrid columns={1} density="sections">
        {orderedKeys.map((slot) => {
          if (hasMainSidebar && slot === "sidebar") return null;
          if (hasMainSidebar && slot === "main") {
            return (
              <div key={slot} dir="ltr">
                <AdminFormLayout
                  presentation="panel"
                  aside={<div dir="rtl">{renderRegion("sidebar")}</div>}
                >
                  <div dir="rtl">{renderRegion("main")}</div>
                </AdminFormLayout>
              </div>
            );
          }
          return renderRegion(slot);
        })}
      </AdminFormGrid>

      <p className={adminFormHintClassName({ textInset: true })}>
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
      role="img"
      aria-label={visible ? "ظاهر" : "مخفي"}
      className={[
        "mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full",
        visible ? "bg-emerald-400" : "bg-amber-400",
      ].join(" ")}
      title={visible ? "ظاهر" : "مخفي"}
    />
  );
}

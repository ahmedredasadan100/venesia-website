import Link from "next/link";
import type { DragEventHandler } from "react";

import {
  AdminDataGridRowActions,
  AdminDataGridCenterCell,
  AdminDataGridCheckbox,
  AdminDataGridCheckboxCell,
  AdminDataGridPrimaryCell,
  AdminDataGridReorderHandle,
  AdminDataGridRow,
  AdminDataGridStatusCell,
  AdminListboxSelect,
  type AdminRowActionsCapability,
} from "../../../../../../components/admin/ui";
import {
  isPublishedPageBlockStatus,
  moduleEditHref,
  moduleKindLabel,
  normalizeBoolean,
} from "../../../../../../lib/page-blocks/admin-utils";
import {
  LAYOUT_SLOT_LABELS_AR,
  normalizeLayoutSlot,
  type PageLayoutSlot,
} from "../../../../../../lib/page-blocks/layout-slots";
import type { PageBlockAssignmentRow } from "../../../../../../lib/page-blocks/types";
import type { AdminInstantMutationRowInteraction } from "../../../../../../lib/admin/entity-list/data-engine/instant-mutation";

type PageBlocksAssignmentRowProps = {
  row: PageBlockAssignmentRow;
  rowId: string;
  previewHref: string | null;
  index: number;
  columns: string;
  manageable: boolean;
  isVisible: boolean;
  isSelected: boolean;
  interaction: AdminInstantMutationRowInteraction;
  onToggleSelect: (checked: boolean) => void;
  onToggleVisibility: () => void;
  displayPositionOptions: PageLayoutSlot[];
  onDisplayPositionChange: (slot: PageLayoutSlot) => void;
  onDuplicate: () => void;
  onDetach: () => void;
  reorderPosition: number;
  reorderCount: number;
  manualReorderEnabled: boolean;
  onMoveTo: (targetPosition: number) => void;
  onDragStart: DragEventHandler<HTMLButtonElement>;
  onDragOver: DragEventHandler<HTMLButtonElement>;
  onDrop: DragEventHandler<HTMLButtonElement>;
  onDragEnd: DragEventHandler<HTMLButtonElement>;
  showModule: boolean;
  showStatus: boolean;
};

export default function PageBlocksAssignmentRow({
  row,
  rowId,
  previewHref,
  index,
  columns,
  manageable,
  isVisible,
  isSelected,
  interaction,
  onToggleSelect,
  onToggleVisibility,
  displayPositionOptions,
  onDisplayPositionChange,
  onDuplicate,
  onDetach,
  reorderPosition,
  reorderCount,
  manualReorderEnabled,
  onMoveTo,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  showModule,
  showStatus,
}: PageBlocksAssignmentRowProps) {
  const pendingAction = interaction.pendingAction;
  const templatePublished = isPublishedPageBlockStatus(row.template_status);
  const assignmentVisible = normalizeBoolean(row.is_visible, false);
  const moduleLabel = moduleKindLabel(
    row.module_kind,
    row.template_slug,
    row.template_variant,
  );
  const technicalIdentityIsInternal = row.module_kind === "breadcrumb";
  const hidden = { access: "hidden" as const };
  const reorderDisabledTitle =
    "أعد فرز العرض إلى الترتيب الافتراضي لاستخدام الترتيب اليدوي.";
  const pendingState = {
    access: "disabled" as const,
    disabledReason: "انتظر انتهاء الإجراء الحالي.",
    pending: true,
  };
  const capability: AdminRowActionsCapability = {
    entityType: "page_module_assignment",
    entityId: rowId,
    entityLabel: row.template_name,
    actions: {
      edit: {
        access: "allowed",
        href: moduleEditHref(row.module_kind, row.template_id, {
          returnPageId: row.page_id,
        }),
      },
      preview: previewHref
        ? {
            access: "allowed",
            href: previewHref,
            target: "_blank",
            rel: "noopener noreferrer",
          }
        : {
            access: "disabled",
            disabledReason: "المعاينة العامة تتطلب صفحة مربوطة ومسارًا عامًا محددًا.",
          },
      information: {
        access: "allowed",
        title: `معلومات ${row.template_name}`,
        items: [
          { label: "نوع الموديول", value: moduleLabel },
          ...(technicalIdentityIsInternal
            ? []
            : [{ label: "المعرّف", value: row.template_slug }]),
          { label: "موضع العرض", value: LAYOUT_SLOT_LABELS_AR[normalizeLayoutSlot(row.slot)] },
          { label: "حالة النشر", value: templatePublished ? "منشور" : "غير منشور" },
          { label: "الربط بالصفحة", value: assignmentVisible ? "ظاهر" : "مخفي" },
          { label: "الظهور العام", value: isVisible ? "ظاهر للعامة" : "غير ظاهر للعامة" },
        ],
      },
      copyPublicLink: hidden,
      visibility: !manageable
        ? hidden
        : !templatePublished
          ? {
              access: "disabled",
              disabledReason: "انشر الموديول أولًا حتى يمكن إظهاره على الصفحة.",
              isVisible: false,
            }
        : pendingAction === "visibility"
          ? { ...pendingState, isVisible }
          : {
              access: "allowed",
              isVisible,
              onSelect: onToggleVisibility,
            },
      featured: hidden,
      duplicate: !manageable
        ? hidden
        : pendingAction === "duplicate"
          ? pendingState
          : {
              access: "allowed",
              onSelect: onDuplicate,
            },
      archive: hidden,
      delete: !manageable
        ? hidden
        : pendingAction === "delete"
          ? { ...pendingState, label: "إزالة من الصفحة" }
          : {
              access: "allowed",
              label: "إزالة من الصفحة",
              onSelect: onDetach,
              confirmation: {
                mode: "shared",
                title: "تأكيد الإزالة من الصفحة",
                description: `إزالة ${moduleLabel} «${row.template_name}» من الصفحة؟ سيبقى القالب في المكتبة.`,
                confirmLabel: "إزالة من الصفحة",
              },
            },
    },
  };

  return (
    <AdminDataGridRow
      columns={columns}
      divided={index > 0}
    >
      <AdminDataGridCheckboxCell>
        {manageable ? (
          <AdminDataGridCheckbox
            checked={isSelected}
            onChange={(event) => onToggleSelect(event.target.checked)}
            label={`تحديد ${row.template_name}`}
          />
        ) : (
          <span className="text-xs text-white/25">—</span>
        )}
      </AdminDataGridCheckboxCell>

      <AdminDataGridCenterCell>
        <AdminDataGridReorderHandle
          label={row.template_name}
          position={reorderPosition}
          count={reorderCount}
          disabled={!manageable || !manualReorderEnabled}
          pending={pendingAction === "reorder"}
          disabledReason={
            manageable
              ? reorderDisabledTitle
              : "هذا النوع غير قابل للترتيب من هذه القائمة."
          }
          onMoveTo={onMoveTo}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onDragEnd={onDragEnd}
        />
      </AdminDataGridCenterCell>

      <AdminDataGridPrimaryCell>
        <Link
          href={moduleEditHref(row.module_kind, row.template_id, {
            returnPageId: row.page_id,
          })}
          className="min-w-0 truncate text-sm font-semibold text-white hover:text-[#D8B87A]"
          title={technicalIdentityIsInternal ? undefined : row.template_slug}
        >
          {row.template_name}
        </Link>
      </AdminDataGridPrimaryCell>

      {showModule ? (
        <AdminDataGridCenterCell className="truncate text-sm font-semibold text-white/75">
          {moduleLabel}
        </AdminDataGridCenterCell>
      ) : null}

      <AdminDataGridCenterCell>
        <AdminListboxSelect
          value={normalizeLayoutSlot(row.slot)}
          options={displayPositionOptions.map((slot) => ({
            value: slot,
            label: LAYOUT_SLOT_LABELS_AR[slot],
          }))}
          onChange={(value) => onDisplayPositionChange(value as PageLayoutSlot)}
          disabled={
            !manageable ||
            displayPositionOptions.length <= 1 ||
            pendingAction === "display-position"
          }
          ariaLabel={`موضع عرض ${row.template_name}`}
        />
      </AdminDataGridCenterCell>

      {showStatus ? (
        <AdminDataGridStatusCell>
          <AdminDataGridRowActions
            capability={capability}
            display="visibility"
            size="compact"
          />
        </AdminDataGridStatusCell>
      ) : null}

      <AdminDataGridRowActions capability={capability} size="compact" />
    </AdminDataGridRow>
  );
}

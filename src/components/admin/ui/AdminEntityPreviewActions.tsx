import {
  resolveAdminEntityPreviewActions,
  type AdminEntityPreviewCapability,
  type AdminEntityPreviewActionKind,
} from "../../../lib/admin/interaction-system/entity-preview-capability";
import { AdminDataGridActionButton } from "./AdminDataGrid";
import AdminActionButton, { adminActionButtonClassName } from "./AdminActionButton";

const ACTION_LABELS: Record<AdminEntityPreviewActionKind, string> = {
  "internal-preview": "معاينة داخلية",
  "public-view": "النسخة العامة",
};

export default function AdminEntityPreviewActions({
  capability,
  presentation = "default",
}: {
  capability: AdminEntityPreviewCapability;
  presentation?: "default" | "data-grid-compact";
}) {
  const actions = resolveAdminEntityPreviewActions(capability);
  if (!actions.length) return null;

  if (presentation === "data-grid-compact") {
    return (
      <div
        className="contents"
        data-admin-entity-preview-actions=""
        data-admin-entity-preview-presentation="data-grid-compact"
        data-admin-entity-type={capability.entityType}
        data-admin-entity-id={String(capability.entityId)}
      >
        {actions.map((action) => (
          <span
            key={action.kind}
            className="contents"
            data-admin-entity-preview-action={action.kind}
            data-admin-entity-preview-action-state={
              action.disabled ? "disabled" : "enabled"
            }
          >
            <AdminDataGridActionButton
              action="preview"
              href={action.href}
              target="_blank"
              rel="noopener noreferrer"
              title={ACTION_LABELS[action.kind]}
              ariaLabel={ACTION_LABELS[action.kind]}
              disabled={action.disabled}
              size="compact"
            />
          </span>
        ))}
      </div>
    );
  }

  return (
    <div
      className="contents"
      data-admin-entity-preview-actions=""
      data-admin-entity-type={capability.entityType}
      data-admin-entity-id={String(capability.entityId)}
    >
      {actions.map((action) =>
        action.disabled ? (
          <span
            key={action.kind}
            role="link"
            aria-disabled="true"
            data-admin-entity-preview-action={action.kind}
            data-admin-entity-preview-action-state="disabled"
            className={adminActionButtonClassName({ disabled: true, variant: "dark" })}
          >
            {ACTION_LABELS[action.kind]}
          </span>
        ) : (
          <AdminActionButton
            key={action.kind}
            href={action.href}
            target="_blank"
            rel="noopener noreferrer"
            prefetch={false}
            aria-label={ACTION_LABELS[action.kind]}
            data-admin-entity-preview-action={action.kind}
            data-admin-entity-preview-action-state="enabled"
            variant="dark"
          >
            {ACTION_LABELS[action.kind]}
          </AdminActionButton>
        ),
      )}
    </div>
  );
}

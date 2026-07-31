import type { AdminEntityCapabilityAccess } from "./entity-preview-capability";

export const ADMIN_ROW_ACTION_PRIMARY_ORDER = [
  "edit",
  "preview",
  "more",
] as const;

export const ADMIN_ROW_ACTION_MORE_ORDER = [
  "information",
  "copyPublicLink",
  "visibility",
  "featured",
  "duplicate",
  "archive",
  "delete",
] as const;

export type AdminRowActionPrimaryKind =
  (typeof ADMIN_ROW_ACTION_PRIMARY_ORDER)[number];

export type AdminRowActionMoreKind =
  (typeof ADMIN_ROW_ACTION_MORE_ORDER)[number];

/**
 * Shared access states for every row action. Entities declare the state; the
 * shared UI only renders it. Permission and domain rules stay in the adapter.
 */
export type AdminRowActionHidden = {
  access: Extract<AdminEntityCapabilityAccess, "hidden">;
  disabledReason?: never;
  pending?: never;
  href?: never;
  target?: never;
  rel?: never;
  onSelect?: never;
};

export type AdminRowActionDisabled = {
  access: Extract<AdminEntityCapabilityAccess, "disabled">;
  disabledReason?: string;
  pending?: boolean;
  href?: never;
  target?: never;
  rel?: never;
  onSelect?: never;
};

export type AdminRowActionAllowedState = {
  access: Extract<AdminEntityCapabilityAccess, "allowed">;
  disabledReason?: never;
  pending?: boolean;
};

export type AdminRowActionSharedConfirmation = {
  mode: "shared";
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
};

export type AdminRowActionDelegatedConfirmation = {
  mode: "delegated";
  owner: "confirmation_runtime";
};

export type AdminRowActionConfirmation =
  | AdminRowActionSharedConfirmation
  | AdminRowActionDelegatedConfirmation;

export type AdminRowActionAllowedLink = AdminRowActionAllowedState & {
  href: string;
  target?: string;
  rel?: string;
  onSelect?: never;
};

export type AdminRowActionAllowedCommand = AdminRowActionAllowedState & {
  href?: never;
  target?: never;
  rel?: never;
  onSelect: () => void | Promise<void>;
  confirmation?: AdminRowActionConfirmation;
};

export type AdminRowActionAllowed =
  | AdminRowActionAllowedLink
  | AdminRowActionAllowedCommand;

/**
 * Navigation and command targets share one presentation contract. Callbacks
 * are supplied by client-side consumers and must delegate execution to the
 * existing Data/Confirmation runtimes; this capability owns no mutation work.
 */
export type AdminRowActionTarget =
  | AdminRowActionHidden
  | AdminRowActionDisabled
  | AdminRowActionAllowed;

export type AdminRowActionState =
  | AdminRowActionHidden
  | AdminRowActionDisabled
  | AdminRowActionAllowedState;

export type AdminRowActionInformationItem = {
  label: string;
  value: string;
};

export type AdminRowActionInformation =
  | AdminRowActionHidden
  | ((AdminRowActionDisabled | AdminRowActionAllowedState) & {
      title: string;
      items: readonly AdminRowActionInformationItem[];
      loading?: boolean;
      errorMessage?: string;
      emptyMessage?: string;
    });

type AdminRowActionVisibleTarget =
  | AdminRowActionDisabled
  | AdminRowActionAllowed;

export type AdminRowActionVisibility =
  | AdminRowActionHidden
  | (AdminRowActionVisibleTarget & {
      isVisible: boolean;
    });

export type AdminRowActionFeatured =
  | AdminRowActionHidden
  | (AdminRowActionVisibleTarget & {
      isFeatured: boolean;
    });

export type AdminRowActionArchive =
  | AdminRowActionHidden
  | (AdminRowActionVisibleTarget & {
      isArchived: boolean;
    });

/**
 * Entity-agnostic declaration consumed by the shared Admin DataGrid UI.
 * Every action is explicit, including unsupported actions (`hidden`), so the
 * shared renderer never contains entity, permission, or business conditions.
 */
export type AdminRowActionsCapability = {
  entityType: string;
  entityId: number | string;
  entityLabel: string;
  actions: {
    edit: AdminRowActionTarget;
    preview: AdminRowActionTarget;
    information: AdminRowActionInformation;
    copyPublicLink: AdminRowActionTarget;
    visibility: AdminRowActionVisibility;
    featured: AdminRowActionFeatured;
    duplicate: AdminRowActionTarget;
    archive: AdminRowActionArchive;
    delete: AdminRowActionTarget;
  };
};

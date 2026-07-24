import { resolveSafeInternalPath } from "../../security/safe-internal-path";

export type AdminEntityPreviewActionKind =
  | "internal-preview"
  | "public-view";

export type AdminEntityCapabilityAccess = "allowed" | "disabled" | "hidden";

export type AdminEntityPreviewCapability = {
  entityType: string;
  entityId: number | string;
  publicationStatus?: string | null;
  routes: {
    internalPreview?: string | null;
    publicView?: string | null;
  };
  access: Record<
    AdminEntityPreviewActionKind,
    AdminEntityCapabilityAccess
  >;
};

export type ResolvedAdminEntityPreviewAction = {
  kind: AdminEntityPreviewActionKind;
  href: string;
  disabled: boolean;
};

function hasValidEntityId(entityId: number | string) {
  if (typeof entityId === "number") {
    return Number.isInteger(entityId) && entityId > 0;
  }
  return entityId.trim().length > 0;
}

function resolveAction(
  kind: AdminEntityPreviewActionKind,
  route: string | null | undefined,
  access: AdminEntityCapabilityAccess,
): ResolvedAdminEntityPreviewAction | null {
  if (access === "hidden") return null;
  const href = resolveSafeInternalPath(route, "");
  if (!href) return null;
  return { kind, href, disabled: access === "disabled" };
}

/**
 * Shared Preview/Public capability policy for the Admin Interaction System.
 * Entities declare identity, publication state, routes, and access only; this
 * resolver owns safe navigation plus action visibility/disabled rules.
 */
export function resolveAdminEntityPreviewActions(
  capability: AdminEntityPreviewCapability,
): ResolvedAdminEntityPreviewAction[] {
  if (!hasValidEntityId(capability.entityId)) return [];

  const actions: ResolvedAdminEntityPreviewAction[] = [];
  const internalPreview = resolveAction(
    "internal-preview",
    capability.routes.internalPreview,
    capability.access["internal-preview"],
  );
  if (internalPreview) actions.push(internalPreview);

  if (capability.publicationStatus === "published") {
    const publicView = resolveAction(
      "public-view",
      capability.routes.publicView,
      capability.access["public-view"],
    );
    if (publicView) actions.push(publicView);
  }

  return actions;
}

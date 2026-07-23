import { adminContentTopicPreviewPath } from "../content-routes";
import type { ContentType } from "./content-types";
import { resolvePublicContentPath } from "../../content/public-content-path";
import type {
  AdminEntityPreviewActionKind,
  AdminEntityPreviewCapability,
} from "../interaction-system/entity-preview-capability";

const ALL_PREVIEW_ACTIONS = [
  "internal-preview",
  "public-view",
] as const satisfies readonly AdminEntityPreviewActionKind[];

export function buildAdminContentPreviewCapability(input: {
  entityType: string;
  id: number | string;
  contentType: ContentType;
  slug?: string | null;
  publicationStatus?: string | null;
  allowedActions?: readonly AdminEntityPreviewActionKind[];
}): AdminEntityPreviewCapability {
  const allowedActions = new Set(input.allowedActions ?? ALL_PREVIEW_ACTIONS);
  const slug = input.slug?.trim() ?? "";

  return {
    entityType: input.entityType,
    entityId: input.id,
    publicationStatus: input.publicationStatus,
    routes: {
      internalPreview: adminContentTopicPreviewPath(input.id),
      publicView: slug
        ? resolvePublicContentPath(input.contentType, slug)
        : null,
    },
    access: {
      "internal-preview": allowedActions.has("internal-preview")
        ? "allowed"
        : "hidden",
      "public-view": allowedActions.has("public-view")
        ? "allowed"
        : "hidden",
    },
  };
}

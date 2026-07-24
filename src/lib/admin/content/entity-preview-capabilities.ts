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

export function buildAdminCategoryCollectionPreviewCapability(input: {
  id: number | string;
  slug?: string | null;
  isActive: boolean;
}): AdminEntityPreviewCapability {
  const slug = input.slug?.trim() ?? "";

  return {
    entityType: "topic-category",
    entityId: input.id,
    publicationStatus: input.isActive ? "published" : "unpublished",
    publicViewPublicationPolicy: "always",
    routes: {
      internalPreview: null,
      publicView: slug
        ? `/topics?category=${encodeURIComponent(slug)}`
        : null,
    },
    access: {
      "internal-preview": "hidden",
      "public-view": "allowed",
    },
  };
}

export function buildAdminSeriesCollectionPreviewCapability(input: {
  id: number | string;
}): AdminEntityPreviewCapability {
  return {
    entityType: "topic-series",
    entityId: input.id,
    routes: {
      internalPreview: `/admin/content/topics?series=${encodeURIComponent(String(input.id))}`,
      publicView: null,
    },
    access: {
      "internal-preview": "allowed",
      "public-view": "hidden",
    },
  };
}

export const PROJECT_PUBLICATION_STATUSES = [
  "draft",
  "published",
  "unpublished",
] as const;

export type ProjectPublicationStatus =
  (typeof PROJECT_PUBLICATION_STATUSES)[number];

export type ProjectPublicationTone = "blue" | "green" | "gold";

export const PROJECT_PUBLICATION_METADATA: Record<
  ProjectPublicationStatus,
  { label: string; tone: ProjectPublicationTone; publicLabel: string }
> = {
  draft: {
    label: "مسودة",
    tone: "blue",
    publicLabel: "غير ظاهر للعامة",
  },
  published: {
    label: "منشور",
    tone: "green",
    publicLabel: "ظاهر للعامة",
  },
  unpublished: {
    label: "غير منشور",
    tone: "gold",
    publicLabel: "غير ظاهر للعامة",
  },
};

export const PROJECT_PUBLISH_BLOCKER_CODES = {
  invalidField: "PROJECT_PUBLISH_FIELD_INVALID",
  aggregateUnavailable: "PROJECT_PUBLISH_AGGREGATE_UNAVAILABLE",
} as const;

export type ProjectPublishBlockerCode =
  (typeof PROJECT_PUBLISH_BLOCKER_CODES)[keyof typeof PROJECT_PUBLISH_BLOCKER_CODES];

export type ProjectPublishBlocker = {
  code: ProjectPublishBlockerCode;
  field: string;
  message: string;
};

export type ProjectPublishWarning = {
  code: "PROJECT_SEO_TITLE_FALLBACK" | "PROJECT_SEO_DESCRIPTION_FALLBACK";
  field: "seo_title" | "seo_description";
  message: string;
};

export type ProjectPublishingReadiness = {
  ready: boolean;
  blockers: ProjectPublishBlocker[];
  warnings: ProjectPublishWarning[];
};

export function isProjectPublicationStatus(
  value: unknown,
): value is ProjectPublicationStatus {
  return PROJECT_PUBLICATION_STATUSES.includes(
    value as ProjectPublicationStatus,
  );
}

export function getProjectPublicationMetadata(
  status: ProjectPublicationStatus,
) {
  return PROJECT_PUBLICATION_METADATA[status];
}

export function isProjectPubliclyVisible(
  status: ProjectPublicationStatus,
) {
  return status === "published";
}

export function resolveProjectPublicationStatusForVisibility(
  currentStatus: ProjectPublicationStatus,
  visible: boolean,
): ProjectPublicationStatus {
  if (visible) return "published";
  return currentStatus === "draft" ? "draft" : "unpublished";
}

export function resolveProjectPublicationAuditOperation(input: {
  mode: "create" | "edit";
  previousStatus: ProjectPublicationStatus | null;
  nextStatus: ProjectPublicationStatus;
}): "create" | "update" | "publish" | "unpublish" {
  if (input.mode === "create") {
    return input.nextStatus === "published" ? "publish" : "create";
  }
  if (
    input.nextStatus === "published" &&
    input.previousStatus !== "published"
  ) {
    return "publish";
  }
  if (
    input.previousStatus === "published" &&
    input.nextStatus === "unpublished"
  ) {
    return "unpublish";
  }
  return "update";
}

export function getProjectPreviewCapability(input: {
  id: number;
  slug: string;
  publicationStatus: ProjectPublicationStatus;
}) {
  return {
    entityType: "project",
    entityId: input.id,
    publicationStatus: input.publicationStatus,
    publicViewPublicationPolicy: "published-only" as const,
    routes: {
      internalPreview: `/admin/projects/${input.id}/preview`,
      publicView: `/projects/${input.slug}`,
    },
    access: {
      "internal-preview": "allowed" as const,
      "public-view": "allowed" as const,
    },
  };
}

export function getProjectPublishingReadiness(input: {
  fieldErrors: Record<string, string[]>;
  seoTitle: string;
  seoDescription: string;
}): ProjectPublishingReadiness {
  const blockers = Object.entries(input.fieldErrors).flatMap(
    ([field, messages]) =>
      messages.map((message) => ({
        code: PROJECT_PUBLISH_BLOCKER_CODES.invalidField,
        field,
        message,
      })),
  );
  const warnings: ProjectPublishWarning[] = [];

  if (!input.seoTitle.trim()) {
    warnings.push({
      code: "PROJECT_SEO_TITLE_FALLBACK",
      field: "seo_title",
      message:
        "سيُستخدم اسم المشروع كعنوان SEO تلقائيًا؛ يفضّل كتابة عنوان مخصص.",
    });
  }
  if (!input.seoDescription.trim()) {
    warnings.push({
      code: "PROJECT_SEO_DESCRIPTION_FALLBACK",
      field: "seo_description",
      message:
        "سيُستخدم الوصف المختصر في نتائج البحث؛ يفضّل كتابة وصف SEO مخصص.",
    });
  }

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
  };
}

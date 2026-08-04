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

export type ProjectPublishingCheckStatus = "pass" | "fail" | "warn" | "info";

export type ProjectPublishingCheck = {
  id: string;
  field: string;
  status: ProjectPublishingCheckStatus;
  blocksPublish: boolean;
  message: string;
};

export type ProjectPublishingReadiness = {
  ready: boolean;
  checks: ProjectPublishingCheck[];
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
  validationChecks: readonly {
    id: string;
    field: string;
    valid: boolean;
    messages: readonly string[];
  }[];
  seoTitle: string;
  seoDescription: string;
}): ProjectPublishingReadiness {
  const validationChecks: ProjectPublishingCheck[] = input.validationChecks.map(
    (check) => ({
      id: check.id,
      field: check.field,
      status: check.valid ? "pass" : "fail",
      blocksPublish: true,
      message: check.valid
        ? "المتطلب مستوفى وفق Validation Truth الحالية."
        : check.messages.join(" "),
    }),
  );
  const seoChecks: ProjectPublishingCheck[] = [
    {
      id: "project-seo:title-override",
      field: "seo_title",
      status: input.seoTitle.trim() ? "pass" : "warn",
      blocksPublish: false,
      message: input.seoTitle.trim()
        ? "تم تحديد عنوان SEO مخصص."
        : "سيُستخدم اسم المشروع كعنوان SEO تلقائيًا؛ يفضّل كتابة عنوان مخصص.",
    },
    {
      id: "project-seo:description-override",
      field: "seo_description",
      status: input.seoDescription.trim() ? "pass" : "warn",
      blocksPublish: false,
      message: input.seoDescription.trim()
        ? "تم تحديد وصف SEO مخصص."
        : "سيُستخدم الوصف المختصر في نتائج البحث؛ يفضّل كتابة وصف SEO مخصص.",
    },
  ];
  const checks = [...validationChecks, ...seoChecks];
  const blockers: ProjectPublishBlocker[] = validationChecks.flatMap((check) =>
    check.status === "fail"
      ? [{
          code: PROJECT_PUBLISH_BLOCKER_CODES.invalidField,
          field: check.field,
          message: check.message,
        }]
      : [],
  );
  const warnings: ProjectPublishWarning[] = seoChecks.flatMap((check) => {
    if (check.status !== "warn") return [];
    return [{
      code: check.id === "project-seo:title-override"
        ? "PROJECT_SEO_TITLE_FALLBACK"
        : "PROJECT_SEO_DESCRIPTION_FALLBACK",
      field: check.field as ProjectPublishWarning["field"],
      message: check.message,
    }];
  });

  return {
    ready: blockers.length === 0,
    checks,
    blockers,
    warnings,
  };
}

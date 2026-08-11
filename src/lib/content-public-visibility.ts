export const PUBLIC_CONTENT_VISIBILITY_CONTRACT = {
  status: "published",
  deletedAt: null,
} as const;

export type ContentPublicationStatus =
  | typeof PUBLIC_CONTENT_VISIBILITY_CONTRACT.status
  | "unpublished";

export type ContentVisibilityActionIntent =
  | "hide"
  | "publish"
  | "restore_required";

export type ContentPublicVisibilityState = {
  isPubliclyVisible: boolean;
  actionIntent: ContentVisibilityActionIntent;
  nextStatus: "published" | "unpublished" | null;
  tooltip: string;
  ariaLabel: string;
};

export function getContentPublicVisibilityState(input: {
  status?: string | null;
  deletedAt?: string | null;
}): ContentPublicVisibilityState {
  if (input.deletedAt) {
    return {
      isPubliclyVisible: false,
      actionIntent: "restore_required",
      nextStatus: null,
      tooltip: "المحتوى محذوف حذفًا آمنًا — يجب استعادته قبل النشر",
      ariaLabel: "المحتوى غير ظاهر للعامة لأنه محذوف حذفًا آمنًا",
    };
  }

  if (input.status === PUBLIC_CONTENT_VISIBILITY_CONTRACT.status) {
    return {
      isPubliclyVisible: true,
      actionIntent: "hide",
      nextStatus: "unpublished",
      tooltip: "ظاهر للعامة — اضغط لإخفائه",
      ariaLabel: "المحتوى ظاهر للعامة. إخفاء المحتوى",
    };
  }

  return {
    isPubliclyVisible: false,
    actionIntent: "publish",
    nextStatus: "published",
    tooltip: "المحتوى غير منشور — اضغط للنشر",
    ariaLabel: "المحتوى غير منشور. نشر المحتوى",
  };
}

export function isContentPubliclyVisible(input: {
  status?: string | null;
  deletedAt?: string | null;
}) {
  return getContentPublicVisibilityState(input).isPubliclyVisible;
}

export type ContentPublicationStatus =
  | "archived"
  | "draft"
  | "published"
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
  if (input.deletedAt || input.status === "archived") {
    return {
      isPubliclyVisible: false,
      actionIntent: "restore_required",
      nextStatus: null,
      tooltip: input.deletedAt
        ? "المحتوى محذوف حذفًا آمنًا — يجب استعادته قبل النشر"
        : "المحتوى مؤرشف — يجب استعادته قبل النشر",
      ariaLabel: input.deletedAt
        ? "المحتوى غير ظاهر للعامة لأنه محذوف حذفًا آمنًا"
        : "المحتوى غير ظاهر للعامة لأنه مؤرشف",
    };
  }

  if (input.status === "published") {
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
    tooltip:
      input.status === "draft"
        ? "المحتوى مسودة — اضغط لمحاولة النشر"
        : "المحتوى غير ظاهر للعامة — اضغط لإعادة النشر",
    ariaLabel:
      input.status === "draft"
        ? "المحتوى غير ظاهر للعامة لأنه مسودة. محاولة النشر"
        : "المحتوى غير ظاهر للعامة. إعادة نشر المحتوى",
  };
}

export function isContentPubliclyVisible(input: {
  status?: string | null;
  deletedAt?: string | null;
}) {
  return getContentPublicVisibilityState(input).isPubliclyVisible;
}

export const ADMIN_ENTITY_REVIEW_TAB_LABEL = "المراجعة والنشر";

export type EntityReviewStatus = "pass" | "warn" | "fail" | "info";
export type EntityReviewSeverity = "success" | "error" | "warning" | "info";

export type EntityReviewCorrectionTarget = {
  tabId: string;
  targetId: string;
};

export type EntityReviewCheck = {
  id: string;
  label: string;
  status: EntityReviewStatus;
  severity: EntityReviewSeverity;
  blocksPublish: boolean;
  hint: string;
  field?: string;
  correctionTarget?: EntityReviewCorrectionTarget;
};

export type EntityReviewAnalysisCardDefinition = {
  id: "content" | "image" | "seo";
  title: string;
  description: string;
  checkIds: readonly string[];
};

export type EntityReviewSummaryEntry = {
  id: string;
  title: string;
  value: string;
};

export function getEntityReviewScore(
  checks: readonly EntityReviewCheck[],
) {
  const scored = checks.filter((item) => item.status !== "info");
  if (!scored.length) return 100;

  const earned = scored.reduce(
    (total, item) =>
      total + (item.status === "pass" ? 1 : item.status === "warn" ? 0.5 : 0),
    0,
  );
  return Math.round((earned / scored.length) * 100);
}

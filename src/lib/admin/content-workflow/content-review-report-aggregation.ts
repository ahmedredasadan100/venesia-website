export type ContentReviewAssessment = {
  id: number;
  title: string;
  contentType: string;
  status: string | null;
  blockerIds: string[];
};

export type ContentReviewReport = {
  checked: number;
  ready: number;
  blocked: number;
  publishedWithBlocks: number;
  blockingChecks: Array<{ id: string; count: number }>;
  samples: ContentReviewAssessment[];
};

export function aggregateContentReviewAssessments(
  assessments: readonly ContentReviewAssessment[],
): ContentReviewReport {
  const checkCounts = new Map<string, number>();
  const samples: ContentReviewAssessment[] = [];
  let ready = 0;
  let publishedWithBlocks = 0;

  for (const assessment of assessments) {
    const blockerIds = [...new Set(assessment.blockerIds)];
    if (blockerIds.length === 0) {
      ready += 1;
      continue;
    }
    if (assessment.status === "published") publishedWithBlocks += 1;
    for (const id of blockerIds) {
      checkCounts.set(id, (checkCounts.get(id) ?? 0) + 1);
    }
    if (samples.length < 8) samples.push({ ...assessment, blockerIds });
  }

  return {
    checked: assessments.length,
    ready,
    blocked: assessments.length - ready,
    publishedWithBlocks,
    blockingChecks: [...checkCounts.entries()]
      .map(([id, count]) => ({ id, count }))
      .sort((left, right) => right.count - left.count || left.id.localeCompare(right.id)),
    samples,
  };
}

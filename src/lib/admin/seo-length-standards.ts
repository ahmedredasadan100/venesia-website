export type SeoLengthState = "muted" | "warning" | "success" | "danger";

export type SeoLengthStandard = {
  min: number;
  max: number;
};

export type SeoLengthAssessment = SeoLengthStandard & {
  count: number;
  meaningfulCount: number;
  state: SeoLengthState;
};

export const SEO_LENGTH_STANDARDS = {
  title: {
    min: 45,
    max: 60,
  },
  description: {
    min: 120,
    max: 160,
  },
} as const satisfies Record<string, SeoLengthStandard>;

/** Counts every character currently present in the field. */
export function countSeoTextCharacters(value: string) {
  return value.length;
}

export function assessSeoLength(
  value: string,
  standard: SeoLengthStandard,
): SeoLengthAssessment {
  const count = countSeoTextCharacters(value);
  const meaningfulCount = countSeoTextCharacters(value.trim());
  const state: SeoLengthState =
    meaningfulCount === 0
      ? "muted"
      : meaningfulCount < standard.min
        ? "warning"
        : meaningfulCount <= standard.max
          ? "success"
          : "danger";

  return { ...standard, count, meaningfulCount, state };
}

export function formatSeoLengthRange(standard: SeoLengthStandard) {
  return `${standard.min}–${standard.max}`;
}

export function getSeoLengthStateLabel(state: SeoLengthState) {
  if (state === "muted") return "فارغ";
  if (state === "warning") return "أقصر من المعيار";
  if (state === "success") return "ضمن المعيار";
  return "أطول من المعيار";
}

export function describeSeoLength(assessment: SeoLengthAssessment) {
  const range = formatSeoLengthRange(assessment);
  const measured =
    assessment.count === assessment.meaningfulCount
      ? `${assessment.count} حرفًا`
      : `${assessment.count} حرفًا مكتوبًا (${assessment.meaningfulCount} دون المسافات الطرفية)`;

  if (assessment.state === "muted") {
    return `الحقل فارغ — المستهدف ${range} حرفًا.`;
  }
  if (assessment.state === "warning") {
    return `${measured} — أقل من المستهدف ${range}.`;
  }
  if (assessment.state === "success") {
    return `${measured} — ضمن المستهدف ${range}.`;
  }
  return `${measured} — يتجاوز المستهدف ${range}.`;
}

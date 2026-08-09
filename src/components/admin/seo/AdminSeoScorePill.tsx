import { AdminStatusPill } from "../ui";

type AdminSeoScorePillProps = {
  score: number | null;
  label?: string | null;
  blockingErrors?: number | null;
  unavailableReason?: string;
};

function getSeoScoreTone(score: number) {
  if (score >= 80) return "green" as const;
  if (score >= 60) return "gold" as const;
  if (score >= 40) return "blue" as const;
  return "red" as const;
}

/** Shared presentation for the official analyzeEntitySeo score output. */
export default function AdminSeoScorePill({
  score,
  label,
  blockingErrors,
  unavailableReason = "درجة SEO غير متاحة من مصدر البيانات الحالي.",
}: AdminSeoScorePillProps) {
  if (score === null) {
    return (
      <AdminStatusPill tone="muted">
        <span title={unavailableReason}>غير متاح</span>
      </AdminStatusPill>
    );
  }

  const details = [
    `SEO: ${score} من 100`,
    label,
    blockingErrors == null ? null : `أخطاء مانعة: ${blockingErrors}`,
  ].filter(Boolean);

  return (
    <AdminStatusPill tone={getSeoScoreTone(score)}>
      <span className="font-en tabular-nums" title={details.join(" · ")}>
        {score}%
      </span>
    </AdminStatusPill>
  );
}

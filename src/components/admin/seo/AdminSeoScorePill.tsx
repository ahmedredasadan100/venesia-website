import { AdminStatusPill } from "../ui";

type AdminSeoScorePillProps = {
  score: number;
  label?: string;
  blockingErrors?: number;
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
}: AdminSeoScorePillProps) {
  const details = [
    `SEO: ${score} من 100`,
    label,
    blockingErrors === undefined ? null : `أخطاء مانعة: ${blockingErrors}`,
  ].filter(Boolean);

  return (
    <AdminStatusPill tone={getSeoScoreTone(score)}>
      <span className="font-en tabular-nums" title={details.join(" · ")}>
        {score}%
      </span>
    </AdminStatusPill>
  );
}

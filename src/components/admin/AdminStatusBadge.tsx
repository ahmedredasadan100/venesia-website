import { AdminStatusPill } from "./ui";

type AdminStatusBadgeProps = {
  status?: string | null;
};

const statusMap: Record<
  string,
  {
    label: string;
    tone: "green" | "gold" | "muted" | "red" | "blue";
  }
> = {
  published: { label: "منشور", tone: "green" },
  active: { label: "ظاهر", tone: "green" },
  visible: { label: "ظاهر", tone: "green" },
  draft: { label: "مسودة", tone: "gold" },
  hidden: { label: "مخفي", tone: "muted" },
  inactive: { label: "مخفي", tone: "muted" },
  archived: { label: "مؤرشف", tone: "red" },
};

/**
 * Legacy compatibility wrapper.
 *
 * The shared status component is AdminStatusPill. This wrapper keeps older
 * pages working while forcing the same pill sizing, radius and tones.
 */
export default function AdminStatusBadge({ status }: AdminStatusBadgeProps) {
  const normalizedStatus = status || "draft";
  const config = statusMap[normalizedStatus] ?? {
    label: normalizedStatus,
    tone: "muted" as const,
  };

  return <AdminStatusPill tone={config.tone}>{config.label}</AdminStatusPill>;
}

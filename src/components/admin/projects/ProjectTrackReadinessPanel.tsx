import Link from "next/link";

import type { ProjectRow } from "../../../lib/projects/types";

type ProjectTrackReadinessPanelProps = {
  project: Pick<ProjectRow, "id" | "slug" | "code" | "arabic_name" | "status" | "status_label" | "progress" | "publication_status">;
};

const STATUS_LABELS: Record<string, string> = {
  "under-construction": "تحت الإنشاء",
  excavation: "حفر وأساسات",
  "near-delivery": "قرب التسليم",
  delivered: "تم التسليم",
};

export default function ProjectTrackReadinessPanel({ project }: ProjectTrackReadinessPanelProps) {
  const trackPath = `/track-your-project/${project.slug}`;
  const hasProgress = project.progress > 0;
  const hasStatusLabel = Boolean(project.status_label.trim());
  const isPublished = project.publication_status === "published";

  const readinessItems = [
    {
      label: "حالة التنفيذ",
      value: STATUS_LABELS[project.status] ?? project.status,
      ready: Boolean(project.status),
    },
    {
      label: "نسبة التقدم",
      value: hasProgress ? `${project.progress}%` : "غير مضبوطة",
      ready: hasProgress,
    },
    {
      label: "تسمية الحالة",
      value: hasStatusLabel ? project.status_label : "غير مضبوطة",
      ready: hasStatusLabel,
    },
    {
      label: "النشر العام",
      value: isPublished ? "منشور" : project.publication_status,
      ready: isPublished,
    },
  ];

  const readyCount = readinessItems.filter((item) => item.ready).length;

  return (
    <section className="rounded-[24px] border border-white/10 bg-[#080B10]/88 p-5">
      <p className="font-en text-[11px] tracking-[0.28em] text-[#D8B87A]/70">TRACK YOUR PROJECT</p>
      <h3 className="mt-2 text-lg font-semibold text-white">جاهزية صفحة المتابعة</h3>
      <p className="mt-2 text-sm leading-7 text-white/45">
        البيانات التالية موجودة في قاعدة البيانات وتُجهَّز لصفحة{" "}
        <span className="font-en text-white/55" dir="ltr">
          {trackPath}
        </span>
        . الصفحة العامة ما زالت placeholder — لا تغيير على العرض العام في هذه البوابة.
      </p>

      <div className="mt-4 rounded-[16px] border border-white/8 bg-black/20 px-4 py-3 text-sm text-white/55">
        الجاهزية: {readyCount}/{readinessItems.length} حقول متوفرة للمتابعة المستقبلية
      </div>

      <ul className="mt-4 space-y-2">
        {readinessItems.map((item) => (
          <li
            key={item.label}
            className="flex items-center justify-between gap-3 rounded-[14px] border border-white/8 px-3 py-2.5 text-sm"
          >
            <span className="text-white/55">{item.label}</span>
            <span className={item.ready ? "text-emerald-200" : "text-amber-100/80"}>{item.value}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        <Link
          href={trackPath}
          target="_blank"
          className="rounded-full border border-white/10 px-3 py-1.5 text-white/55 hover:border-[#D8B87A]/30 hover:text-[#D8B87A]"
        >
          معاينة المسار العام (placeholder)
        </Link>
        <Link
          href="/admin/projects/construction-updates"
          className="rounded-full border border-white/10 px-3 py-1.5 text-white/55 hover:border-[#D8B87A]/30 hover:text-[#D8B87A]"
        >
          لوحة تحديثات التنفيذ
        </Link>
      </div>
    </section>
  );
}

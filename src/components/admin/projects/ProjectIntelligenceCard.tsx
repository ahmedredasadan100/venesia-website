import AdminStatusPill from "../ui/AdminStatusPill";
import type { ProjectRow } from "../../../lib/projects/types";

const STATUS_LABELS: Record<string, string> = {
  "under-construction": "تحت الإنشاء",
  excavation: "حفر وأساسات",
  "near-delivery": "قرب التسليم",
  delivered: "تم التسليم",
};

type ProjectIntelligenceCardProps = {
  project: Pick<
    ProjectRow,
    "status" | "status_label" | "progress" | "publication_status" | "type" | "featured" | "show_on_homepage"
  >;
};

export default function ProjectIntelligenceCard({ project }: ProjectIntelligenceCardProps) {
  return (
    <section className="rounded-[24px] border border-[#D8B87A]/14 bg-[#080B10]/92 p-5">
      <p className="font-en text-[11px] tracking-[0.32em] text-[#D8B87A]/70">PROJECT INTELLIGENCE</p>
      <h3 className="mt-2 text-lg font-semibold text-white">حالة التنفيذ والظهور</h3>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[16px] border border-white/8 bg-black/20 px-4 py-3">
          <p className="text-xs text-white/40">حالة البناء</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {STATUS_LABELS[project.status] ?? project.status}
          </p>
          {project.status_label ? <p className="mt-1 text-xs text-white/45">{project.status_label}</p> : null}
        </div>
        <div className="rounded-[16px] border border-white/8 bg-black/20 px-4 py-3">
          <p className="text-xs text-white/40">نسبة التقدم</p>
          <p className="mt-1 text-sm font-semibold text-[#D8B87A]">{project.progress}%</p>
        </div>
        <div className="rounded-[16px] border border-white/8 bg-black/20 px-4 py-3">
          <p className="text-xs text-white/40">النشر</p>
          <div className="mt-2">
            <AdminStatusPill tone={project.publication_status === "published" ? "green" : "muted"}>
              {project.publication_status}
            </AdminStatusPill>
          </div>
        </div>
        <div className="rounded-[16px] border border-white/8 bg-black/20 px-4 py-3">
          <p className="text-xs text-white/40">الظهور</p>
          <p className="mt-1 text-sm text-white/70">
            {project.featured ? "مميز" : "عادي"} · {project.show_on_homepage ? "الرئيسية" : "خارج الرئيسية"}
          </p>
        </div>
      </div>
    </section>
  );
}
